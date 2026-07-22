// NEXUS-P1-005: Agent adapter interface
// Defines how agents (Planner, Builder, Reviewer) interact with different providers.
// Each provider gets its own adapter implementation.

export type AgentRole = 'planner'

export interface AgentInput {
  role: AgentRole
  prompt: string
  context?: Record<string, unknown>
}

export interface AgentOutput {
  role: AgentRole
  text: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface CostEstimate {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUSD: number
}

export interface AgentAdapter {
  role: AgentRole
  run(input: AgentInput): Promise<AgentOutput>
  estimateCost(input: AgentInput): CostEstimate
}
