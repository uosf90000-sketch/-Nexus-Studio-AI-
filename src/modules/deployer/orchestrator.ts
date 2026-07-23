// NEXUS-P7-002: Deployment Orchestrator

import { prisma } from '@/lib/prisma'
import { GitHubRepoCreator } from './github-creator'
import { RailwayDeployer } from './railway-deployer'
import path from 'path'

export class DeploymentOrchestrator {
  private projectId: string
  private buildRunId: string
  private deploymentId: string
  private errorLog: Array<{ timestamp: string; stage: string; message: string }> = []

  constructor(projectId: string, buildRunId: string) {
    this.projectId = projectId
    this.buildRunId = buildRunId
    this.deploymentId = ''
  }

  async deploy(): Promise<{ status: string; liveUrl: string | null }> {
    try {
      // Get BuildRun
      const buildRun = await prisma.buildRun.findUnique({
        where: { id: this.buildRunId },
      })

      if (!buildRun) {
        throw new Error('Build run not found')
      }

      if (buildRun.status !== 'APPROVED') {
        throw new Error(`Cannot deploy: build status is ${buildRun.status}, expected APPROVED`)
      }

      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          projectId: this.projectId,
          buildRunId: this.buildRunId,
          status: 'PENDING',
        },
      })
      this.deploymentId = deployment.id

      // Stage 1: Create GitHub repo
      await this.updateStatus('CREATING_REPO')
      const githubCreator = new GitHubRepoCreator(this.projectId, buildRun.workspacePath)
      const repoResult = await githubCreator.createAndPush()

      await prisma.deployment.update({
        where: { id: this.deploymentId },
        data: {
          githubRepo: repoResult.repo,
          githubRepoUrl: repoResult.url,
        },
      })

      // Stage 2: Create Railway project and service
      await this.updateStatus('CREATING_RAILWAY')
      const railwayDeployer = new RailwayDeployer(this.projectId, repoResult.repo)
      const railwayResult = await railwayDeployer.createProjectAndService()

      await prisma.deployment.update({
        where: { id: this.deploymentId },
        data: {
          railwayProjectId: railwayResult.projectId,
          railwayServiceId: railwayResult.serviceId,
        },
      })

      // Stage 3: Deploy
      await this.updateStatus('DEPLOYING')
      const deployResult = await railwayDeployer.deploy()

      await prisma.deployment.update({
        where: { id: this.deploymentId },
        data: {
          deploymentId: deployResult.deploymentId,
        },
      })

      // Stage 4: Wait for live URL
      const liveUrl = await railwayDeployer.waitForLiveUrl(deployResult.deploymentId)

      // Stage 5: Mark as live
      await this.updateStatus('LIVE')
      await prisma.deployment.update({
        where: { id: this.deploymentId },
        data: {
          liveUrl,
          status: 'LIVE',
        },
      })

      return {
        status: 'LIVE',
        liveUrl,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.logError('deployment', errorMsg)
      await this.updateStatus('FAILED')
      throw error
    }
  }

  private async updateStatus(stage: string): Promise<void> {
    await prisma.deployment.update({
      where: { id: this.deploymentId },
      data: {
        status: stage,
      },
    })
  }

  private logError(stage: string, message: string): void {
    this.errorLog.push({
      timestamp: new Date().toISOString(),
      stage,
      message,
    })
  }
}
