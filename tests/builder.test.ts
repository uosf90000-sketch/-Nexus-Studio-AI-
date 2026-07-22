// NEXUS-P2B-003: Builder Tests
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { Builder } from '@/modules/agents/builder'
import { mockFetchSuccess } from './setup'

describe('Builder', () => {
  let builder: Builder

  beforeAll(() => {
    builder = new Builder()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  it('should generate code for a specific task', async () => {
    const output = await builder.generateCode({
      taskTitle: 'Design and implement product catalog database schema',
      taskDescription:
        'Create database models for products, categories, images, and ratings. Implement efficient indexing for search and filtering.',
      prdContent: `# E-Commerce Platform
Key Features:
- Product Catalog: products with images and ratings
- Shopping Cart: add/remove items
- Checkout: multi-step process`,
      projectTitle: 'E-Commerce Platform',
    })

    expect(output).toHaveProperty('generatedCode')
    expect(typeof output.generatedCode).toBe('string')
    expect(output.generatedCode.length).toBeGreaterThan(0)
    // Code should be stored as text, not executed or written to file
    expect(output.generatedCode).not.toContain('fs.writeFile')
    expect(output.generatedCode).not.toContain('exec(')
  })

  it('should include usage tokens', async () => {
    const output = await builder.generateCode({
      taskTitle: 'Build product search and filtering API',
      taskDescription: 'Develop REST endpoints for product search and filtering',
      prdContent: 'Product search with filters',
      projectTitle: 'E-Commerce',
    })

    if (output.usage) {
      expect(output.usage.inputTokens).toBeGreaterThan(0)
      expect(output.usage.outputTokens).toBeGreaterThan(0)
    }
  })

  it('should generate focused code for the specific task only', async () => {
    const output = await builder.generateCode({
      taskTitle: 'Implement user authentication system',
      taskDescription: 'User registration, email verification, and secure login',
      prdContent: 'Authentication with email and social login',
      projectTitle: 'E-Commerce',
    })

    expect(output.generatedCode.length).toBeGreaterThan(0)
    // Code should be focused on the task, not generic
    expect(output.generatedCode.toLowerCase()).not.toContain('set up project')
    expect(output.generatedCode.toLowerCase()).not.toContain('build ui')
  })

  it('should never return empty code', async () => {
    const output = await builder.generateCode({
      taskTitle: 'Integrate payment gateway',
      taskDescription: 'Add Stripe and PayPal payment processing',
      prdContent: 'Payment processing with multiple providers',
      projectTitle: 'E-Commerce',
    })

    expect(output.generatedCode).toBeTruthy()
    expect(output.generatedCode.trim().length).toBeGreaterThan(0)
  })
})
