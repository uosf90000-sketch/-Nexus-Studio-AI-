// NEXUS-P6-004: Build API endpoint

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BuildRunner } from '@/modules/builder/runner'
import path from 'path'

// POST /api/projects/[id]/build - Start a new build
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { prdContent, maxRounds, maxCostUSD } = await request.json()

    if (!prdContent || typeof prdContent !== 'string') {
      return NextResponse.json({ error: 'prdContent is required' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create isolated workspace
    const workspacePath = path.join(process.cwd(), 'workspaces', params.id)

    // Run build
    const runner = new BuildRunner(params.id, workspacePath, {
      maxRounds: maxRounds || 3,
      maxCostUSD: maxCostUSD || 20,
    })

    const result = await runner.run(project.idea, prdContent)

    // Get the created BuildRun
    const buildRun = await prisma.buildRun.findFirst({
      where: { projectId: params.id },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json(
      {
        buildRunId: buildRun?.id,
        status: result.status,
        cost: result.cost,
        rounds: result.rounds,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Build error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/build - Fetch build results
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const buildRun = await prisma.buildRun.findFirst({
      where: { projectId: params.id },
      orderBy: { startedAt: 'desc' },
      include: {
        buildRounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    })

    if (!buildRun) {
      return NextResponse.json({ error: 'No build found' }, { status: 404 })
    }

    return NextResponse.json({
      id: buildRun.id,
      status: buildRun.status,
      rounds: buildRun.buildRounds.map((round) => ({
        number: round.roundNumber,
        verdict: round.auditVerdict,
        issues: round.auditIssues ? JSON.parse(round.auditIssues) : [],
        runsCorrectly: round.runsCorrectly,
        cost: round.cost,
      })),
      totalCost: buildRun.totalCost,
      workspacePath: buildRun.workspacePath,
    })
  } catch (error) {
    console.error('Build fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
