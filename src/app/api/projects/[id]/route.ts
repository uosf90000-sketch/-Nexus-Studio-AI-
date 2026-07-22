// NEXUS-P1-011: Get project API route
// GET /api/projects/[id]

import { NextRequest, NextResponse } from 'next/server'
import { ProjectsService } from '@/modules/projects/service'
import { prisma } from '@/lib/prisma'
import { logSafe } from '@/lib/redact'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logSafe(`Get project endpoint called: ${params.id}`)

    const service = new ProjectsService()
    const project = await service.getProject(params.id)

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get costs
    const costs = await prisma.costEntry.findMany({
      where: { projectId: params.id },
    })

    return NextResponse.json({ project, costs })
  } catch (error) {
    logSafe(`Get project error: ${error instanceof Error ? error.message : 'unknown'}`)

    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    )
  }
}
