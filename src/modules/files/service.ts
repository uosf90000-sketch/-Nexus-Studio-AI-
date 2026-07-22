// NEXUS-P2C2-002: Files Service
// Orchestrates the write flow: verify approval → write → record

import { prisma } from '@/lib/prisma'
import { FileWriter } from './writer'
import { logSafe } from '@/lib/redact'

interface WriteTaskRunFileInput {
  taskRunId: string
}

interface WriteTaskRunFileResult {
  success: boolean
  writtenFileId?: string
  path?: string
  error?: string
}

export class FilesService {
  private writer = new FileWriter()

  async writeTaskRunFile(input: WriteTaskRunFileInput): Promise<WriteTaskRunFileResult> {
    const { taskRunId } = input
    const startTime = Date.now()

    logSafe(`FilesService: write request for TaskRun ${taskRunId}`)

    // Get TaskRun with Review and Task
    const taskRun = await prisma.taskRun.findUnique({
      where: { id: taskRunId },
      include: {
        task: true,
        review: true,
      },
    })

    if (!taskRun) {
      return {
        success: false,
        error: `TaskRun ${taskRunId} not found`,
      }
    }

    if (!taskRun.review) {
      return {
        success: false,
        error: `TaskRun ${taskRunId} has no review. Code must be reviewed before writing.`,
      }
    }

    if (!taskRun.generatedCode) {
      return {
        success: false,
        error: `TaskRun ${taskRunId} has no generated code`,
      }
    }

    // Derive filename from task
    const filename = this.deriveFilename(taskRun.task.title)

    logSafe(`FilesService: attempting to write with filename "${filename}"`)

    // Write file using the safe writer
    const writeResult = await this.writer.writeFile({
      taskRunId,
      projectId: taskRun.task.projectId,
      code: taskRun.generatedCode,
      filename,
      verdict: taskRun.review.verdict,
      worksOnStack: taskRun.review.worksOnStack,
    })

    if (!writeResult.success) {
      logSafe(`FilesService: write failed: ${writeResult.error}`)
      return {
        success: false,
        error: writeResult.error,
      }
    }

    // SAFETY RULE 6: Record the written file
    try {
      const writtenFile = await prisma.writtenFile.create({
        data: {
          taskRunId,
          reviewId: taskRun.review.id,
          path: writeResult.path!,
        },
      })

      logSafe(`FilesService: recorded WrittenFile ${writtenFile.id}: ${writeResult.path}`)

      return {
        success: true,
        writtenFileId: writtenFile.id,
        path: writeResult.path,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`FilesService: failed to record WrittenFile: ${errorMsg}`)
      return {
        success: false,
        error: `File was written but could not be recorded in database: ${errorMsg}. Manual cleanup may be needed.`,
      }
    }
  }

  private deriveFilename(taskTitle: string): string {
    // Convert task title to filename: lowercase, replace spaces with hyphens, add .ts extension
    const base = taskTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return `${base}.ts`
  }

  async getWrittenFile(writtenFileId: string) {
    const file = await prisma.writtenFile.findUnique({
      where: { id: writtenFileId },
      include: {
        taskRun: {
          include: { task: true, review: true },
        },
        review: true,
      },
    })

    if (!file) {
      return null
    }

    return {
      id: file.id,
      path: file.path,
      taskRunId: file.taskRunId,
      reviewId: file.reviewId,
      taskTitle: file.taskRun.task.title,
      verdict: file.review.verdict,
      worksOnStack: file.review.worksOnStack,
      createdAt: file.createdAt,
    }
  }
}
