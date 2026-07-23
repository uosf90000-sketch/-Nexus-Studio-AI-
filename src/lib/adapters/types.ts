// NEXUS-P5-005: Council adapter interface

export interface AgentRequest {
  systemPrompt: string
  userMessage: string
}

export interface AgentResponse {
  content: string
  inputTokens: number
  outputTokens: number
  cost: number
  provider: string
  model: string
}

export interface AgentAdapter {
  call(request: AgentRequest): Promise<AgentResponse>
  getProvider(): string
  getModel(): string
}
