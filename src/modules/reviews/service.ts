// NEXUS-P2C1-002: Reviews Service
// Manages review execution: read generated code from TaskRun, generate review, save Review record
// CRITICAL: Never modifies code, never writes files, never executes. Stores review as TEXT in DB only.

import { prisma } from '@/lib/prisma'
import { Reviewer } from '@/modules/agents/reviewer'
import { logSafe } from '@/lib/redact'

interface ReviewTaskRunInput {
  taskRunId: string
}

interface ReviewResponse {
  reviewId: string
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'
  summary: string
  issues: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; description: string }>
  worksOnStack: boolean
  cost?: {
    estimatedCost: number
    inputTokens: number
    outputTokens: number
    provider: string
    model: string
  }
}

export class ReviewsService {
  private reviewer = new Reviewer()

  async reviewTaskRun(input: ReviewTaskRunInput): Promise<ReviewResponse> {
    const { taskRunId } = input
    const startTime = Date.now()

    logSafe(`ReviewsService: reviewing TaskRun ${taskRunId}`)

    // Verify TaskRun exists with generated code
    const taskRun = await prisma.taskRun.findUnique({
      where: { id: taskRunId },
      include: {
        task: {
          include: { project: { include: { documents: true } } },
        },
      },
    })

    if (!taskRun) {
      throw new Error(`TaskRun ${taskRunId} not found`)
    }

    if (!taskRun.generatedCode) {
      throw new Error(`TaskRun ${taskRunId} has no generated code to review`)
    }

    // Get PRD from project
    const prdDoc = taskRun.task.project.documents.find((d) => d.type === 'summary_and_prd')
    let prdContent = ''
    if (prdDoc) {
      try {
        const parsed = JSON.parse(prdDoc.content)
        prdContent = parsed.shortPrd || parsed.summary || ''
      } catch {
        prdContent = prdDoc.content
      }
    }

    if (!prdContent) {
      throw new Error(`No PRD found for project ${taskRun.task.projectId}`)
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { taskRunId },
    })

    if (existingReview) {
      logSafe(`ReviewsService: review already exists for TaskRun ${taskRunId}`)
      return {
        reviewId: existingReview.id,
        verdict: existingReview.verdict as 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT',
        summary: existingReview.summary,
        issues: existingReview.issues ? JSON.parse(existingReview.issues) : [],
        worksOnStack: existingReview.worksOnStack,
        cost: existingReview.estimatedCost
          ? {
              estimatedCost: existingReview.estimatedCost,
              inputTokens: existingReview.inputTokens || 0,
              outputTokens: existingReview.outputTokens || 0,
              provider: existingReview.provider,
              model: existingReview.model,
            }
          : undefined,
      }
    }

    // Create Review record in PENDING state
    let review = await prisma.review.create({
      data: {
        taskRunId,
        verdict: 'APPROVE', // placeholder, will be updated
        summary: 'Generating review...',
        worksOnStack: false, // placeholder, will be updated
        provider: 'claude',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        retryCount: 0,
      },
    })

    logSafe(`ReviewsService: created Review ${review.id}`)

    // Generate review with retry logic (max 2 attempts)
    let reviewerOutput: Awaited<ReturnType<InstanceType<typeof Reviewer>['reviewCode']>> | null = null
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        logSafe(`ReviewsService: reviewer attempt ${attempt}/2 for TaskRun ${taskRunId}`)

        review = await prisma.review.update({
          where: { id: review.id },
          data: { retryCount: attempt },
        })

        reviewerOutput = await this.reviewer.reviewCode({
          generatedCode: taskRun.generatedCode,
          taskTitle: taskRun.task.title,
          taskDescription: taskRun.task.description,
          prdContent,
          projectTitle: taskRun.task.project.title,
          projectStack: 'Next.js + Prisma + SQLite',
        })

        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (attempt < 2) {
          logSafe(`ReviewsService: attempt ${attempt} failed, retrying...`)
        }
      }
    }

    // Handle review generation failure
    if (!reviewerOutput) {
      const errorMsg = lastError?.message || 'Failed to generate review after 2 attempts'
      logSafe(`ReviewsService: review generation failed: ${errorMsg}`)

      review = await prisma.review.update({
        where: { id: review.id },
        data: {
          verdict: 'REJECT',
          summary: `Review generation failed: ${errorMsg}`,
          error: errorMsg,
        },
      })

      // Log failure
      await prisma.executionLog.create({
        data: {
          projectId: taskRun.task.projectId,
          action: 'review_generated',
          status: 'failed',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          retryCount: 2,
          elapsedMs: Date.now() - startTime,
          error: errorMsg,
        },
      })

      throw new Error(`Failed to generate review: ${errorMsg}`)
    }

    // Save review
    const elapsedMs = Date.now() - startTime
    const inputTokens = reviewerOutput.usage?.inputTokens || 0
    const outputTokens = reviewerOutput.usage?.outputTokens || 0
    const estimatedCost = (inputTokens * 3) / 1000000 + (outputTokens * 15) / 1000000

    try {
      review = await prisma.review.update({
        where: { id: review.id },
        data: {
          verdict: reviewerOutput.verdict,
          summary: reviewerOutput.summary,
          issues: JSON.stringify(reviewerOutput.issues),
          worksOnStack: reviewerOutput.worksOnStack,
          inputTokens,
          outputTokens,
          estimatedCost,
        },
      })

      logSafe(`ReviewsService: saved review for TaskRun ${taskRunId} — ${reviewerOutput.verdict}`)

      // Record cost entry
      if (inputTokens > 0 || outputTokens > 0) {
        await prisma.costEntry.create({
          data: {
            projectId: taskRun.task.projectId,
            provider: 'claude',
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
            inputTokens,
            outputTokens,
            estimatedCost,
          },
        })

        logSafe(`ReviewsService: cost recorded: $${estimatedCost.toFixed(6)}`)
      }

      // Log success
      await prisma.executionLog.create({
        data: {
          projectId: taskRun.task.projectId,
          action: 'review_generated',
          status: 'success',
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          retryCount: 1,
          elapsedMs,
          generatedCount: 1,
        },
      })

      return {
        reviewId: review.id,
        verdict: reviewerOutput.verdict,
        summary: reviewerOutput.summary,
        issues: reviewerOutput.issues,
        worksOnStack: reviewerOutput.worksOnStack,
        cost: {
          estimatedCost,
          inputTokens,
          outputTokens,
          provider: 'claude',
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save review'
      logSafe(`ReviewsService: failed to save: ${errorMsg}`)

      // Mark as failed without saving partial review
      await prisma.review.update({
        where: { id: review.id },
        data: {
          verdict: 'REJECT',
          summary: `Failed to save review: ${errorMsg}`,
          error: errorMsg,
        },
      })

      throw new Error(`Failed to save review: ${errorMsg}`)
    }
  }

  async getReview(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { taskRun: { include: { task: true } } },
    })

    if (!review) {
      return null
    }

    return {
      id: review.id,
      taskRunId: review.taskRunId,
      taskTitle: review.taskRun.task.title,
      verdict: review.verdict,
      summary: review.summary,
      issues: review.issues ? JSON.parse(review.issues) : [],
      worksOnStack: review.worksOnStack,
      provider: review.provider,
      model: review.model,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
      estimatedCost: review.estimatedCost,
      error: review.error,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }
  }
}
