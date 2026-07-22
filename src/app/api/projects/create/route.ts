// NEXUS-P1-009: Create project API route
// POST /api/projects/create
// Input: { title, idea }
// Output: { project, cost }

import { NextRequest, NextResponse } from 'next/server'
import { ProjectsService } from '@/modules/projects/service'
import { logSafe } from '@/lib/redact'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.title || !body.idea) {
      return NextResponse.json(
        { error: 'title and idea are required' },
        { status: 400 }
      )
    }

    logSafe('Create project endpoint called')

    const service = new ProjectsService()
    const result = await service.createProject({
      title: body.title,
      idea: body.idea,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logSafe(`Create project error: ${error instanceof Error ? error.message : 'unknown'}`)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}
