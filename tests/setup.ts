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
export function mockFetchSuccess() {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'msg_test',
          type: 'message',
          content: [{ type: 'text', text: JSON.stringify(mockClaudeResponse) }],
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        }),
        { status: 200 }
      )
    )
  )
}

export function mockFetchError(status: number) {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: 'Mock error' }), { status })
    )
  )
}
