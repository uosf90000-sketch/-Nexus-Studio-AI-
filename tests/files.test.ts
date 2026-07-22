// NEXUS-P2C2-005: Files Service Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FilesService } from '@/modules/files/service'
import { prisma } from '@/lib/prisma'
import { mockFetchSuccess } from './setup'

describe('FilesService', () => {
  let service: FilesService

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
    service = new FilesService()
  })

  async function createTestProject(title: string) {
    const project = await prisma.project.create({
      data: { title: `FILES-TEST-${title}-${Date.now()}`, idea: 'Test idea' },
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
        title: 'Write database schema file',
        description: 'Create schema for products',
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

  async function createTestReview(taskRunId: string, verdict: string, worksOnStack: boolean) {
    return prisma.review.create({
      data: {
        taskRunId,
        verdict,
        summary: `Test review — ${verdict}`,
        issues: JSON.stringify([]),
        worksOnStack,
        provider: 'claude',
        model: 'claude-sonnet-4-5',
      },
    })
  }

  async function cleanupProject(projectId: string) {
    try {
      await prisma.writtenFile.deleteMany({
        where: {
          taskRun: { task: { projectId } },
        },
      })
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

  it('should write approved TaskRun code to generated/<projectId>/', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('WriteTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(
        task.id,
        `model Product {
  id String @id @default(cuid())
  name String
}`
      )

      await createTestReview(taskRun.id, 'APPROVE', true)

      const result = await service.writeTaskRunFile({ taskRunId: taskRun.id })

      expect(result.success).toBe(true)
      expect(result.writtenFileId).toBeTruthy()
      expect(result.path).toBeTruthy()
      expect(result.path).toContain('generated/')
      expect(result.path).toContain(projectId)

      // Verify WrittenFile was recorded
      const written = await prisma.writtenFile.findUnique({
        where: { id: result.writtenFileId! },
      })
      expect(written).toBeTruthy()
      expect(written?.taskRunId).toBe(taskRun.id)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should REFUSE to write when review verdict is REQUEST_CHANGES', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('RefuseTest1')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'const x = 1')

      await createTestReview(taskRun.id, 'REQUEST_CHANGES', true)

      const result = await service.writeTaskRunFile({ taskRunId: taskRun.id })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot write unapproved code')

      // Verify WrittenFile was NOT created
      const written = await prisma.writtenFile.findMany({
        where: { taskRunId: taskRun.id },
      })
      expect(written.length).toBe(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should REFUSE to write when review verdict is REJECT', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('RefuseTest2')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'const x = 1')

      await createTestReview(taskRun.id, 'REJECT', true)

      const result = await service.writeTaskRunFile({ taskRunId: taskRun.id })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot write unapproved code')

      // Verify WrittenFile was NOT created
      const written = await prisma.writtenFile.findMany({
        where: { taskRunId: taskRun.id },
      })
      expect(written.length).toBe(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should REFUSE to write when worksOnStack is false', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('RefuseTest3')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'const x = 1')

      await createTestReview(taskRun.id, 'APPROVE', false) // worksOnStack: false

      const result = await service.writeTaskRunFile({ taskRunId: taskRun.id })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot write unapproved code')

      // Verify WrittenFile was NOT created
      const written = await prisma.writtenFile.findMany({
        where: { taskRunId: taskRun.id },
      })
      expect(written.length).toBe(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should REFUSE when TaskRun has no review', async () => {
    let projectId: string | null = null

    try {
      const project = await createTestProject('NoReviewTest')
      projectId = project.id

      const task = await createTestTask(projectId)
      const taskRun = await createTestTaskRun(task.id, 'const x = 1')
      // NO review created

      const result = await service.writeTaskRunFile({ taskRunId: taskRun.id })

      expect(result.success).toBe(false)
      expect(result.error).toContain('no review')
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should REFUSE non-existent TaskRun', async () => {
    const result = await service.writeTaskRunFile({ taskRunId: 'non-existent-id' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})
