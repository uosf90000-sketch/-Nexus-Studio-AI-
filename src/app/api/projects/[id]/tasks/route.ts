// NEXUS-P2A-003: Tasks API Route
// POST: generate tasks from PRD
// GET: retrieve tasks for a project

import { NextRequest, NextResponse } from 'next/server'
import { TasksService } from '@/modules/tasks/service'
import { prisma } from '@/lib/prisma'
import { logSafe } from '@/lib/redact'

const tasksService = new TasksService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    logSafe(`Tasks API: GET /api/projects/${projectId}/tasks`)

    const tasks = await tasksService.getTasks(projectId)

    return NextResponse.json({
      tasks,
      status: 'success',
    })
  } catch (error) {
    logSafe(
      `Tasks API GET error: ${error instanceof Error ? error.message : 'unknown'}`
    )

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to retrieve tasks',
        status: 'error',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    logSafe(`Tasks API: POST /api/projects/${projectId}/tasks`)

    // Get the project to fetch its PRD
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', status: 'error' },
        { status: 404 }
      )
    }

    // Find the PRD document
    const prdDoc = project.documents.find((d) => d.type === 'summary_and_prd')
    if (!prdDoc) {
      return NextResponse.json(
        { error: 'No PRD found for this project', status: 'error' },
        { status: 400 }
      )
    }

    // Parse PRD content
    let prdContent: any
    try {
      prdContent = JSON.parse(prdDoc.content)
    } catch {
      prdContent = { shortPrd: prdDoc.content }
    }

    const prd = prdContent.shortPrd || prdContent.summary || prdDoc.content

    // Generate and save tasks
    const result = await tasksService.generateAndSaveTasks({
      projectId,
      prd,
      projectTitle: project.title,
    })

    return NextResponse.json({
      tasks: result.tasks,
      cost: result.cost,
      status: 'success',
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate tasks'
    logSafe(`Tasks API POST error: ${errorMsg}`)

    // Check for cost threshold exceeded
    if (errorMsg.includes('threshold')) {
      return NextResponse.json(
        { error: errorMsg, status: 'cost_exceeded' },
        { status: 402 }
      )
    }

    return NextResponse.json(
      {
        error: errorMsg,
        status: 'error',
      },
      { status: 500 }
    )
  }
}
