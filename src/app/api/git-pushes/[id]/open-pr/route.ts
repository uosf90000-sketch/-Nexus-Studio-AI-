// NEXUS-P2C3B-003: Open Pull Request Endpoint
// POST /api/git-pushes/[id]/open-pr
// Opens a PR on an existing pushed branch from an output repo

import { NextRequest, NextResponse } from 'next/server'
import { PRCreator } from '@/modules/github/pr-creator'

interface OpenPRRequest {
  baseBranch?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gitPushId = params.id
    const body = (await req.json()) as OpenPRRequest

    const prCreator = new PRCreator()
    const result = await prCreator.createPullRequest({
      gitPushId,
      baseBranch: body.baseBranch,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to open PR: ${message}` },
      { status: 500 }
    )
  }
}
