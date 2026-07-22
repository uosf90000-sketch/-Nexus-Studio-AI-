// NEXUS-P1-006: Claude provider adapter
// Implements AgentAdapter for Anthropic Claude API.
// Reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL from env.

import { getConfig } from '@/lib/config'
import { logSafe } from '@/lib/redact'
import type { AgentAdapter, AgentInput, AgentOutput, CostEstimate } from './adapter'

interface AnthropicMessage {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

// Rough token pricing (USD per 1M tokens) - verify current rates
const CLAUDE_PRICING = {
  inputTokensPerMillion: 3, // $3 per 1M input tokens
  outputTokensPerMillion: 15, // $15 per 1M output tokens
}

export class ClaudeAdapter implements AgentAdapter {
  role = 'planner' as const

  async run(input: AgentInput): Promise<AgentOutput> {
    const config = getConfig()

    logSafe(`Claude adapter: running ${input.role} with ${input.prompt.length} chars`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropic.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logSafe(`Claude API error: ${response.status}`)
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = (await response.json()) as AnthropicMessage

    return {
      role: input.role,
      text: data.content[0]?.text || '',
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    }
  }

  estimateCost(input: AgentInput): CostEstimate {
    // Rough estimate: ~1 token per 4 chars (actual varies by content)
    const estimatedInputTokens = Math.ceil(input.prompt.length / 4)
    const estimatedOutputTokens = 500 // conservative avg

    const inputCost = (estimatedInputTokens / 1_000_000) * CLAUDE_PRICING.inputTokensPerMillion
    const outputCost = (estimatedOutputTokens / 1_000_000) * CLAUDE_PRICING.outputTokensPerMillion

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUSD: inputCost + outputCost,
    }
  }
}
