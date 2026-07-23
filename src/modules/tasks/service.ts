// NEXUS-P2A-002: Tasks Service
// Manages task generation, storage, and retrieval
// Guarantees: atomic updates, preserved existing tasks on failure, deterministic ordering

import { prisma } from '@/lib/prisma'
import { TaskGenerator } from '@/modules/agents/task-generator'
import { logSafe } from '@/lib/redact'

interface CreateTasksInput {
  projectId: string
  prd: string
  projectTitle: string
}

interface TasksServiceResponse {
  tasks: Array<{
    id: string
    title: string
    description: string
    order: number
    status: string
  }>
  cost?: {
    estimatedCost: number
    inputTokens: number
    outputTokens: number
    provider: string
    model: string
  }
}

export class TasksService {
  private generator = new TaskGenerator()

  async generateAndSaveTasks(input: CreateTasksInput): Promise<TasksServiceResponse> {
    const { projectId, prd, projectTitle } = input
    const startTime = Date.now()

    logSafe(`TasksService: generating tasks for project ${projectId}`)

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // Generate tasks with retry logic (max 2 attempts)
    let generatorOutput
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        logSafe(
          `TasksService: generation attempt ${attempt}/2 for project ${projectId}`
        )
        generatorOutput = await this.generator.generateTasks(prd, projectTitle)
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (attempt < 2) {
          logSafe(`TasksService: attempt ${attempt} failed, retrying...`)
        }
      }
    }

    if (!generatorOutput) {
      const errorMsg = lastError?.message || 'Failed to generate tasks after 2 attempts'
      logSafe(`TasksService: task generation failed: ${errorMsg}`)

      // Log failure
      const elapsedMs = Date.now() - startTime
      await prisma.executionLog.create({
        data: {
          projectId,
          action: 'tasks_generated',
          status: 'failed',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          retryCount: 2,
          elapsedMs,
          error: errorMsg,
        },
      })

      throw new Error(`Failed to generate tasks: ${errorMsg}`)
    }

    // Use transaction to ensure atomicity:
    // 1. Validate & assign order
    // 2. Delete old tasks
    // 3. Insert new tasks
    // 4. Record cost & logs
    // If any step fails, entire transaction rolls back (old tasks remain)

    const elapsedMs = Date.now() - startTime
    const inputTokens = generatorOutput.usage?.inputTokens || 0
    const outputTokens = generatorOutput.usage?.outputTokens || 0
    const estimatedCost =
      (inputTokens * 3) / 1000000 + (outputTokens * 15) / 1000000

    try {
      const savedTasks = await prisma.$transaction(async (tx) => {
        // Delete existing tasks atomically (transaction rolls back if insert fails)
        await tx.task.deleteMany({
          where: { projectId },
        })

        logSafe(`TasksService: deleted existing tasks for project ${projectId}`)

        // Insert new tasks with server-assigned sequential order
        const insertedTasks = await Promise.all(
          generatorOutput.tasks.map((task: { title: string; description: string }, index: number) =>
            tx.task.create({
              data: {
                projectId,
                title: task.title,
                description: task.description,
                order: index + 1, // Server assigns 1, 2, 3, ...
                status: 'PENDING',
              },
            })
          )
        )

        logSafe(
          `TasksService: saved ${insertedTasks.length} tasks for project ${projectId}`
        )

        // Record cost entry
        if (inputTokens > 0 || outputTokens > 0) {
          await tx.costEntry.create({
            data: {
              projectId,
              provider: 'claude',
              model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
              inputTokens,
              outputTokens,
              estimatedCost,
            },
          })

          logSafe(`TasksService: cost recorded: $${estimatedCost.toFixed(6)}`)
        }

        // Log execution
        await tx.executionLog.create({
          data: {
            projectId,
            action: 'tasks_generated',
            status: 'success',
            provider: 'claude',
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
            retryCount: 1, // succeeded on first attempt
            elapsedMs,
            generatedCount: insertedTasks.length,
          },
        })

        return insertedTasks
      })

      return {
        tasks: savedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          order: t.order,
          status: t.status,
        })),
        cost: {
          estimatedCost,
          inputTokens,
          outputTokens,
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        },
      }
    } catch (txError) {
      // Transaction failed, log and rethrow (old tasks preserved)
      const errorMsg =
        txError instanceof Error ? txError.message : 'Database transaction failed'
      logSafe(`TasksService: transaction failed: ${errorMsg}`)

      await prisma.executionLog.create({
        data: {
          projectId,
          action: 'tasks_generated',
          status: 'failed',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          elapsedMs,
          error: `Transaction failed: ${errorMsg}`,
        },
      })

      throw new Error(`Failed to save tasks: ${errorMsg}`)
    }
  }

  async getTasks(projectId: string): Promise<Array<{
    id: string
    title: string
    description: string
    order: number
    status: string
  }>> {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      order: t.order,
      status: t.status,
    }))
  }
}
