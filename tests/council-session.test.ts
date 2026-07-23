// NEXUS-P5-010: Council session tests (all mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CouncilSession } from '@/modules/council/session'
import * as adaptersModule from '@/lib/adapters'
import { AgentAdapter, AgentRequest, AgentResponse } from '@/lib/adapters/types'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    councilSession: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    councilMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Mock config
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    costs: {
      warningThreshold: 5,
    },
  }),
}))

// Create mock adapters
const createMockAdapter = (role: string): AgentAdapter => ({
  call: vi.fn(async (request: AgentRequest): Promise<AgentResponse> => {
    const responses: Record<string, string> = {
      ANALYST: 'There is market demand for this. Competitors exist but differentiation is possible.',
      ENGINEER:
        'Technically feasible. Effort estimate: 2 weeks for MVP. No major risks. Stack: React Native.',
      DIRECTOR: '{"verdict": "PROCEED", "reason": "Market demand is real and team can build it quickly."}',
    }

    return {
      content: responses[role] || 'Response',
      inputTokens: 100,
      outputTokens: 150,
      cost: 0.5,
      provider: 'mock',
      model: 'mock-model',
    }
  }),
  getProvider: () => 'mock',
  getModel: () => 'mock-model',
})

describe('CouncilSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock adapters
    vi.spyOn(adaptersModule, 'getAdapter').mockImplementation((role) => {
      return createMockAdapter(role)
    })
  })

  it('should create a council session', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.councilSession.create).mockResolvedValue({
      id: 'session-1',
      projectId: 'project-1',
      status: 'ACTIVE',
      verdict: null,
      verdictReason: null,
      totalCost: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.councilMessage.create).mockResolvedValue({
      id: 'msg-1',
      sessionId: 'session-1',
      round: 1,
      role: 'ANALYST',
      provider: 'mock',
      model: 'mock-model',
      content: 'Mock response',
      inputTokens: 100,
      outputTokens: 150,
      cost: 0.5,
      order: 0,
      createdAt: new Date(),
    })

    vi.mocked(prisma.councilMessage.findMany).mockResolvedValue([])

    vi.mocked(prisma.councilSession.update).mockResolvedValue({
      id: 'session-1',
      projectId: 'project-1',
      status: 'COMPLETED',
      verdict: 'PROCEED',
      verdictReason: 'Market demand is real',
      totalCost: 1.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const session = new CouncilSession('project-1', 'Build a mobile app for productivity', { maxRounds: 1 })
    const result = await session.run()

    expect(result.verdict).toBe('PROCEED')
    expect(result.cost).toBeGreaterThan(0)
  })

  it('should respect cost threshold', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.councilSession.create).mockResolvedValue({
      id: 'session-2',
      projectId: 'project-2',
      status: 'ACTIVE',
      verdict: null,
      verdictReason: null,
      totalCost: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create adapter that returns high cost
    const expensiveAdapter: AgentAdapter = {
      call: vi.fn(async () => ({
        content: 'Mock response',
        inputTokens: 100000,
        outputTokens: 100000,
        cost: 10.0, // Over the 5.0 threshold
        provider: 'mock',
        model: 'mock-model',
      })),
      getProvider: () => 'mock',
      getModel: () => 'mock-model',
    }

    vi.spyOn(adaptersModule, 'getAdapter').mockReturnValue(expensiveAdapter)
    vi.mocked(prisma.councilMessage.create).mockResolvedValue({
      id: 'msg-2',
      sessionId: 'session-2',
      round: 1,
      role: 'ANALYST',
      provider: 'mock',
      model: 'mock-model',
      content: 'Expensive response',
      inputTokens: 100000,
      outputTokens: 100000,
      cost: 10.0,
      order: 0,
      createdAt: new Date(),
    })

    vi.mocked(prisma.councilMessage.findMany).mockResolvedValue([])
    vi.mocked(prisma.councilSession.update).mockResolvedValue({
      id: 'session-2',
      projectId: 'project-2',
      status: 'FAILED',
      verdict: null,
      verdictReason: 'Cost threshold exceeded',
      totalCost: 10.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const session = new CouncilSession('project-2', 'Another idea', { maxRounds: 1, maxCostUSD: 5 })

    await expect(session.run()).rejects.toThrow('Cost threshold exceeded')
  })

  it('should record all three council members', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockMessages: any[] = []
    vi.mocked(prisma.councilSession.create).mockResolvedValue({
      id: 'session-3',
      projectId: 'project-3',
      status: 'ACTIVE',
      verdict: null,
      verdictReason: null,
      totalCost: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.councilMessage.create).mockImplementation(async ({ data }) => {
      const msg = { ...data, id: `msg-${mockMessages.length}`, createdAt: new Date() }
      mockMessages.push(msg)
      return msg as any
    })

    vi.mocked(prisma.councilMessage.findMany).mockResolvedValue([])
    vi.mocked(prisma.councilSession.update).mockResolvedValue({
      id: 'session-3',
      projectId: 'project-3',
      status: 'COMPLETED',
      verdict: 'PROCEED',
      verdictReason: 'Good idea',
      totalCost: 1.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const session = new CouncilSession('project-3', 'An idea', { maxRounds: 1 })
    await session.run()

    // Should have messages from all three roles in round 1
    const round1Roles = mockMessages.filter((m) => m.round === 1).map((m) => m.role)
    expect(round1Roles).toContain('ANALYST')
    expect(round1Roles).toContain('ENGINEER')
    expect(round1Roles).toContain('DIRECTOR')
  })
})
