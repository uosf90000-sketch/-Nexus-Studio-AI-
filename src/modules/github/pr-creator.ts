// NEXUS-P2C3B-001: Pull Request Creator Service
// Opens a PR on an approved, pushed branch from an output repo
// Enforces all 8 absolute rules from §2

import { prisma } from '@/lib/prisma'
import { GitHubAdapter } from '@/lib/github-adapter'
import { logSafe } from '@/lib/redact'

interface CreatePullRequestInput {
  gitPushId: string
  baseBranch?: string // default: "main"
}

interface CreatePullRequestResult {
  success: boolean
  pullRequestId?: string
  repo?: string
  number?: number
  url?: string
  error?: string
}

export class PRCreator {
  private getNexusRepoName(): string {
    return process.env.NEXUS_REPO_NAME || '-Nexus-Studio-AI-'
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult> {
    const { gitPushId, baseBranch = 'main' } = input

    logSafe(`PRCreator: PR request for GitPush ${gitPushId}`)

    // Get GitPush with related data
    const gitPush = await prisma.gitPush.findUnique({
      where: { id: gitPushId },
      include: {
        taskRun: {
          include: {
            task: true,
            review: true,
          },
        },
      },
    })

    if (!gitPush) {
      logSafe(`PRCreator: REFUSED — GitPush ${gitPushId} not found`)
      return {
        success: false,
        error: `GitPush ${gitPushId} not found`,
      }
    }

    // RULE 1: Verify target repo is NOT the Nexus repo
    const [repoOwner, repoName] = gitPush.repo.split('/')
    if (repoName === this.getNexusRepoName()) {
      logSafe(`PRCreator: REFUSED — target repo is Nexus repo (protected)`)
      return {
        success: false,
        error: `Cannot create PR on Nexus platform repository. Target must be a per-project output repository.`,
      }
    }

    // RULE 3: Verify work is approved
    if (!gitPush.taskRun.review || gitPush.taskRun.review.verdict !== 'APPROVE' || !gitPush.taskRun.review.worksOnStack) {
      logSafe(`PRCreator: REFUSED — work is not approved`)
      return {
        success: false,
        error: `Work is not approved. Only APPROVE + worksOnStack:true work can have a PR opened.`,
      }
    }

    // RULE 6: Check token
    const token = process.env.GITHUB_OUTPUT_TOKEN
    if (!token) {
      logSafe(`PRCreator: REFUSED — token is missing`)
      return {
        success: false,
        error: `GitHub token is missing. Set GITHUB_OUTPUT_TOKEN in .env.local (fine-grained, output repos only).`,
      }
    }

    // Create adapter for output repo
    const adapter = new GitHubAdapter({
      token,
      repoOwner,
      repoName,
    })

    // Build PR title and body with traceability
    const prTitle = `feat: ${gitPush.taskRun.task.title}`
    const prBody = `**Task:** ${gitPush.taskRun.task.title}
**Description:** ${gitPush.taskRun.task.description}

**Review verdict:** ${gitPush.taskRun.review.verdict}
**Works on stack:** ${gitPush.taskRun.review.worksOnStack ? 'Yes' : 'No'}
**Review summary:** ${gitPush.taskRun.review.summary}

**TaskRun ID:** ${gitPush.taskRun.id}
**Generated via:** Nexus Studio AI`

    logSafe(`PRCreator: opening PR on ${adapter.getRepoFullName()} (${gitPush.branch} → ${baseBranch})`)

    // RULE 5: No execution (use API only)
    const prResult = await adapter.createPullRequest({
      head: gitPush.branch,
      base: baseBranch,
      title: prTitle,
      body: prBody,
    })

    if (!prResult.success) {
      logSafe(`PRCreator: PR creation failed: ${prResult.error}`)
      return {
        success: false,
        error: prResult.error,
      }
    }

    // RULE 7: Record the PR in database
    try {
      const pullRequest = await prisma.pullRequest.create({
        data: {
          taskRunId: gitPush.taskRun.id,
          reviewId: gitPush.taskRun.review.id,
          gitPushId: gitPush.id,
          repo: adapter.getRepoFullName(),
          number: prResult.number!,
          url: prResult.url!,
        },
      })

      logSafe(`PRCreator: PR recorded: ${pullRequest.id}`)

      return {
        success: true,
        pullRequestId: pullRequest.id,
        repo: adapter.getRepoFullName(),
        number: prResult.number,
        url: prResult.url,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`PRCreator: failed to record PR: ${errorMsg}`)
      return {
        success: false,
        error: `PR opened but could not be recorded: ${errorMsg}`,
      }
    }
  }

  async getPullRequest(pullRequestId: string) {
    const pullRequest = await prisma.pullRequest.findUnique({
      where: { id: pullRequestId },
      include: {
        taskRun: { include: { task: true } },
        review: true,
        gitPush: true,
      },
    })

    if (!pullRequest) {
      return null
    }

    return {
      id: pullRequest.id,
      repo: pullRequest.repo,
      number: pullRequest.number,
      url: pullRequest.url,
      taskRunId: pullRequest.taskRun.id,
      taskTitle: pullRequest.taskRun.task.title,
      reviewVerdict: pullRequest.review.verdict,
      branch: pullRequest.gitPush.branch,
      createdAt: pullRequest.createdAt,
    }
  }
}
