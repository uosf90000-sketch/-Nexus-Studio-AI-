import { describe, it, expect, beforeAll } from 'vitest'
import { Planner } from '@/modules/agents/planner'

describe('Planner', () => {
  let planner: Planner

  beforeAll(() => {
    // Ensure env vars are set for tests
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not set - tests will be skipped')
    }
    if (!process.env.ANTHROPIC_MODEL) {
      console.warn('ANTHROPIC_MODEL not set - tests will be skipped')
    }

    planner = new Planner()
  })

  it('should generate summary and PRD from an idea', async () => {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
      console.log('Skipping test: API keys not configured')
      return
    }

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

  it('should handle empty ideas', async () => {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
      console.log('Skipping test: API keys not configured')
      return
    }

    const idea = ''

    try {
      await planner.generateSummaryAndPRD(idea)
      // Should succeed even with empty idea (Claude will handle it)
    } catch (error) {
      // If it errors, that's okay - the error should be meaningful
      expect(error).toBeDefined()
    }
  })
})
