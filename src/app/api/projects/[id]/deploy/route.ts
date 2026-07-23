// NEXUS-P7-005: Deployment API endpoint

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DeploymentOrchestrator } from '@/modules/deployer/orchestrator'

// POST /api/projects/[id]/deploy - Start a new deployment
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { buildRunId } = await request.json()

    if (!buildRunId || typeof buildRunId !== 'string') {
      return NextResponse.json({ error: 'buildRunId is required' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify build run exists and is approved
    const buildRun = await prisma.buildRun.findUnique({
      where: { id: buildRunId },
    })

    if (!buildRun) {
      return NextResponse.json({ error: 'Build run not found' }, { status: 404 })
    }

    if (buildRun.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Build status is ${buildRun.status}, expected APPROVED` },
        { status: 400 }
      )
    }

    // Check if deployment already exists for this build
    const existingDeployment = await prisma.deployment.findUnique({
      where: { buildRunId },
    })

    if (existingDeployment && existingDeployment.status === 'LIVE') {
      return NextResponse.json(
        {
          deploymentId: existingDeployment.id,
          status: 'LIVE',
          liveUrl: existingDeployment.liveUrl,
        },
        { status: 200 }
      )
    }

    // Start deployment
    const orchestrator = new DeploymentOrchestrator(params.id, buildRunId)
    const result = await orchestrator.deploy()

    // Get the created Deployment
    const deployment = await prisma.deployment.findUnique({
      where: { buildRunId },
    })

    return NextResponse.json(
      {
        deploymentId: deployment?.id,
        status: result.status,
        liveUrl: result.liveUrl,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Deployment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/deploy - Fetch deployment status
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deployment = await prisma.deployment.findFirst({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!deployment) {
      return NextResponse.json({ error: 'No deployment found' }, { status: 404 })
    }

    return NextResponse.json({
      id: deployment.id,
      status: deployment.status,
      githubRepo: deployment.githubRepo,
      githubRepoUrl: deployment.githubRepoUrl,
      railwayProjectId: deployment.railwayProjectId,
      railwayServiceId: deployment.railwayServiceId,
      liveUrl: deployment.liveUrl,
      errorLog: deployment.errorLog ? JSON.parse(deployment.errorLog) : null,
    })
  } catch (error) {
    console.error('Deployment fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
