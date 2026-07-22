import { describe, it, beforeAll, vi, beforeEach } from 'vitest'
import { ReviewsService } from '@/modules/reviews/service'
import { prisma } from '@/lib/prisma'
import { mockFetchSuccess } from './tests/setup'

describe('Real Reviewer Demo', () => {
  let service: ReviewsService

  beforeAll(() => {
    service = new ReviewsService()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  it('review real generated product catalog code', async () => {
    const project = await prisma.project.create({
      data: {
        title: 'E-Commerce Reviewer Test',
        idea: 'Build e-commerce platform',
      },
    })

    const prd = `# E-Commerce Platform
Key Features: Product catalog with search, shopping cart, checkout system
Stack: Next.js, Prisma, SQLite`

    await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        type: 'summary_and_prd',
        content: JSON.stringify({ summary: 'E-Commerce', shortPrd: prd }),
      },
    })

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: 'Design and implement product catalog database schema',
        description: 'Create Prisma models for products with indexing',
        order: 1,
        status: 'PENDING',
      },
    })

    const generatedCode = `// Product Catalog Schema
model Product {
  id        String   @id @default(cuid())
  name      String
  description String
  price     Float
  category  String
  images    String[]
  rating    Float    @default(0)
  reviewCount Int    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@fulltext([name, description])
}

model ProductReview {
  id       String   @id @default(cuid())
  productId String
  userId   String
  rating   Int      // 1-5
  comment  String?
  createdAt DateTime @default(now())

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([productId])
}

// API Route Handler
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category')
  
  try {
    const where = {
      AND: [
        q ? { name: { search: q } } : {},
        category ? { category } : {},
      ],
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: products })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}`

    const taskRun = await prisma.taskRun.create({
      data: {
        taskId: task.id,
        status: 'SUCCESS',
        provider: 'claude',
        model: 'claude-sonnet-4-5',
        generatedCode,
        inputTokens: 500,
        outputTokens: 400,
      },
    })

    console.log('\n\n╔════════════════════════════════════════════════════════════════════╗')
    console.log('║                     REAL REVIEWER DEMO                            ║')
    console.log('╚════════════════════════════════════════════════════════════════════╝')
    console.log(`\nProject: ${project.title}`)
    console.log(`Task: ${task.title}`)
    console.log(`Generated Code Length: ${generatedCode.length} chars`)
    console.log(`\n📋 Reviewing code...\n`)

    const result = await service.reviewTaskRun({ taskRunId: taskRun.id })

    console.log('┌─ REVIEW VERDICT ───────────────────────────────────────────────────┐')
    console.log(`│ Verdict: ${result.verdict}`)
    console.log(`│ Works on Stack (Next.js + Prisma + SQLite): ${result.worksOnStack}`)
    console.log('│')
    console.log(`│ Summary:`)
    console.log(`│ ${result.summary}`)
    if (result.issues.length > 0) {
      console.log('│')
      console.log('│ Issues Found:')
      result.issues.forEach((issue) => {
        console.log(`│   [${issue.severity}] ${issue.description}`)
      })
    } else {
      console.log('│')
      console.log('│ No issues found.')
    }
    console.log('└────────────────────────────────────────────────────────────────────┘')

    console.log(`\n💰 COST & METADATA:`)
    console.log(`   Provider: ${result.cost?.provider}`)
    console.log(`   Model: ${result.cost?.model}`)
    console.log(`   Input Tokens: ${result.cost?.inputTokens}`)
    console.log(`   Output Tokens: ${result.cost?.outputTokens}`)
    console.log(`   Estimated Cost: $${result.cost?.estimatedCost.toFixed(6)}`)

    console.log(`\n✅ REVIEW STORED IN DB (NOT WRITTEN TO FILE)`)
    console.log(`   Review ID: ${result.reviewId}`)
    console.log(`   Status: SUCCESS`)
    console.log(`   Linked to TaskRun: ${taskRun.id}\n`)

    // Cleanup
    await prisma.review.deleteMany({ where: { taskRunId: taskRun.id } })
    await prisma.taskRun.deleteMany({ where: { id: taskRun.id } })
    await prisma.task.deleteMany({ where: { projectId: project.id } })
    await prisma.projectDocument.deleteMany({ where: { projectId: project.id } })
    await prisma.costEntry.deleteMany({ where: { projectId: project.id } })
    await prisma.executionLog.deleteMany({ where: { projectId: project.id } })
    await prisma.project.delete({ where: { id: project.id } })
  })
})
