// NEXUS-P1-010: List projects API route
// GET /api/projects

import { NextResponse } from 'next/server'
import { ProjectsService } from '@/modules/projects/service'
import { logSafe } from '@/lib/redact'

export async function GET() {
  try {
    logSafe('List projects endpoint called')

    const service = new ProjectsService()
    const projects = await service.listProjects()

    return NextResponse.json({ projects })
  } catch (error) {
    logSafe(`List projects error: ${error instanceof Error ? error.message : 'unknown'}`)

    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    )
  }
}
