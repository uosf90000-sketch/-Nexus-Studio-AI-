// NEXUS-P7-006: Deployment Orchestrator tests (all mocked)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeploymentOrchestrator } from '@/modules/deployer/orchestrator'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    buildRun: {
      findUnique: vi.fn(),
    },
    deployment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock GitHub creator
vi.mock('@/modules/deployer/github-creator', () => ({
  GitHubRepoCreator: class {
    constructor(projectId: string, workspacePath: string) {
      this.projectId = projectId
      this.workspacePath = workspacePath
    }
    async createAndPush() {
      return {
        repo: 'nexus-studio/nexus-build-proj-1-123456',
        url: 'https://github.com/nexus-studio/nexus-build-proj-1-123456',
      }
    }
  },
}))

// Mock Railway deployer
vi.mock('@/modules/deployer/railway-deployer', () => ({
  RailwayDeployer: class {
    constructor(projectId: string, githubRepo: string) {
      this.projectId = projectId
      this.githubRepo = githubRepo
    }
    async createProjectAndService() {
      return {
        projectId: 'proj_proj-1_123456',
        serviceId: 'svc_proj-1_123456',
      }
    }
    async deploy() {
      return {
        deploymentId: 'deploy_svc_proj-1_123456_123456',
      }
    }
    async waitForLiveUrl() {
      return 'https://svc_proj-1_123456.up.railway.app'
    }
  },
}))

// Mock fs
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    stat: vi.fn(),
  }
})

describe('DeploymentOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should deploy approved build to Railway with live URL', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.buildRun.findUnique).mockResolvedValue({
      id: 'build-1',
      projectId: 'proj-1',
      status: 'APPROVED',
      workspacePath: '/workspaces/proj-1',
      rounds: 1,
      totalCost: 0.5,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    vi.mocked(prisma.deployment.create).mockResolvedValue({
      id: 'deploy-1',
      projectId: 'proj-1',
      buildRunId: 'build-1',
      status: 'PENDING',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.deployment.update).mockResolvedValue({
      id: 'deploy-1',
      projectId: 'proj-1',
      buildRunId: 'build-1',
      status: 'LIVE',
      githubRepo: 'nexus-studio/nexus-build-proj-1-123456',
      githubRepoUrl: 'https://github.com/nexus-studio/nexus-build-proj-1-123456',
      railwayProjectId: 'proj_proj-1_123456',
      railwayServiceId: 'svc_proj-1_123456',
      deploymentId: 'deploy_svc_proj-1_123456_123456',
      liveUrl: 'https://svc_proj-1_123456.up.railway.app',
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const orchestrator = new DeploymentOrchestrator('proj-1', 'build-1')
    const result = await orchestrator.deploy()

    expect(result.status).toBe('LIVE')
    expect(result.liveUrl).toBe('https://svc_proj-1_123456.up.railway.app')
  })

  it('should reject non-approved builds', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.buildRun.findUnique).mockResolvedValue({
      id: 'build-2',
      projectId: 'proj-2',
      status: 'NEEDS_HUMAN',
      workspacePath: '/workspaces/proj-2',
      rounds: 3,
      totalCost: 2.5,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    vi.mocked(prisma.deployment.create).mockResolvedValue({
      id: 'deploy-2',
      projectId: 'proj-2',
      buildRunId: 'build-2',
      status: 'PENDING',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.deployment.update).mockResolvedValue({
      id: 'deploy-2',
      projectId: 'proj-2',
      buildRunId: 'build-2',
      status: 'FAILED',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const orchestrator = new DeploymentOrchestrator('proj-2', 'build-2')

    await expect(orchestrator.deploy()).rejects.toThrow('Cannot deploy: build status is NEEDS_HUMAN')
  })

  it('should handle missing build run gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.buildRun.findUnique).mockResolvedValue(null)

    vi.mocked(prisma.deployment.create).mockResolvedValue({
      id: 'deploy-3',
      projectId: 'proj-3',
      buildRunId: 'build-3',
      status: 'PENDING',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.deployment.update).mockResolvedValue({
      id: 'deploy-3',
      projectId: 'proj-3',
      buildRunId: 'build-3',
      status: 'FAILED',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const orchestrator = new DeploymentOrchestrator('proj-3', 'build-3')

    await expect(orchestrator.deploy()).rejects.toThrow('Build run not found')
  })

  it('should handle deployment workflow with all stages', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.buildRun.findUnique).mockResolvedValue({
      id: 'build-4',
      projectId: 'proj-4',
      status: 'APPROVED',
      workspacePath: '/workspaces/proj-4',
      rounds: 1,
      totalCost: 0.5,
      startedAt: new Date(),
      finishedAt: new Date(),
    })

    vi.mocked(prisma.deployment.create).mockResolvedValue({
      id: 'deploy-4',
      projectId: 'proj-4',
      buildRunId: 'build-4',
      status: 'PENDING',
      githubRepo: null,
      githubRepoUrl: null,
      railwayProjectId: null,
      railwayServiceId: null,
      deploymentId: null,
      liveUrl: null,
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.deployment.update).mockResolvedValue({
      id: 'deploy-4',
      projectId: 'proj-4',
      buildRunId: 'build-4',
      status: 'LIVE',
      githubRepo: 'nexus-studio/nexus-build-proj-1-123456',
      githubRepoUrl: 'https://github.com/nexus-studio/nexus-build-proj-1-123456',
      railwayProjectId: 'proj_proj-1_123456',
      railwayServiceId: 'svc_proj-1_123456',
      deploymentId: 'deploy_svc_proj-1_123456_123456',
      liveUrl: 'https://svc_proj-1_123456.up.railway.app',
      errorLog: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const orchestrator = new DeploymentOrchestrator('proj-4', 'build-4')
    const result = await orchestrator.deploy()

    expect(result.status).toBe('LIVE')
    expect(result.liveUrl).toContain('up.railway.app')
  })
})
