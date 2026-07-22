// NEXUS-P2B-002: Task Runs Service
// Manages execution of a single task: generate code, save TaskRun, track cost
// CRITICAL: Never writes files, never executes code. Stores code as TEXT in DB only.

import { prisma } from '@/lib/prisma'
import { Builder } from '@/modules/agents/builder'
import { logSafe } from '@/lib/redact'

interface RunTaskInput {
  taskId: string
  projectId: string
}

interface TaskRunResponse {
  taskRunId: string
  status: string
  generatedCode: string
  cost?: {
    estimatedCost: number
    inputTokens: number
    outputTokens: number
    provider: string
    model: string
  }
}

export class TaskRunsService {
  private builder = new Builder()

  async runTask(input: RunTaskInput): Promise<TaskRunResponse> {
    const { taskId, projectId } = input
    const startTime = Date.now()

    logSafe(`TaskRunsService: running task ${taskId}`)

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // Verify project exists and get PRD context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    })

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // Extract PRD from project documents
    const prdDoc = project.documents.find((d) => d.type === 'summary_and_prd')
    let prdContent = ''
    if (prdDoc) {
      try {
        const parsed = JSON.parse(prdDoc.content)
        prdContent = parsed.shortPrd || parsed.summary || ''
      } catch {
        prdContent = prdDoc.content
      }
    }

    if (!prdContent) {
      throw new Error(`No PRD found for project ${projectId}`)
    }

    // Create TaskRun record
    let taskRun = await prisma.taskRun.create({
      data: {
        taskId,
        status: 'PENDING',
        provider: 'claude',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        retryCount: 0,
      },
    })

    logSafe(`TaskRunsService: created TaskRun ${taskRun.id}`)

    // Generate code with retry logic (max 2 attempts)
    let generatorOutput: { generatedCode: string; usage?: { inputTokens: number; outputTokens: number } } | null = null
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        logSafe(`TaskRunsService: builder attempt ${attempt}/2 for task ${taskId}`)

        taskRun = await prisma.taskRun.update({
          where: { id: taskRun.id },
          data: {
            status: 'RUNNING',
            retryCount: attempt,
          },
        })

        generatorOutput = await this.builder.generateCode({
          taskTitle: task.title,
          taskDescription: task.description,
          prdContent,
          projectTitle: project.title,
        })

        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (attempt < 2) {
          logSafe(`TaskRunsService: attempt ${attempt} failed, retrying...`)
        }
      }
    }

    // Handle generation failure
    if (!generatorOutput) {
      const errorMsg = lastError?.message || 'Failed to generate code after 2 attempts'
      logSafe(`TaskRunsService: code generation failed: ${errorMsg}`)

      const elapsedMs = Date.now() - startTime
      taskRun = await prisma.taskRun.update({
        where: { id: taskRun.id },
        data: {
          status: 'FAILED',
          error: errorMsg,
          finishedAt: new Date(),
        },
      })

      // Log failure
      await prisma.executionLog.create({
        data: {
          projectId,
          action: 'code_generated',
          status: 'failed',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          retryCount: 2,
          elapsedMs,
          error: errorMsg,
        },
      })

      throw new Error(`Failed to generate code: ${errorMsg}`)
    }

    // Save generated code and cost
    const elapsedMs = Date.now() - startTime
    const inputTokens = generatorOutput.usage?.inputTokens || 0
    const outputTokens = generatorOutput.usage?.outputTokens || 0
    const estimatedCost = (inputTokens * 3) / 1000000 + (outputTokens * 15) / 1000000

    try {
      // Update TaskRun with generated code (as TEXT — never written to file)
      taskRun = await prisma.taskRun.update({
        where: { id: taskRun.id },
        data: {
          status: 'SUCCESS',
          generatedCode: generatorOutput.generatedCode,
          inputTokens,
          outputTokens,
          estimatedCost,
          finishedAt: new Date(),
        },
      })

      logSafe(`TaskRunsService: saved code for TaskRun ${taskRun.id} (${generatorOutput.generatedCode.length} chars)`)

      // Record cost entry
      if (inputTokens > 0 || outputTokens > 0) {
        await prisma.costEntry.create({
          data: {
            projectId,
            provider: 'claude',
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
            inputTokens,
            outputTokens,
            estimatedCost,
          },
        })

        logSafe(`TaskRunsService: cost recorded: $${estimatedCost.toFixed(6)}`)
      }

      // Log success
      await prisma.executionLog.create({
        data: {
          projectId,
          action: 'code_generated',
          status: 'success',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          retryCount: 1,
          elapsedMs,
          generatedCount: 1, // one task built
        },
      })

      return {
        taskRunId: taskRun.id,
        status: taskRun.status,
        generatedCode: taskRun.generatedCode || '',
        cost: {
          estimatedCost,
          inputTokens,
          outputTokens,
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save TaskRun'
      logSafe(`TaskRunsService: failed to save: ${errorMsg}`)

      // Mark as failed without saving code
      await prisma.taskRun.update({
        where: { id: taskRun.id },
        data: {
          status: 'FAILED',
          error: `Save failed: ${errorMsg}`,
          finishedAt: new Date(),
        },
      })

      throw new Error(`Failed to save TaskRun: ${errorMsg}`)
    }
  }

  async getTaskRun(taskRunId: string) {
    const taskRun = await prisma.taskRun.findUnique({
      where: { id: taskRunId },
      include: { task: true },
    })

    if (!taskRun) {
      return null
    }

    return {
      id: taskRun.id,
      taskId: taskRun.taskId,
      taskTitle: taskRun.task.title,
      status: taskRun.status,
      generatedCode: taskRun.generatedCode || '',
      provider: taskRun.provider,
      model: taskRun.model,
      inputTokens: taskRun.inputTokens,
      outputTokens: taskRun.outputTokens,
      estimatedCost: taskRun.estimatedCost,
      retryCount: taskRun.retryCount,
      error: taskRun.error,
      startedAt: taskRun.startedAt,
      finishedAt: taskRun.finishedAt,
      createdAt: taskRun.createdAt,
    }
  }
}
