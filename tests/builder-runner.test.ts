// NEXUS-P6-005: Builder runner tests (all mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildRunner } from '@/modules/builder/runner'
import * as fs from 'fs/promises'
import path from 'path'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    buildRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    buildRound: {
      create: vi.fn(),
    },
  },
}))

// Mock config
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    costs: {
      warningThreshold: 10,
    },
  }),
}))

// Mock Codex adapter
vi.mock('@/lib/adapters/codex-adapter', () => ({
  CodexAdapter: class {
    async audit() {
      return {
        report: {
          verdict: 'APPROVE',
          summary: 'Code looks good',
          issues: [],
          runsCorrectly: true,
          securityConcerns: [],
        },
        inputTokens: 500,
        outputTokens: 200,
        cost: 0.5,
      }
    }
    getProvider() {
      return 'openai'
    }
    getModel() {
      return 'gpt-4o'
    }
  },
}))

// Mock fs
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  }
})

describe('BuildRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a build run and get approval', async () => {
    const { prisma } = await import('@/lib/prisma')
    const workspacePath = path.join(process.cwd(), 'workspaces', 'proj-1')

    vi.mocked(prisma.buildRun.create).mockResolvedValue({
      id: 'build-1',
      projectId: 'proj-1',
      status: 'RUNNING',
      workspacePath,
      rounds: 0,
      totalCost: 0,
      startedAt: new Date(),
      finishedAt: null,
    })

    vi.mocked(prisma.buildRound.create).mockResolvedValue({
      id: 'round-1',
      buildRunId: 'build-1',
      roundNumber: 1,
      builderOutput: '{}',
      auditVerdict: 'APPROVE',
      auditIssues: '[]',
      runsCorrectly: true,
      cost: 0.5,
      createdAt: new Date(),
    })

    vi.mocked(prisma.buildRun.update).mockResolvedValue({
      id: 'build-1',
      projectId: 'proj-1',
      status: 'APPROVED',
      workspacePath,
      rounds: 1,
      totalCost: 0.5,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    const runner = new BuildRunner('proj-1', workspacePath, { maxRounds: 3 })
    const result = await runner.run('Build an app', 'PRD content')

    expect(result.status).toBe('APPROVED')
    expect(result.rounds).toBe(1)
    expect(result.cost).toBeGreaterThan(0)
  })

  it('should respect cost threshold', async () => {
    const { prisma } = await import('@/lib/prisma')
    const workspacePath = path.join(process.cwd(), 'workspaces', 'proj-2')

    vi.mocked(prisma.buildRun.create).mockResolvedValue({
      id: 'build-2',
      projectId: 'proj-2',
      status: 'RUNNING',
      workspacePath,
      rounds: 0,
      totalCost: 0,
      startedAt: new Date(),
      finishedAt: null,
    })

    // Return expensive audit result
    vi.mocked(prisma.buildRound.create).mockResolvedValue({
      id: 'round-2',
      buildRunId: 'build-2',
      roundNumber: 1,
      builderOutput: '{}',
      auditVerdict: 'REQUEST_CHANGES',
      auditIssues: '[]',
      runsCorrectly: false,
      cost: 15.0, // Over the 10.0 threshold
      createdAt: new Date(),
    })

    vi.mocked(prisma.buildRun.update).mockResolvedValue({
      id: 'build-2',
      projectId: 'proj-2',
      status: 'FAILED',
      workspacePath,
      rounds: 1,
      totalCost: 15.0,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    // Mock expensive Codex
    const { CodexAdapter } = await import('@/lib/adapters/codex-adapter')
    vi.spyOn(CodexAdapter.prototype, 'audit').mockResolvedValue({
      report: {
        verdict: 'REQUEST_CHANGES',
        summary: 'Needs work',
        issues: [],
        runsCorrectly: false,
      },
      inputTokens: 100000,
      outputTokens: 100000,
      cost: 15.0,
    })

    const runner = new BuildRunner('proj-2', workspacePath, { maxRounds: 3, maxCostUSD: 10 })

    await expect(runner.run('Build an app', 'PRD')).rejects.toThrow('Cost threshold exceeded')
  })

  it('should exhaust rounds and return NEEDS_HUMAN', async () => {
    const { prisma } = await import('@/lib/prisma')
    const workspacePath = path.join(process.cwd(), 'workspaces', 'proj-3')

    vi.mocked(prisma.buildRun.create).mockResolvedValue({
      id: 'build-3',
      projectId: 'proj-3',
      status: 'RUNNING',
      workspacePath,
      rounds: 0,
      totalCost: 0,
      startedAt: new Date(),
      finishedAt: null,
    })

    // Always return REQUEST_CHANGES
    const { CodexAdapter } = await import('@/lib/adapters/codex-adapter')
    vi.spyOn(CodexAdapter.prototype, 'audit').mockResolvedValue({
      report: {
        verdict: 'REQUEST_CHANGES',
        summary: 'Still needs work',
        issues: [{ severity: 'MEDIUM', description: 'Issue remains' }],
        runsCorrectly: false,
      },
      inputTokens: 500,
      outputTokens: 200,
      cost: 0.5,
    })

    vi.mocked(prisma.buildRound.create).mockResolvedValue({
      id: 'round-3',
      buildRunId: 'build-3',
      roundNumber: 1,
      builderOutput: '{}',
      auditVerdict: 'REQUEST_CHANGES',
      auditIssues: '[]',
      runsCorrectly: false,
      cost: 0.5,
      createdAt: new Date(),
    })

    vi.mocked(prisma.buildRun.update).mockResolvedValue({
      id: 'build-3',
      projectId: 'proj-3',
      status: 'NEEDS_HUMAN',
      workspacePath,
      rounds: 2,
      totalCost: 1.0,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    const runner = new BuildRunner('proj-3', workspacePath, { maxRounds: 2 })
    const result = await runner.run('Build an app', 'PRD')

    expect(result.status).toBe('NEEDS_HUMAN')
    expect(result.rounds).toBe(2)
  })

  it('should reject if workspace escapes root', async () => {
    const runner = new BuildRunner('proj-4', '/etc/passwd', { maxRounds: 1 })

    await expect(runner.run('Build an app', 'PRD')).rejects.toThrow('Workspace path escapes project root')
  })
})
