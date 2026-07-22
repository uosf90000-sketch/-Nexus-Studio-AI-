// NEXUS-P2C2-003: Write File Endpoint
// Trigger writing an approved TaskRun's code to disk

import { NextRequest, NextResponse } from 'next/server'
import { FilesService } from '@/modules/files/service'
import { logSafe } from '@/lib/redact'

const filesService = new FilesService()

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskRunId = params.id

  logSafe(`POST /api/task-runs/${taskRunId}/write — write file request`)

  try {
    const result = await filesService.writeTaskRunFile({ taskRunId })

    if (!result.success) {
      logSafe(`Write failed: ${result.error}`)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }

    logSafe(`Write succeeded: ${result.path}`)
    return NextResponse.json(
      {
        success: true,
        writtenFileId: result.writtenFileId,
        path: result.path,
      },
      { status: 201 }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logSafe(`Write endpoint error: ${errorMsg}`)
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${errorMsg}`,
      },
      { status: 500 }
    )
  }
}
