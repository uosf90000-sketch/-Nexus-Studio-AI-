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
      title: 'Set up project structure',
      description: 'Initialize the project with necessary folders and configuration files.',
      order: 1,
    },
    {
      title: 'Implement core functionality',
      description: 'Build the main features described in the PRD.',
      order: 2,
    },
    {
      title: 'Create API endpoints',
      description: 'Develop REST API routes for data access and manipulation.',
      order: 3,
    },
    {
      title: 'Build user interface',
      description: 'Create UI components and pages for user interaction.',
      order: 4,
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

    return new Response(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        content: [{ type: 'text', text: JSON.stringify(responseContent) }],
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
