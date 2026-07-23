// NEXUS-P2C3-002: Git Pusher Service
// Pushes approved, written files to a per-project GitHub repository
// Enforces all 7 absolute rules from §2

import { prisma } from '@/lib/prisma'
import { GitHubAdapter } from '@/lib/github-adapter'
import { logSafe } from '@/lib/redact'

interface PushFileInput {
  writtenFileId: string
  outputRepoOwner: string
  outputRepoName: string
}

interface PushFileResult {
  success: boolean
  gitPushId?: string
  repo?: string
  branch?: string
  commitSha?: string
  commitUrl?: string
  error?: string
}

export class GitPusher {
  private getNexusRepoName(): string {
    // Nexus platform repo (must never be touched)
    return process.env.NEXUS_REPO_NAME || '-Nexus-Studio-AI-'
  }

  async pushFile(input: PushFileInput): Promise<PushFileResult> {
    const { writtenFileId, outputRepoOwner, outputRepoName } = input

    logSafe(`GitPusher: push request for WrittenFile ${writtenFileId}`)

    // RULE 1: Verify target repo is NOT the Nexus repo
    if (outputRepoName === this.getNexusRepoName()) {
      logSafe(`GitPusher: REFUSED — target repo is Nexus repo (protected)`)
      return {
        success: false,
        error: `Cannot push to Nexus platform repository. Target must be a per-project output repository.`,
      }
    }

    // Get WrittenFile with related data
    const writtenFile = await prisma.writtenFile.findUnique({
      where: { id: writtenFileId },
      include: {
        taskRun: {
          include: { task: true, review: true },
        },
        review: true,
      },
    })

    if (!writtenFile) {
      return {
        success: false,
        error: `WrittenFile ${writtenFileId} not found`,
      }
    }

    // RULE 3: Verify file is approved
    if (!writtenFile.review || writtenFile.review.verdict !== 'APPROVE' || !writtenFile.review.worksOnStack) {
      logSafe(`GitPusher: REFUSED — file is not approved`)
      return {
        success: false,
        error: `File is not approved. Only APPROVE + worksOnStack:true files can be pushed.`,
      }
    }

    // RULE 6: Check token
    const token = process.env.GITHUB_OUTPUT_TOKEN
    if (!token) {
      logSafe(`GitPusher: REFUSED — token is missing`)
      return {
        success: false,
        error: `GitHub token is missing. Set GITHUB_OUTPUT_TOKEN in .env.local (fine-grained, output repos only).`,
      }
    }

    // Create adapter for output repo
    const adapter = new GitHubAdapter({
      token,
      repoOwner: outputRepoOwner,
      repoName: outputRepoName,
    })

    // RULE 4: Create new branch (never commit to main/master)
    const branchName = `nexus/${writtenFile.taskRun.id}`

    logSafe(`GitPusher: creating branch "${branchName}" on ${adapter.getRepoFullName()}`)

    const branchResult = await adapter.createBranch({
      baseBranch: 'main', // or 'master' — assume main for now
      newBranch: branchName,
    })

    if (!branchResult.success) {
      logSafe(`GitPusher: branch creation failed: ${branchResult.error}`)
      return {
        success: false,
        error: branchResult.error,
      }
    }

    // Read the file from disk (it was already written)
    const fs = await import('fs/promises')
    const path = await import('path')

    const filePath = path.join(process.cwd(), writtenFile.path)

    let fileContent: string
    try {
      fileContent = await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      logSafe(`GitPusher: could not read file ${writtenFile.path}: ${error}`)
      return {
        success: false,
        error: `Could not read file to push: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }

    // RULE 5: No execution (use GitHub API, not exec/spawn)
    // (All operations above use API calls only)

    // Create commit on the new branch
    const commitMessage = `feat: add generated code for task "${writtenFile.taskRun.task.title}"

Generated via Nexus Studio AI
TaskRun: ${writtenFile.taskRun.id}
Review: ${writtenFile.review.verdict} (${writtenFile.review.worksOnStack ? 'compatible' : 'incompatible'})`

    logSafe(`GitPusher: creating commit on branch "${branchName}"`)

    const commitResult = await adapter.createCommit({
      branch: branchName,
      message: commitMessage,
      content: fileContent,
      filePath: writtenFile.path.replace(`generated/${writtenFile.taskRun.task.projectId}/`, ''),
    })

    if (!commitResult.success) {
      logSafe(`GitPusher: commit creation failed: ${commitResult.error}`)
      return {
        success: false,
        error: commitResult.error,
      }
    }

    // RULE 7: Record the push in database
    try {
      const gitPush = await prisma.gitPush.create({
        data: {
          taskRunId: writtenFile.taskRun.id,
          repo: adapter.getRepoFullName(),
          branch: branchName,
          commitSha: commitResult.commitSha || 'unknown',
        },
      })

      logSafe(`GitPusher: push recorded: ${gitPush.id}`)

      const commitUrl = `https://github.com/${adapter.getRepoFullName()}/commit/${commitResult.commitSha}`

      return {
        success: true,
        gitPushId: gitPush.id,
        repo: adapter.getRepoFullName(),
        branch: branchName,
        commitSha: commitResult.commitSha,
        commitUrl,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`GitPusher: failed to record push: ${errorMsg}`)
      return {
        success: false,
        error: `Push succeeded but could not be recorded: ${errorMsg}`,
      }
    }
  }

  async getGitPush(gitPushId: string) {
    const gitPush = await prisma.gitPush.findUnique({
      where: { id: gitPushId },
      include: { taskRun: { include: { task: true } } },
    })

    if (!gitPush) {
      return null
    }

    return {
      id: gitPush.id,
      repo: gitPush.repo,
      branch: gitPush.branch,
      commitSha: gitPush.commitSha,
      commitUrl: `https://github.com/${gitPush.repo}/commit/${gitPush.commitSha}`,
      taskRunId: gitPush.taskRunId,
      taskTitle: gitPush.taskRun.task.title,
      createdAt: gitPush.createdAt,
    }
  }
}
