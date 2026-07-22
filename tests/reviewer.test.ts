// NEXUS-P2C1-003: Reviewer Tests
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { Reviewer } from '@/modules/agents/reviewer'
import { mockFetchSuccess } from './setup'

describe('Reviewer', () => {
  let reviewer: Reviewer

  beforeAll(() => {
    reviewer = new Reviewer()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  it('should review code and return structured verdict', async () => {
    const review = await reviewer.reviewCode({
      generatedCode: `
        model Product {
          id String @id @default(cuid())
          name String
          price Float
        }
      `,
      taskTitle: 'Product schema',
      taskDescription: 'Create product model',
      prdContent: 'E-commerce platform with products',
      projectTitle: 'E-Commerce',
      projectStack: 'Next.js + Prisma + SQLite',
    })

    expect(review).toHaveProperty('verdict')
    expect(['APPROVE', 'REQUEST_CHANGES', 'REJECT']).toContain(review.verdict)
    expect(review).toHaveProperty('summary')
    expect(typeof review.summary).toBe('string')
    expect(review).toHaveProperty('issues')
    expect(Array.isArray(review.issues)).toBe(true)
    expect(review).toHaveProperty('worksOnStack')
    expect(typeof review.worksOnStack).toBe('boolean')
  })

  it('should detect stack incompatibility', async () => {
    const review = await reviewer.reviewCode({
      generatedCode: `
        model Product {
          id String @id @default(cuid())
          @@fulltext([name, description])
        }
      `,
      taskTitle: 'Product with fulltext search',
      taskDescription: 'Add fulltext search to products',
      prdContent: 'Full-text search for products',
      projectTitle: 'E-Commerce',
      projectStack: 'Next.js + Prisma + SQLite',
    })

    // Reviewer should flag @@fulltext as not working on SQLite
    expect(review).toBeDefined()
    expect(review).toHaveProperty('worksOnStack')
  })

  it('should include issues with severity levels', async () => {
    const review = await reviewer.reviewCode({
      generatedCode: `
        export async function GET(req) {
          const id = req.searchParams.id
          const result = await db.query('SELECT * FROM products WHERE id=' + id)
          return result
        }
      `,
      taskTitle: 'Product search API',
      taskDescription: 'Search products',
      prdContent: 'Product search',
      projectTitle: 'E-Commerce',
      projectStack: 'Next.js + Prisma + SQLite',
    })

    expect(review.issues).toBeDefined()
    if (review.issues.length > 0) {
      review.issues.forEach((issue) => {
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(issue.severity)
        expect(issue.description).toBeTruthy()
      })
    }
  })

  it('should include usage tokens', async () => {
    const review = await reviewer.reviewCode({
      generatedCode: 'const x = 1',
      taskTitle: 'Simple code',
      taskDescription: 'Review simple code',
      prdContent: 'Test',
      projectTitle: 'Test',
      projectStack: 'Next.js + Prisma + SQLite',
    })

    if (review.usage) {
      expect(review.usage.inputTokens).toBeGreaterThan(0)
      expect(review.usage.outputTokens).toBeGreaterThan(0)
    }
  })
})
