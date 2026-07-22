// NEXUS-P1: Test setup and mocks
import { vi } from 'vitest'

// Mock Claude API responses
export const mockClaudeResponse = {
  summary: 'Test Summary: A brief overview of the idea.',
  shortPrd: `Test PRD:
**Overview**
Test product overview with key details.

**Key Features**
- Feature 1: Test feature description
- Feature 2: Another test feature
- Feature 3: Third test feature

**Success Metrics**
- Metric 1: 80% test metric
- Metric 2: 5x improvement target
- Metric 3: 95% success rate`,
}

export const mockTasksResponse = {
  tasks: [
    {
      title: 'Design and implement product catalog database schema',
      description: 'Create database models for products, categories, images, and ratings. Implement efficient indexing for search and filtering by category, price range, and rating. Support product reviews with user ratings.',
    },
    {
      title: 'Build product search and filtering API',
      description: 'Develop REST endpoints for product search, category filtering, price range filters, and sorting. Implement full-text search for product names and descriptions. Return paginated results with performance optimization.',
    },
    {
      title: 'Implement shopping cart with persistence',
      description: 'Create shopping cart functionality to add/remove items and update quantities. Implement session-based and persistent storage (save to database between sessions). Support discount code application and calculation.',
    },
    {
      title: 'Build user authentication system',
      description: 'Implement user registration, email verification, and secure login. Add password reset functionality via email. Integrate social authentication (Google, GitHub OAuth). Use JWT for session management.',
    },
    {
      title: 'Implement multi-step checkout process',
      description: 'Create checkout UI flow: cart review → shipping address → shipping method selection → payment. Validate addresses and calculate shipping costs. Store order details before payment.',
    },
    {
      title: 'Integrate payment gateway with multiple providers',
      description: 'Integrate Stripe and PayPal payment processors. Implement secure payment processing, order confirmation, and email receipts. Ensure PCI compliance. Handle payment failures and retries gracefully.',
    },
    {
      title: 'Build admin dashboard for product and order management',
      description: 'Create CRUD interfaces for product management (add/edit/delete). Implement order tracking, fulfillment status updates, and order history. Add user management with role-based access control.',
    },
    {
      title: 'Implement analytics and real-time inventory sync',
      description: 'Track conversion rates, page load metrics, and customer satisfaction. Sync inventory in real-time across frontend and backend to prevent overselling. Create reporting dashboards for business metrics.',
    },
  ],
}

export const mockBuilderResponse = `// Product Catalog Schema
import { Schema, model } from 'mongoose'

interface IProduct {
  name: string
  description: string
  price: number
  category: string
  images: string[]
  rating: number
  reviewCount: number
  createdAt: Date
}

// Prisma Schema (recommended for this stack)
/*
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
*/

// API Route Handler
// app/api/products/search/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category')
  const minPrice = parseFloat(searchParams.get('minPrice') || '0')
  const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20

  try {
    const where = {
      AND: [
        q ? { name: { search: q } } : {},
        category ? { category } : {},
        { price: { gte: minPrice, lte: maxPrice } },
      ],
    }

    const total = await prisma.product.count({ where })
    const products = await prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}`

// Mock Prisma
export const mockPrismaProject = {
  id: 'test-project-id',
  title: 'Test Project',
  idea: 'Test idea description',
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockPrismaDocument = {
  id: 'test-doc-id',
  projectId: 'test-project-id',
  type: 'summary_and_prd',
  content: JSON.stringify(mockClaudeResponse),
  createdAt: new Date(),
}

export const mockPrismaCostEntry = {
  id: 'test-cost-id',
  projectId: 'test-project-id',
  provider: 'claude',
  model: 'claude-sonnet-4-5',
  inputTokens: 100,
  outputTokens: 200,
  estimatedCost: 0.005,
  actualCost: 0.005,
  createdAt: new Date(),
}

// Mock functions for fetch
// Detects context from the request body to return appropriate response
export function mockFetchSuccess() {
  global.fetch = vi.fn(async (input: any, options?: any): Promise<Response> => {
    // Parse request body to determine type: PRD / tasks / builder code
    let responseType = 'prd' // default

    try {
      const body =
        options?.body || (typeof input === 'object' && input?.body ? input.body : null)
      if (body) {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body
        const message = parsed.messages?.[0]?.content || ''
        const lowerMsg = message.toLowerCase()

        if (lowerMsg.includes('builder') || lowerMsg.includes('generate code') || lowerMsg.includes('code to implement')) {
          responseType = 'builder'
        } else if (lowerMsg.includes('task') || lowerMsg.includes('implementation')) {
          responseType = 'tasks'
        }
      }
    } catch {
      // Default to PRD response if parse fails
    }

    let responseContent: any
    let textContent: string

    if (responseType === 'builder') {
      // Return raw code (no JSON wrapping for builder)
      textContent = mockBuilderResponse
    } else if (responseType === 'tasks') {
      // Return JSON for tasks
      responseContent = mockTasksResponse
      textContent = `\`\`\`json\n${JSON.stringify(responseContent)}\n\`\`\``
    } else {
      // Return JSON for PRD
      responseContent = mockClaudeResponse
      textContent = `\`\`\`json\n${JSON.stringify(responseContent)}\n\`\`\``
    }

    return new Response(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        content: [{ type: 'text', text: textContent }],
        usage: {
          input_tokens: 100,
          output_tokens: 200,
        },
      }),
      { status: 200 }
    )
  })
}

export function mockFetchError(status: number) {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: 'Mock error' }), { status })
    )
  )
}
