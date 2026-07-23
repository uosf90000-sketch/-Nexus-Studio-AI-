// NEXUS-P5-004: Google Gemini Adapter for Council (Analyst)

import { AgentAdapter, AgentRequest, AgentResponse } from './types'
import { getConfig } from '../config'
import { logSafe } from '../redact'
import { z } from 'zod'

const GeminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string(),
          })
        ),
      }),
    })
  ),
  usageMetadata: z.object({
    promptTokenCount: z.number(),
    candidatesTokenCount: z.number(),
  }),
})

export class GeminiAdapter implements AgentAdapter {
  private apiKey: string
  private model: string

  constructor() {
    const config = getConfig()
    if (!config.google.apiKey) {
      throw new Error('Gemini adapter: GOOGLE_API_KEY is required but not set')
    }
    this.apiKey = config.google.apiKey
    this.model = config.google.model
  }

  async call(request: AgentRequest): Promise<AgentResponse> {
    const systemInstruction = request.systemPrompt
    const userMessage = request.userMessage

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: {
                text: systemInstruction,
              },
            },
            contents: [
              {
                parts: [
                  {
                    text: userMessage,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1500,
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const validated = GeminiResponseSchema.parse(data)

      const content = validated.candidates[0].content.parts[0].text
      const inputTokens = validated.usageMetadata.promptTokenCount
      const outputTokens = validated.usageMetadata.candidatesTokenCount

      // Gemini 2.0 Flash pricing: $0.075/1M input, $0.30/1M output
      const inputCost = (inputTokens / 1_000_000) * 0.075
      const outputCost = (outputTokens / 1_000_000) * 0.30
      const cost = inputCost + outputCost

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
        provider: 'google',
        model: this.model,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`Gemini adapter error: ${errorMsg}`)
      throw error
    }
  }

  getProvider(): string {
    return 'google'
  }

  getModel(): string {
    return this.model
  }
}
