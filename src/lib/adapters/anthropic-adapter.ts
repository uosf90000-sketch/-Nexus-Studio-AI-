// NEXUS-P5-006: Anthropic Adapter for Council (Claude — Engineer)

import { AgentAdapter, AgentRequest, AgentResponse } from './types'
import { getConfig } from '../config'
import { logSafe } from '../redact'
import { z } from 'zod'

const AnthropicResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string(),
    })
  ),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
})

export class AnthropicAdapter implements AgentAdapter {
  private apiKey: string
  private model: string

  constructor() {
    const config = getConfig()
    this.apiKey = config.anthropic.apiKey
    this.model = config.anthropic.model
  }

  async call(request: AgentRequest): Promise<AgentResponse> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1500,
          system: request.systemPrompt,
          messages: [
            {
              role: 'user',
              content: request.userMessage,
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const validated = AnthropicResponseSchema.parse(data)

      const content = validated.content[0].text
      const inputTokens = validated.usage.input_tokens
      const outputTokens = validated.usage.output_tokens

      // Claude 3.5 Sonnet pricing: $3/1M input, $15/1M output
      const inputCost = (inputTokens / 1_000_000) * 3
      const outputCost = (outputTokens / 1_000_000) * 15
      const cost = inputCost + outputCost

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
        provider: 'anthropic',
        model: this.model,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`Anthropic adapter error: ${errorMsg}`)
      throw error
    }
  }

  getProvider(): string {
    return 'anthropic'
  }

  getModel(): string {
    return this.model
  }
}
