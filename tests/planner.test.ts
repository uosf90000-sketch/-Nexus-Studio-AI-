import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { Planner } from '@/modules/agents/planner'
import { mockFetchSuccess } from './setup'

describe('Planner', () => {
  let planner: Planner

  beforeAll(() => {
    planner = new Planner()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  it('should generate summary and PRD from an idea', async () => {
    const idea = 'A mobile app that helps users track their daily water intake'

    const result = await planner.generateSummaryAndPRD(idea)

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('shortPrd')
    expect(result.summary).toBeTruthy()
    expect(result.shortPrd).toBeTruthy()
    expect(typeof result.summary).toBe('string')
    expect(typeof result.shortPrd).toBe('string')

    if (result.usage) {
      expect(result.usage.inputTokens).toBeGreaterThan(0)
      expect(result.usage.outputTokens).toBeGreaterThan(0)
    }
  })

  it('should handle different idea lengths', async () => {
    const shortIdea = 'An app'
    const result = await planner.generateSummaryAndPRD(shortIdea)

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('shortPrd')
    expect(result.summary).toBeTruthy()
  })

  it('should return structured PRD output', async () => {
    const idea = 'E-commerce platform for handmade goods'
    const result = await planner.generateSummaryAndPRD(idea)

    expect(result.summary).toBeTruthy()
    expect(result.shortPrd).toBeTruthy()
    expect(result.shortPrd.length).toBeGreaterThan(100)
    // Verify PRD contains expected sections
    expect(result.shortPrd).toContain('Overview')
    expect(result.shortPrd).toContain('Features')
  })

  it('should include usage tokens when available', async () => {
    const idea = 'Social networking app'
    const result = await planner.generateSummaryAndPRD(idea)

    if (result.usage) {
      expect(result.usage.inputTokens).toBeGreaterThan(0)
      expect(result.usage.outputTokens).toBeGreaterThan(0)
      expect(typeof result.usage.inputTokens).toBe('number')
      expect(typeof result.usage.outputTokens).toBe('number')
    }
  })
})
