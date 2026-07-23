// NEXUS-P5-003: OpenAI Adapter for Council (ChatGPT — Director)

import { AgentAdapter, AgentRequest, AgentResponse } from './types'
import { getConfig } from '../config'
import { logSafe } from '../redact'
import { z } from 'zod'

const OpenAIResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
  }),
})

export class OpenAIAdapter implements AgentAdapter {
  private apiKey: string
  private model: string

  constructor() {
    const config = getConfig()
    if (!config.openai.apiKey) {
      throw new Error('OpenAI adapter: OPENAI_API_KEY is required but not set')
    }
    this.apiKey = config.openai.apiKey
    this.model = config.openai.model
  }

  async call(request: AgentRequest): Promise<AgentResponse> {
    const messages = [
      {
        role: 'system' as const,
        content: request.systemPrompt,
      },
      {
        role: 'user' as const,
        content: request.userMessage,
      },
    ]

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const validated = OpenAIResponseSchema.parse(data)

      const content = validated.choices[0].message.content
      const inputTokens = validated.usage.prompt_tokens
      const outputTokens = validated.usage.completion_tokens

      // Rough cost estimation: GPT-4o pricing
      const inputCost = (inputTokens / 1_000_000) * 2.5
      const outputCost = (outputTokens / 1_000_000) * 10
      const cost = inputCost + outputCost

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
        provider: 'openai',
        model: this.model,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`OpenAI adapter error: ${errorMsg}`)
      throw error
    }
  }

  getProvider(): string {
    return 'openai'
  }

  getModel(): string {
    return this.model
  }
}
