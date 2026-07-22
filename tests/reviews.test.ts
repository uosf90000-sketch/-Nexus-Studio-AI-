// NEXUS-P2C1-004: Reviews Service Tests
import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from 'vitest'
import { ReviewsService } from '@/modules/reviews/service'
import { prisma } from '@/lib/prisma'
import { mockFetchSuccess, mockFetchError } from './setup'

describe('ReviewsService', () => {
  let service: ReviewsService

  beforeAll(() => {
    service = new ReviewsService()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  async function createTestProject(title: string) {
    const project = await prisma.project.create({
      data: { title: `REVIEWS-TEST-${title}-${Date.now()}`, idea: 'Test idea' },
    })

    const prd = `# ${title} PRD
Features: Test feature`

    await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        type: 'summary_and_prd',
        content: JSON.stringify({ summary: 'Test', shortPrd: prd }),
      },
    })

    return project
  }

  async function createTestTask(projectId: string) {
    return prisma.task.create({
      data: {
        projectId,
        title: 'Test task',
        description: 'Test implementation',
        order: 1,
        status: 'PENDING',
      },
    })
  }

  async function createTestTaskRun(taskId: string, code: string) {
    return prisma.taskRun.create({
      data: {
        taskId,
        status: 'SUCCESS',
        provider: 'claude',
        model: 'claude-sonnet-4-5',
        generatedCode: code,
        inputTokens: 100,
        outputTokens: 200,
      },
    })
  }

  async function cleanupProject(projectId: string) {
    try {
      await prisma.review.deleteMany({
        where: { taskRun: { task: { projectId } } },
      })
      await prisma.taskRun.deleteMany({
        where: { task: { projectId } },
      })
      await prisma.task.deleteMany({ where: { projectId } })
      await prisma.projectDocument.deleteMany({ where: { projectId } })
      await prisma.costEntry.deleteMany({ where: { projectId } })
      await prisma.executionLog.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
    } catch {
      // ignore
    }
  }

  it('should review a TaskRun and save Review', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('ReviewTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(
        task.id,
        `
        model Product {
          id String @id @default(cuid())
          name String
        }
      `
      )

      const result = await service.reviewTaskRun({ taskRunId: taskRun.id })

      expect(result).toHaveProperty('reviewId')
      expect(['APPROVE', 'REQUEST_CHANGES', 'REJECT']).toContain(result.verdict)
      expect(result.summary).toBeTruthy()
      expect(typeof result.worksOnStack).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)

      // Verify Review was saved
      const savedReview = await prisma.review.findUnique({
        where: { id: result.reviewId },
      })
      expect(savedReview).toBeTruthy()
      expect(savedReview?.taskRunId).toBe(taskRun.id)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should save Review with cost tracking', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('CostTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'const x = 1')

      const result = await service.reviewTaskRun({ taskRunId: taskRun.id })

      if (result.cost) {
        expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
        expect(result.cost.inputTokens).toBeGreaterThan(0)
        expect(result.cost.outputTokens).toBeGreaterThan(0)
      }

      // Verify cost was recorded
      const costs = await prisma.costEntry.findMany({
        where: { projectId },
      })
      expect(costs.length).toBeGreaterThan(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should NOT save partial review on generation failure', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('FailTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'some code')

      // Mock provider failure
      mockFetchError(500)

      try {
        await service.reviewTaskRun({ taskRunId: taskRun.id })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Verify Review was marked FAILED without partial data
      const reviews = await prisma.review.findMany({
        where: { taskRunId: taskRun.id },
      })

      expect(reviews.length).toBeGreaterThan(0)
      const failedReview = reviews[0]
      expect(failedReview.verdict).toBe('REJECT')
      expect(failedReview.error).toBeTruthy() // has error message
      expect(failedReview.retryCount).toBe(2) // max 2 attempts
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should detect stack incompatibility (SQLite @@fulltext)', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('StackTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(
        task.id,
        `
        model Product {
          id String @id @default(cuid())
          @@fulltext([name, description])
        }
      `
      )

      const result = await service.reviewTaskRun({ taskRunId: taskRun.id })

      expect(result).toBeDefined()
      // Reviewer should flag this as not working on SQLite
      expect(typeof result.worksOnStack).toBe('boolean')
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should retrieve existing Review', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('RetrieveTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'test code')

      const result = await service.reviewTaskRun({ taskRunId: taskRun.id })

      const retrieved = await service.getReview(result.reviewId)

      expect(retrieved).toBeTruthy()
      expect(retrieved?.verdict).toBe(result.verdict)
      expect(retrieved?.summary).toBe(result.summary)
      expect(retrieved?.taskRunId).toBe(taskRun.id)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should handle non-existent TaskRun', async () => {
    try {
      await service.reviewTaskRun({ taskRunId: 'non-existent-id' })
      expect.fail('Should have thrown error')
    } catch (error) {
      expect(error instanceof Error && error.message).toContain('not found')
    }
  })
})
