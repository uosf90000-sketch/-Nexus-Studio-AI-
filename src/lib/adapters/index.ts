// NEXUS-P5-007: Adapter registry and role mapping

import { AgentAdapter } from './types'
import { OpenAIAdapter } from './openai-adapter'
import { AnthropicAdapter } from './anthropic-adapter'
import { GeminiAdapter } from './gemini-adapter'

export type CouncilRole = 'DIRECTOR' | 'ENGINEER' | 'ANALYST'

interface RoleMapping {
  role: CouncilRole
  provider: string
  adapter: AgentAdapter
}

// Configuration: map roles to adapters
// This is where you can swap providers if needed
function initializeAdapters(): Map<CouncilRole, AgentAdapter> {
  const mapping = new Map<CouncilRole, AgentAdapter>()

  try {
    mapping.set('DIRECTOR', new OpenAIAdapter()) // ChatGPT makes the final call
  } catch (error) {
    console.error('Failed to initialize Director (OpenAI):', error instanceof Error ? error.message : error)
  }

  try {
    mapping.set('ENGINEER', new AnthropicAdapter()) // Claude evaluates technical feasibility
  } catch (error) {
    console.error('Failed to initialize Engineer (Anthropic):', error instanceof Error ? error.message : error)
  }

  try {
    mapping.set('ANALYST', new GeminiAdapter()) // Gemini analyzes market dynamics
  } catch (error) {
    console.error('Failed to initialize Analyst (Google):', error instanceof Error ? error.message : error)
  }

  return mapping
}

let adapterRegistry: Map<CouncilRole, AgentAdapter> | null = null

export function getAdapterRegistry(): Map<CouncilRole, AgentAdapter> {
  if (!adapterRegistry) {
    adapterRegistry = initializeAdapters()
  }
  return adapterRegistry
}

export function getAdapter(role: CouncilRole): AgentAdapter {
  const registry = getAdapterRegistry()
  const adapter = registry.get(role)
  if (!adapter) {
    throw new Error(`No adapter initialized for role: ${role}`)
  }
  return adapter
}

export { OpenAIAdapter, AnthropicAdapter, GeminiAdapter }
export type { AgentAdapter, AgentRequest, AgentResponse } from './types'
