// NEXUS-P2A-005: Tasks Service Tests
import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from 'vitest'
import { TasksService } from '@/modules/tasks/service'
import { prisma } from '@/lib/prisma'
import { mockFetchSuccess } from './setup'

describe('TasksService', () => {
  let service: TasksService

  beforeAll(() => {
    service = new TasksService()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  async function createTestProject(title: string, idea: string) {
    // Add TASKS-TEST- prefix to make titles unique from projects tests
    const uniqueTitle = `TASKS-TEST-${title}-${Date.now()}`
    const project = await prisma.project.create({
      data: { title: uniqueTitle, idea },
    })

    await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        type: 'summary_and_prd',
        content: JSON.stringify({
          summary: 'Test summary',
          shortPrd: `Overview: ${title}
Key Features:
- Feature 1
- Feature 2
- Feature 3

Success Metrics:
- Metric 1: 95% pass
- Metric 2: Fast performance`,
        }),
      },
    })

    return project.id
  }

  async function cleanupProject(projectId: string) {
    try {
      await prisma.task.deleteMany({ where: { projectId } })
      await prisma.projectDocument.deleteMany({ where: { projectId } })
      await prisma.costEntry.deleteMany({ where: { projectId } })
      await prisma.executionLog.deleteMany({ where: { projectId } })
      await prisma.project.deleteMany({ where: { id: projectId } })
    } catch {
      // Ignore cleanup errors
    }
  }

  it('should generate and save tasks from PRD', async () => {
    let projectId: string | null = null
    try {
      projectId = await createTestProject('Test Manager', 'Test idea')

      const prd = `Overview: Test Management Tool
Key Features: Create, organize, run tests
Success Metrics: Performance, coverage`

      const result = await service.generateAndSaveTasks({
        projectId,
        prd,
        projectTitle: 'Test Manager',
      })

      expect(result).toHaveProperty('tasks')
      expect(Array.isArray(result.tasks)).toBe(true)
      expect(result.tasks.length).toBeGreaterThan(0)
      expect(result).toHaveProperty('cost')

      result.tasks.forEach((task) => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('description')
        expect(task).toHaveProperty('order')
        expect(task).toHaveProperty('status')
        expect(task.status).toBe('PENDING')
      })
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should record cost entry', async () => {
    let projectId: string | null = null
    try {
      projectId = await createTestProject('Analytics', 'Analytics idea')

      const prd = `Platform: Analytics Dashboard
Features: Real-time data, visualizations
Metrics: Load time < 1s`

      const result = await service.generateAndSaveTasks({
        projectId,
        prd,
        projectTitle: 'Analytics',
      })

      if (result.cost) {
        expect(result.cost.provider).toBe('claude')
        expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
        expect(result.cost.inputTokens).toBeGreaterThan(0)
        expect(result.cost.outputTokens).toBeGreaterThan(0)
      }

      const costs = await prisma.costEntry.findMany({
        where: { projectId },
      })
      expect(costs.length).toBeGreaterThan(0)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should retrieve tasks for a project', async () => {
    let projectId: string | null = null
    try {
      projectId = await createTestProject('Project Manager', 'PM idea')

      const prd = `App: Project Manager
Features: Task tracking, team collaboration
Goals: Easy to use interface`

      await service.generateAndSaveTasks({
        projectId,
        prd,
        projectTitle: 'Project Manager',
      })

      const tasks = await service.getTasks(projectId)

      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks.length).toBeGreaterThan(0)

      const orders = tasks.map((t) => t.order)
      const sortedOrders = [...orders].sort((a, b) => a - b)
      expect(orders).toEqual(sortedOrders)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should replace existing tasks when generating new ones', async () => {
    let projectId: string | null = null
    try {
      projectId = await createTestProject('System Update', 'System idea')

      const prd1 = `System: Old System
Features: Feature 1, Feature 2`

      const result1 = await service.generateAndSaveTasks({
        projectId,
        prd: prd1,
        projectTitle: 'Old System',
      })

      const prd2 = `System: New System
Features: Feature A, Feature B, Feature C, Feature D`

      const result2 = await service.generateAndSaveTasks({
        projectId,
        prd: prd2,
        projectTitle: 'New System',
      })

      const allTasks = await service.getTasks(projectId)
      expect(allTasks.length).toBe(result2.tasks.length)
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should handle task generation failure gracefully', async () => {
    let projectId: string | null = null
    try {
      projectId = await createTestProject('Failing Project', 'Fail idea')

      global.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: 'API error' }),
            { status: 500 }
          )
        )
      )

      try {
        await service.generateAndSaveTasks({
          projectId,
          prd: 'Invalid PRD',
          projectTitle: 'Failing Project',
        })
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    } finally {
      if (projectId) await cleanupProject(projectId)
    }
  })

  it('should throw error for non-existent project', async () => {
    try {
      await service.generateAndSaveTasks({
        projectId: 'non-existent-id',
        prd: 'Some PRD',
        projectTitle: 'Ghost Project',
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeDefined()
      expect(error instanceof Error).toBe(true)
      expect(error instanceof Error ? error.message : '').toContain('not found')
    }
  })
})
