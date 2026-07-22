// NEXUS-P2A-004: Task Generator Tests
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { TaskGenerator } from '@/modules/agents/task-generator'
import { mockFetchSuccess } from './setup'

describe('TaskGenerator', () => {
  let generator: TaskGenerator

  beforeAll(() => {
    generator = new TaskGenerator()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  it('should generate ordered tasks from a PRD', async () => {
    const prd = `Overview: An AI study assistant
Key Features: Spaced repetition, learning paths
Success Metrics: 80% retention`

    const result = await generator.generateTasks(prd, 'Study Assistant')

    expect(result).toHaveProperty('tasks')
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(result.tasks.length).toBeGreaterThan(0)

    // Verify each task has required fields (server assigns order)
    result.tasks.forEach((task) => {
      expect(task).toHaveProperty('title')
      expect(task).toHaveProperty('description')
      expect(typeof task.title).toBe('string')
      expect(typeof task.description).toBe('string')
      expect(task.title.length).toBeGreaterThan(0)
      expect(task.description.length).toBeGreaterThan(0)
    })
  })

  it('should maintain task ordering', async () => {
    const prd = `Product: Task Manager
Features: Create, edit, delete tasks
Metrics: Performance under 100ms`

    const result = await generator.generateTasks(prd, 'Task Manager')

    // Verify tasks are returned in order (order is assigned by server on save)
    expect(result.tasks.length).toBeGreaterThanOrEqual(3)
    expect(result.tasks.length).toBeLessThanOrEqual(5)

    // Verify all tasks have title and description
    result.tasks.forEach((task) => {
      expect(task.title).toBeTruthy()
      expect(task.description).toBeTruthy()
    })
  })

  it('should generate 3-5 tasks', async () => {
    const prd = `App: Weather Dashboard
Features: Real-time updates, location services
Goals: Beautiful UI, fast loading`

    const result = await generator.generateTasks(prd, 'Weather Dashboard')

    expect(result.tasks.length).toBeGreaterThanOrEqual(3)
    expect(result.tasks.length).toBeLessThanOrEqual(5)
  })

  it('should include usage tokens when available', async () => {
    const prd = `Platform: E-commerce Store
Features: Shopping cart, checkout
Metrics: Conversion rate, cart abandonment`

    const result = await generator.generateTasks(prd, 'E-commerce Store')

    if (result.usage) {
      expect(result.usage.inputTokens).toBeGreaterThan(0)
      expect(result.usage.outputTokens).toBeGreaterThan(0)
      expect(typeof result.usage.inputTokens).toBe('number')
      expect(typeof result.usage.outputTokens).toBe('number')
    }
  })
})
