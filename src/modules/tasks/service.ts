// NEXUS-P2A-002: Tasks Service
// Manages task generation, storage, and retrieval

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

    logSafe(`TasksService: generating tasks for project ${projectId}`)

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { tasks: true },
    })

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // Delete existing tasks for this project
    if (project.tasks.length > 0) {
      await prisma.task.deleteMany({
        where: { projectId },
      })
      logSafe(`Cleared existing ${project.tasks.length} tasks for project ${projectId}`)
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
      throw new Error(`Failed to generate tasks: ${errorMsg}`)
    }

    // Save tasks to database
    const savedTasks = await Promise.all(
      generatorOutput.tasks.map((task) =>
        prisma.task.create({
          data: {
            projectId,
            title: task.title,
            description: task.description,
            order: task.order,
            status: 'PENDING',
          },
        })
      )
    )

    logSafe(`TasksService: saved ${savedTasks.length} tasks for project ${projectId}`)

    // Record cost entry
    let costData = null
    if (generatorOutput.usage) {
      const inputTokens = generatorOutput.usage.inputTokens
      const outputTokens = generatorOutput.usage.outputTokens

      // Claude pricing (same as Phase 1): ~$3 per 1M input, ~$15 per 1M output
      const estimatedCost = (inputTokens * 3) / 1000000 + (outputTokens * 15) / 1000000

      costData = await prisma.costEntry.create({
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
    await prisma.executionLog.create({
      data: {
        projectId,
        action: 'tasks_generated',
        status: 'success',
        details: JSON.stringify({
          taskCount: savedTasks.length,
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        }),
      },
    })

    return {
      tasks: savedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        order: t.order,
        status: t.status,
      })),
      cost: costData
        ? {
            estimatedCost: costData.estimatedCost,
            inputTokens: costData.inputTokens,
            outputTokens: costData.outputTokens,
            provider: 'claude',
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          }
        : undefined,
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
