// NEXUS-P2B-004: Task Runs Service Tests
import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from 'vitest'
import { TaskRunsService } from '@/modules/task-runs/service'
import { prisma } from '@/lib/prisma'
import { mockFetchSuccess, mockFetchError } from './setup'

describe('TaskRunsService', () => {
  let service: TaskRunsService

  beforeAll(() => {
    service = new TaskRunsService()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  async function createTestProject(title: string) {
    const project = await prisma.project.create({
      data: { title: `TASKRUNS-TEST-${title}-${Date.now()}`, idea: 'Test idea' },
    })

    const prd = `# ${title} PRD
Key Features:
- Feature 1
- Feature 2`

    await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        type: 'summary_and_prd',
        content: JSON.stringify({ summary: 'Test', shortPrd: prd }),
      },
    })

    return project
  }

  async function createTestTask(projectId: string, title: string, order: number) {
    return prisma.task.create({
      data: {
        projectId,
        title,
        description: 'Test task description',
        order,
        status: 'PENDING',
      },
    })
  }

  async function cleanupProject(projectId: string) {
    try {
      await prisma.taskRun.deleteMany({ where: { task: { projectId } } })
      await prisma.task.deleteMany({ where: { projectId } })
      await prisma.projectDocument.deleteMany({ where: { projectId } })
      await prisma.costEntry.deleteMany({ where: { projectId } })
      await prisma.executionLog.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
    } catch {
      // ignore
    }
  }

  it('should run a task and generate code', async () => {
    let projectId: string | null = null
    let taskId: string | null = null

    try {
      const project = await createTestProject('CodeGen')
      projectId = project.id

      const task = await createTestTask(projectId, 'Implement product catalog', 1)
      taskId = task.id

      const result = await service.runTask({
        taskId,
        projectId,
      })

      expect(result).toHaveProperty('taskRunId')
      expect(result.status).toBe('SUCCESS')
      expect(result.generatedCode).toBeTruthy()
      expect(typeof result.generatedCode).toBe('string')
      expect(result.generatedCode.length).toBeGreaterThan(0)

      // Verify no file was written
      expect(result.generatedCode).not.toContain('fs.writeFile')
      expect(result.generatedCode).not.toContain('exec(')

      if (result.cost) {
        expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
        expect(result.cost.inputTokens).toBeGreaterThan(0)
      }
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should save TaskRun with code, status, and cost', async () => {
    let projectId: string | null = null
    let taskId: string | null = null

    try {
      const project = await createTestProject('SaveRun')
      projectId = project.id

      const task = await createTestTask(projectId, 'Build API endpoints', 1)
      taskId = task.id

      const result = await service.runTask({
        taskId,
        projectId,
      })

      const savedRun = await prisma.taskRun.findUnique({
        where: { id: result.taskRunId },
      })

      expect(savedRun).toBeTruthy()
      expect(savedRun?.status).toBe('SUCCESS')
      expect(savedRun?.generatedCode).toBeTruthy()
      expect(savedRun?.provider).toBe('claude')
      expect(savedRun?.inputTokens).toBeGreaterThan(0)

      // Verify cost was recorded
      const costs = await prisma.costEntry.findMany({
        where: { projectId },
      })
      expect(costs.length).toBeGreaterThan(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should preserve no code when generation fails', async () => {
    let projectId: string | null = null
    let taskId: string | null = null

    try {
      const project = await createTestProject('FailTest')
      projectId = project.id

      const task = await createTestTask(projectId, 'Failing task', 1)
      taskId = task.id

      // Mock provider failure
      mockFetchError(500)

      try {
        await service.runTask({
          taskId,
          projectId,
        })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Verify TaskRun was marked FAILED without partial code
      const runs = await prisma.taskRun.findMany({
        where: { taskId },
      })

      expect(runs.length).toBeGreaterThan(0)
      const failedRun = runs[0]
      expect(failedRun.status).toBe('FAILED')
      expect(failedRun.generatedCode).toBeFalsy() // No partial code saved
      expect(failedRun.error).toBeTruthy()
      expect(failedRun.retryCount).toBe(2) // Max 2 attempts
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should handle non-existent task', async () => {
    const project = await createTestProject('NoTask')

    try {
      await service.runTask({
        taskId: 'non-existent-id',
        projectId: project.id,
      })
      expect.fail('Should have thrown error')
    } catch (error) {
      expect(error instanceof Error && error.message).toContain('not found')
    } finally {
      await cleanupProject(project.id)
    }
  })

  it('should retrieve generated TaskRun', async () => {
    let projectId: string | null = null
    let taskId: string | null = null

    try {
      const project = await createTestProject('Retrieve')
      projectId = project.id

      const task = await createTestTask(projectId, 'Retrieve test', 1)
      taskId = task.id

      const result = await service.runTask({
        taskId,
        projectId,
      })

      const retrieved = await service.getTaskRun(result.taskRunId)

      expect(retrieved).toBeTruthy()
      expect(retrieved?.status).toBe('SUCCESS')
      expect(retrieved?.generatedCode).toBe(result.generatedCode)
      expect(retrieved?.taskTitle).toBe('Retrieve test')
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })
})
