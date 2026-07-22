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
    // Parse request body to determine if this is a task generation or PRD generation
    let isTaskGeneration = false

    try {
      const body =
        options?.body || (typeof input === 'object' && input?.body ? input.body : null)
      if (body) {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body
        const message = parsed.messages?.[0]?.content || ''
        // If prompt mentions "tasks" or "implementation", it's for task generation
        isTaskGeneration =
          message.toLowerCase().includes('task') ||
          message.toLowerCase().includes('implementation')
      }
    } catch {
      // Default to PRD response if parse fails
    }

    const responseContent = isTaskGeneration ? mockTasksResponse : mockClaudeResponse

    // Wrap JSON in markdown code block to simulate real Claude behavior
    const textContent = `\`\`\`json\n${JSON.stringify(responseContent)}\n\`\`\``

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
