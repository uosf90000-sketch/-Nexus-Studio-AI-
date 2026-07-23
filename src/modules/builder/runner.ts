// NEXUS-P6-003: Build Runner - orchestrates builder and auditor

import { prisma } from '@/lib/prisma'
import { CodexAdapter, AuditReport } from '@/lib/adapters/codex-adapter'
import path from 'path'
import fs from 'fs/promises'
import { getConfig } from '@/lib/config'

interface BuilderOutput {
  files: Array<{
    path: string
    content: string
  }>
  testsPassed: boolean
  buildOutput: string
  errors: string[]
}

export class BuildRunner {
  private projectId: string
  private buildRunId: string
  private workspacePath: string
  private config: { maxRounds: number; maxCostUSD: number }
  private totalCost: number = 0
  private codex: CodexAdapter

  constructor(projectId: string, workspacePath: string, config: Partial<{ maxRounds: number; maxCostUSD: number }> = {}) {
    this.projectId = projectId
    this.workspacePath = workspacePath
    this.buildRunId = ''
    this.config = {
      maxRounds: config.maxRounds || 3,
      maxCostUSD: config.maxCostUSD || getConfig().costs.warningThreshold,
    }
    this.codex = new CodexAdapter()
  }

  async run(projectDescription: string, prdContent: string): Promise<{ status: string; cost: number; rounds: number }> {
    // Create build run record
    const buildRun = await prisma.buildRun.create({
      data: {
        projectId: this.projectId,
        workspacePath: this.workspacePath,
        status: 'RUNNING',
        totalCost: 0,
      },
    })
    this.buildRunId = buildRun.id

    // Validate workspace is isolated
    const workspaceRealPath = path.resolve(this.workspacePath)
    const projectRoot = path.resolve(process.cwd())
    if (!workspaceRealPath.startsWith(projectRoot)) {
      await this.updateBuildRun('FAILED', 1)
      throw new Error('Workspace path escapes project root')
    }

    // Ensure workspace directory exists
    await fs.mkdir(this.workspacePath, { recursive: true })

    try {
      // Conduct build rounds
      for (let round = 1; round <= this.config.maxRounds; round++) {
        const result = await this.conductRound(round, projectDescription, prdContent)

        if (result.verdict === 'APPROVE') {
          await this.updateBuildRun('APPROVED', round)
          return {
            status: 'APPROVED',
            cost: this.totalCost,
            rounds: round,
          }
        }

        if (result.verdict === 'REJECT') {
          await this.updateBuildRun('NEEDS_HUMAN', round)
          return {
            status: 'NEEDS_HUMAN',
            cost: this.totalCost,
            rounds: round,
          }
        }

        // REQUEST_CHANGES - continue to next round

        if (this.totalCost > this.config.maxCostUSD) {
          await this.updateBuildRun('FAILED', round)
          throw new Error(`Cost threshold exceeded ($${this.totalCost.toFixed(2)} > $${this.config.maxCostUSD})`)
        }
      }

      // Exhausted rounds
      await this.updateBuildRun('NEEDS_HUMAN', this.config.maxRounds)
      return {
        status: 'NEEDS_HUMAN',
        cost: this.totalCost,
        rounds: this.config.maxRounds,
      }
    } catch (error) {
      await this.updateBuildRun('FAILED', 1)
      throw error
    }
  }

  private async conductRound(roundNumber: number, projectDescription: string, prdContent: string): Promise<{ verdict: string }> {
    // Simulate builder output
    const builderOutput = await this.simulateBuilderOutput(roundNumber)

    // Get audit from Codex
    const auditResult = await this.codex.audit({
      projectDescription,
      prdContent,
      filesGenerated: builderOutput.files,
      testResults: builderOutput.buildOutput,
      buildLog: builderOutput.buildOutput,
    })

    this.totalCost += auditResult.cost

    // Save round result
    await prisma.buildRound.create({
      data: {
        buildRunId: this.buildRunId,
        roundNumber,
        builderOutput: JSON.stringify(builderOutput),
        auditVerdict: auditResult.report.verdict,
        auditIssues: JSON.stringify(auditResult.report.issues),
        runsCorrectly: auditResult.report.runsCorrectly,
        cost: auditResult.cost,
      },
    })

    return {
      verdict: auditResult.report.verdict,
    }
  }

  private async simulateBuilderOutput(roundNumber: number): Promise<BuilderOutput> {
    // Placeholder: simulate builder creating files
    return {
      files: [
        {
          path: 'src/app/page.tsx',
          content: `// Generated round ${roundNumber}\nexport default function Home() {\n  return <div>Hello World</div>\n}`,
        },
      ],
      testsPassed: true,
      buildOutput: `Round ${roundNumber}: Build successful`,
      errors: [],
    }
  }

  private async updateBuildRun(status: string, rounds: number): Promise<void> {
    await prisma.buildRun.update({
      where: { id: this.buildRunId },
      data: {
        status,
        rounds,
        totalCost: this.totalCost,
        finishedAt: new Date(),
      },
    })
  }
}
