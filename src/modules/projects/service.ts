// NEXUS-P1-008: Projects service
// Handles project creation, document storage, and cost tracking.

import { prisma } from '@/lib/prisma'
import { logSafe } from '@/lib/redact'
import { Planner } from '@/modules/agents/planner'
import type { Project, ProjectDocument } from '@prisma/client'

interface CreateProjectInput {
  title: string
  idea: string
}

interface ProjectWithDocuments extends Project {
  documents: ProjectDocument[]
}

export class ProjectsService {
  private planner = new Planner()

  async createProject(input: CreateProjectInput): Promise<{
    project: ProjectWithDocuments
    cost?: {
      estimatedCost: number
      actualCost?: number
    }
  }> {
    logSafe(`Creating project: ${input.title}`)

    // Create project
    const project = await prisma.project.create({
      data: {
        title: input.title,
        idea: input.idea,
      },
      include: {
        documents: true,
      },
    })

    try {
      // Generate summary + PRD
      logSafe('Planner generating summary and PRD')
      const plannerResult = await this.planner.generateSummaryAndPRD(input.idea)

      // Save as document
      const doc = await prisma.projectDocument.create({
        data: {
          projectId: project.id,
          type: 'summary_and_prd',
          content: JSON.stringify({
            summary: plannerResult.summary,
            shortPrd: plannerResult.shortPrd,
            generatedAt: new Date().toISOString(),
          }),
        },
      })

      // Log cost
      if (plannerResult.usage) {
        const costEstimate = (plannerResult.usage.inputTokens / 1_000_000) * 3 +
                            (plannerResult.usage.outputTokens / 1_000_000) * 15

        await prisma.costEntry.create({
          data: {
            projectId: project.id,
            provider: 'claude',
            model: process.env.ANTHROPIC_MODEL || 'unknown',
            inputTokens: plannerResult.usage.inputTokens,
            outputTokens: plannerResult.usage.outputTokens,
            estimatedCost: costEstimate,
            actualCost: costEstimate,
          },
        })

        logSafe(`Cost recorded: $${costEstimate.toFixed(4)}`)
      }

      // Log execution
      await prisma.executionLog.create({
        data: {
          projectId: project.id,
          action: 'plan_created',
          status: 'success',
          details: JSON.stringify({
            documentId: doc.id,
            summaryLength: plannerResult.summary.length,
            prdLength: plannerResult.shortPrd.length,
          }),
        },
      })

      return {
        project: {
          ...project,
          documents: [...project.documents, doc],
        },
        cost: {
          estimatedCost: plannerResult.usage ?
            (plannerResult.usage.inputTokens / 1_000_000) * 3 +
            (plannerResult.usage.outputTokens / 1_000_000) * 15 : 0,
        },
      }
    } catch (error) {
      // Log failure
      await prisma.executionLog.create({
        data: {
          projectId: project.id,
          action: 'plan_created',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      throw error
    }
  }

  async getProject(projectId: string): Promise<ProjectWithDocuments | null> {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        documents: true,
      },
    })
  }

  async listProjects(): Promise<ProjectWithDocuments[]> {
    return prisma.project.findMany({
      include: {
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
