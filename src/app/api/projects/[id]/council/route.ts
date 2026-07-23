// NEXUS-P5-009: Council API endpoint

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CouncilSession } from '@/modules/council/session'

// POST /api/projects/[id]/council - Start a new council session
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { idea, maxRounds, maxCostUSD } = await request.json()

    if (!idea || typeof idea !== 'string') {
      return NextResponse.json({ error: 'idea is required' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Run council session
    const council = new CouncilSession(params.id, idea, {
      maxRounds: maxRounds || 2,
      maxCostUSD: maxCostUSD || 10,
    })

    const result = await council.run()

    return NextResponse.json(
      {
        sessionId: (await prisma.councilSession.findFirst({
          where: { projectId: params.id },
          orderBy: { createdAt: 'desc' },
        }))?.id,
        verdict: result.verdict,
        reason: result.reason,
        cost: result.cost,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Council error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/council - Fetch council session transcript
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.councilSession.findFirst({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: [{ round: 'asc' }, { order: 'asc' }],
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'No council session found' }, { status: 404 })
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      verdict: session.verdict,
      verdictReason: session.verdictReason,
      totalCost: session.totalCost,
      messages: session.messages.map((msg) => ({
        id: msg.id,
        round: msg.round,
        role: msg.role,
        provider: msg.provider,
        model: msg.model,
        content: msg.content,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        cost: msg.cost,
        createdAt: msg.createdAt,
      })),
    })
  } catch (error) {
    console.error('Council fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
