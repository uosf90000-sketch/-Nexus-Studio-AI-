// NEXUS-P6-002: Codex Adapter (OpenAI — Auditor/Reviewer)

import { getConfig } from '../config'
import { logSafe } from '../redact'
import { z } from 'zod'

export const AuditVerdictSchema = z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT'])
export const IssueSeveritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])

export const AuditIssueSchema = z.object({
  severity: IssueSeveritySchema,
  file: z.string().optional(),
  description: z.string(),
})

export const AuditReportSchema = z.object({
  verdict: AuditVerdictSchema,
  summary: z.string(),
  issues: z.array(AuditIssueSchema),
  runsCorrectly: z.boolean(),
  securityConcerns: z.array(z.string()).optional(),
})

export type AuditReport = z.infer<typeof AuditReportSchema>

interface CodexRequest {
  projectDescription: string
  prdContent: string
  filesGenerated: Array<{
    path: string
    content: string
  }>
  testResults: string
  buildLog: string
}

export class CodexAdapter {
  private apiKey: string
  private model: string

  constructor() {
    const config = getConfig()
    if (!config.openai.apiKey) {
      throw new Error('Codex adapter: OPENAI_API_KEY is required but not set')
    }
    this.apiKey = config.openai.apiKey
    this.model = config.openai.model
  }

  async audit(request: CodexRequest): Promise<{ report: AuditReport; inputTokens: number; outputTokens: number; cost: number }> {
    const systemPrompt = `You are Codex, an expert code auditor. Your job is to review generated code and provide structured feedback.

You must respond with ONLY valid JSON (no markdown, no explanation outside JSON).

Respond with this structure:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  "summary": "one sentence assessment",
  "issues": [
    { "severity": "HIGH" | "MEDIUM" | "LOW", "file": "path/to/file.ts", "description": "..." }
  ],
  "runsCorrectly": true/false,
  "securityConcerns": ["concern1", "concern2"]
}`

    const userMessage = `Review this generated project:

**Description:** ${request.projectDescription}

**PRD:** ${request.prdContent.substring(0, 2000)}

**Generated Files:**
${request.filesGenerated.map((f) => `\n${f.path}:\n\`\`\`\n${f.content.substring(0, 1000)}\n\`\`\``).join('\n')}

**Test Results:**
${request.testResults}

**Build Log:**
${request.buildLog.substring(0, 1000)}

Provide your audit as JSON.`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Codex API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      const inputTokens = data.usage.prompt_tokens
      const outputTokens = data.usage.completion_tokens

      // Parse JSON from response
      let report: AuditReport
      try {
        report = AuditReportSchema.parse(JSON.parse(content))
      } catch (parseError) {
        logSafe(`Codex JSON parse error: ${parseError instanceof Error ? parseError.message : 'unknown'}`)
        // Fallback to REJECT if we can't parse
        report = {
          verdict: 'REJECT',
          summary: 'Failed to parse audit response',
          issues: [{ severity: 'HIGH', description: `Failed to parse: ${content.substring(0, 200)}` }],
          runsCorrectly: false,
        }
      }

      // Cost estimation: GPT-4o pricing
      const inputCost = (inputTokens / 1_000_000) * 2.5
      const outputCost = (outputTokens / 1_000_000) * 10
      const cost = inputCost + outputCost

      return {
        report,
        inputTokens,
        outputTokens,
        cost,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`Codex adapter error: ${errorMsg}`)
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
