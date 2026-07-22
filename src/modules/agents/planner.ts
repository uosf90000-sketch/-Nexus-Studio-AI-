// NEXUS-P1-007: Planner agent
// Role: idea -> summary + short PRD
// Uses Claude adapter to generate summaries and product requirements.

import { ClaudeAdapter } from './claude-adapter'
import type { AgentInput, AgentOutput } from './adapter'
import { logSafe } from '@/lib/redact'

interface PlannerOutput {
  summary: string
  shortPrd: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export class Planner {
  private adapter = new ClaudeAdapter()

  async generateSummaryAndPRD(idea: string): Promise<PlannerOutput> {
    logSafe(`Planner: generating summary + PRD for idea`)

    const prompt = `You are a product planning assistant. Given the following idea, generate:
1. A brief summary (2-3 sentences)
2. A short product requirements document (max 200 words) with sections: Overview, Key Features, Success Metrics

Idea: ${idea}

Format your response as JSON with keys "summary" and "shortPrd".`

    const input: AgentInput = {
      role: 'planner',
      prompt,
      context: { ideaLength: idea.length },
    }

    try {
      const output = await this.adapter.run(input)

      let parsed
      try {
        parsed = JSON.parse(output.text)
      } catch {
        // If JSON parse fails, extract from text
        logSafe('Could not parse Claude output as JSON, extracting manually')
        parsed = {
          summary: idea.substring(0, 150),
          shortPrd: output.text,
        }
      }

      return {
        summary: parsed.summary || '',
        shortPrd: parsed.shortPrd || '',
        usage: output.usage,
      }
    } catch (error) {
      logSafe(`Planner error: ${error instanceof Error ? error.message : 'unknown'}`)
      throw error
    }
  }
}
