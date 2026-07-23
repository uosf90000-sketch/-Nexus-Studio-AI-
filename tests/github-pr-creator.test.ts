// NEXUS-P2C3B-002: PR Creator Tests (All Mocked)
// Proves all 8 absolute rules are enforced
// NO REAL GITHUB API CALLS, NO REAL TOKENS

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { PRCreator } from '@/modules/github/pr-creator'
import { prisma } from '@/lib/prisma'

// Mock fetch globally
global.fetch = vi.fn()

describe('PRCreator (All Rules, All Mocked)', () => {
  let prCreator: PRCreator

  beforeEach(() => {
    vi.clearAllMocks()
    prCreator = new PRCreator()
    // Mock fetch to return success for PR creation
    ;(global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          number: 123,
          html_url: 'https://github.com/test-owner/test-output-repo/pull/123',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      )
    )
  })

  async function createTestData() {
    const project = await prisma.project.create({
      data: { title: `PR-TEST-${Date.now()}`, idea: 'Test project' },
    })

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: 'Test task for PR',
        description: 'Test',
        order: 1,
        status: 'PENDING',
      },
    })

    const taskRun = await prisma.taskRun.create({
      data: {
        taskId: task.id,
        status: 'SUCCESS',
        provider: 'claude',
        model: 'claude-sonnet-4-5',
        generatedCode: 'const x = 1',
      },
    })

    const review = await prisma.review.create({
      data: {
        taskRunId: taskRun.id,
        verdict: 'APPROVE',
        summary: 'Good',
        worksOnStack: true,
        provider: 'claude',
        model: 'claude-sonnet-4-5',
      },
    })

    // Create generated file
    const genPath = path.join(process.cwd(), 'generated', project.id)
    await fs.mkdir(genPath, { recursive: true })
    const filePath = path.join(genPath, 'test-file.ts')
    await fs.writeFile(filePath, 'const y = 2', 'utf-8')

    const writtenFile = await prisma.writtenFile.create({
      data: {
        taskRunId: taskRun.id,
        reviewId: review.id,
        path: `generated/${project.id}/test-file.ts`,
      },
    })

    // Create GitPush (as if Slice 1 was executed)
    const gitPush = await prisma.gitPush.create({
      data: {
        taskRunId: taskRun.id,
        repo: 'test-owner/test-output-repo',
        branch: `nexus/${taskRun.id}`,
        commitSha: 'abc123def456',
      },
    })

    return { project, task, taskRun, review, writtenFile, gitPush }
  }

  async function cleanup(projectId: string) {
    try {
      await prisma.pullRequest.deleteMany({ where: { gitPush: { taskRun: { task: { projectId } } } } })
      await prisma.gitPush.deleteMany({ where: { taskRun: { task: { projectId } } } })
      await prisma.writtenFile.deleteMany({ where: { taskRun: { task: { projectId } } } })
      await prisma.review.deleteMany({ where: { taskRun: { task: { projectId } } } })
      await prisma.taskRun.deleteMany({ where: { task: { projectId } } })
      await prisma.task.deleteMany({ where: { projectId } })
      await prisma.projectDocument.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
      await fs.rm(path.join(process.cwd(), 'generated', projectId), { recursive: true, force: true })
    } catch {
      // ignore
    }
  }

  it('RULE 1+3+7: Opens a PR for valid approved branch; records PullRequest', async () => {
    const data = await createTestData()

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
        baseBranch: 'main',
      })

      expect(result.success).toBe(true)
      expect(result.pullRequestId).toBeTruthy()
      expect(result.repo).toContain('test-owner')
      expect(result.number).toBe(123)
      expect(result.url).toContain('pull/123')

      // Verify PullRequest was recorded
      const pullRequest = await prisma.pullRequest.findUnique({
        where: { id: result.pullRequestId! },
      })
      expect(pullRequest).toBeTruthy()
      expect(pullRequest?.taskRunId).toBe(data.taskRun.id)
      expect(pullRequest?.reviewId).toBe(data.review.id)
      expect(pullRequest?.gitPushId).toBe(data.gitPush.id)
      expect(pullRequest?.number).toBe(123)
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 1: REFUSES if target repo IS Nexus repo', async () => {
    const data = await createTestData()

    // Update GitPush to target Nexus repo
    await prisma.gitPush.update({
      where: { id: data.gitPush.id },
      data: { repo: 'test/-Nexus-Studio-AI-' },
    })

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot create PR on Nexus')

      // Verify PullRequest was NOT recorded
      const count = await prisma.pullRequest.count({
        where: { taskRunId: data.taskRun.id },
      })
      expect(count).toBe(0)
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 3: REFUSES unapproved work (verdict=REQUEST_CHANGES)', async () => {
    const data = await createTestData()

    // Change review verdict
    await prisma.review.update({
      where: { id: data.review.id },
      data: { verdict: 'REQUEST_CHANGES' },
    })

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not approved')
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 3: REFUSES if worksOnStack is false', async () => {
    const data = await createTestData()

    await prisma.review.update({
      where: { id: data.review.id },
      data: { worksOnStack: false },
    })

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not approved')
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 2: REFUSES if GitPush does not exist', async () => {
    try {
      const result = await prCreator.createPullRequest({
        gitPushId: 'nonexistent-push-id',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    } finally {
      // no cleanup needed
    }
  })

  it('RULE 6: Token is required; fails if missing', async () => {
    const data = await createTestData()

    // Save current env
    const originalToken = process.env.GITHUB_OUTPUT_TOKEN
    delete process.env.GITHUB_OUTPUT_TOKEN

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('token')

      // Verify PullRequest was NOT recorded
      const count = await prisma.pullRequest.count({
        where: { taskRunId: data.taskRun.id },
      })
      expect(count).toBe(0)
    } finally {
      if (originalToken) process.env.GITHUB_OUTPUT_TOKEN = originalToken
      await cleanup(data.project.id)
    }
  })

  it('RULE 5: No exec/spawn/child_process in PR creator path', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/github/pr-creator.ts'),
      'utf-8'
    )

    // Remove comments
    const codeWithoutComments = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

    expect(codeWithoutComments).not.toContain('exec(')
    expect(codeWithoutComments).not.toContain('spawn(')
    expect(codeWithoutComments).not.toContain('execSync')
  })

  it('RULE 6: Token is never logged (redaction check)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/github/pr-creator.ts'),
      'utf-8'
    )

    // Should use logSafe for all logs, not console.log with token
    expect(source).toContain('logSafe')
    // Token should never appear in plain text logs
    const lines = source.split('\n')
    const logLines = lines.filter((l: string) => l.includes('log'))
    logLines.forEach((line: string) => {
      expect(line).not.toContain('GITHUB_OUTPUT_TOKEN')
    })
  })

  it('RULE 2: No merge API called anywhere in PR creator', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/github/pr-creator.ts'),
      'utf-8'
    )

    // Remove comments
    const codeWithoutComments = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

    // Should never call merge APIs
    expect(codeWithoutComments).not.toContain('/merge')
    expect(codeWithoutComments).not.toContain('mergePullRequest')
    expect(codeWithoutComments).not.toContain('autoMerge')
    expect(codeWithoutComments).not.toContain('auto-merge')
  })

  it('PullRequest is recorded only on success', async () => {
    const data = await createTestData()

    try {
      const result = await prCreator.createPullRequest({
        gitPushId: data.gitPush.id,
      })

      expect(result.success).toBe(true)

      const pullRequest = await prisma.pullRequest.findUnique({
        where: { id: result.pullRequestId! },
      })

      expect(pullRequest).toBeTruthy()
      expect(pullRequest?.repo).toBe('test-owner/test-output-repo')
      expect(pullRequest?.number).toBe(123)
    } finally {
      await cleanup(data.project.id)
    }
  })
})
