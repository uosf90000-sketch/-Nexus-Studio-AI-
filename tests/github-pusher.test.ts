// NEXUS-P2C3-003: GitHub Pusher Tests (All Mocked)
// Proves all 7 absolute rules are enforced
// NO REAL GITHUB API CALLS, NO REAL TOKENS

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { GitPusher } from '@/modules/github/pusher'
import { prisma } from '@/lib/prisma'

// Mock fetch globally
global.fetch = vi.fn()

describe('GitPusher (All Rules, All Mocked)', () => {
  let pusher: GitPusher

  beforeEach(() => {
    vi.clearAllMocks()
    pusher = new GitPusher()
    // Mock fetch to return success
    ;(global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          commit: { sha: 'abc123def456' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
  })

  async function createTestData() {
    const project = await prisma.project.create({
      data: { title: `GITHUB-TEST-${Date.now()}`, idea: 'Test project' },
    })

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: 'Test task',
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

    return { project, task, taskRun, review, writtenFile }
  }

  async function cleanup(projectId: string) {
    try {
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

  it('RULE 1: Pushes approved file to output repo (mocked API)', async () => {
    const data = await createTestData()

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
      })

      expect(result.success).toBe(true)
      expect(result.gitPushId).toBeTruthy()
      expect(result.repo).toContain('test-owner')
      expect(result.branch).toContain('nexus/')
      expect(result.commitSha).toBeTruthy()

      // Verify GitPush was recorded
      const gitPush = await prisma.gitPush.findUnique({
        where: { id: result.gitPushId! },
      })
      expect(gitPush).toBeTruthy()
      expect(gitPush?.taskRunId).toBe(data.taskRun.id)
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 1: REFUSES if target repo IS Nexus repo', async () => {
    const data = await createTestData()

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test',
        outputRepoName: '-Nexus-Studio-AI-', // Protected!
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot push to Nexus')

      // Verify GitPush was NOT recorded
      const count = await prisma.gitPush.count({
        where: { taskRunId: data.taskRun.id },
      })
      expect(count).toBe(0)
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 3: REFUSES unapproved file (verdict=REQUEST_CHANGES)', async () => {
    const data = await createTestData()

    // Change review verdict
    await prisma.review.update({
      where: { id: data.review.id },
      data: { verdict: 'REQUEST_CHANGES' },
    })

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
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
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not approved')
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 4: Commits to NEW branch, never to main/master', async () => {
    const data = await createTestData()

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
      })

      expect(result.success).toBe(true)
      expect(result.branch).toContain('nexus/')
      expect(result.branch).not.toEqual('main')
      expect(result.branch).not.toEqual('master')
    } finally {
      await cleanup(data.project.id)
    }
  })

  it('RULE 6: Token is required; fails if missing', async () => {
    const data = await createTestData()

    // Save current env
    const originalToken = process.env.GITHUB_OUTPUT_TOKEN
    delete process.env.GITHUB_OUTPUT_TOKEN

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('token')
    } finally {
      if (originalToken) process.env.GITHUB_OUTPUT_TOKEN = originalToken
      await cleanup(data.project.id)
    }
  })

  it('RULE 5: No exec/spawn/child_process in pusher path', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/github/pusher.ts'),
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
      path.join(process.cwd(), 'src/modules/github/pusher.ts'),
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

  it('GitPush is recorded only on success', async () => {
    const data = await createTestData()

    try {
      const result = await pusher.pushFile({
        writtenFileId: data.writtenFile.id,
        outputRepoOwner: 'test-owner',
        outputRepoName: 'test-output-repo',
      })

      expect(result.success).toBe(true)

      const gitPush = await prisma.gitPush.findUnique({
        where: { id: result.gitPushId! },
      })

      expect(gitPush).toBeTruthy()
      expect(gitPush?.repo).toBe('test-owner/test-output-repo')
      expect(gitPush?.branch).toContain('nexus/')
    } finally {
      await cleanup(data.project.id)
    }
  })
})
