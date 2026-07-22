// NEXUS-P2C1-001: Reviewer Agent
// Reads generated code (from TaskRun) and produces a structured review
// Output is TEXT/REVIEW only — never modifies code, never writes files, never executes

import { ClaudeAdapter } from './claude-adapter'
import type { AgentInput } from './adapter'
import { logSafe } from '@/lib/redact'
import { validateAndNormalizeReview } from '@/lib/schemas'

interface ReviewContext {
  generatedCode: string
  taskTitle: string
  taskDescription: string
  prdContent: string
  projectTitle: string
  projectStack: string // e.g., "Next.js + Prisma + SQLite"
}

interface ReviewerOutput {
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'
  summary: string
  issues: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; description: string }>
  worksOnStack: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export class Reviewer {
  private adapter = new ClaudeAdapter()

  async reviewCode(context: ReviewContext): Promise<ReviewerOutput> {
    logSafe(`Reviewer: reviewing code for task "${context.taskTitle}" in project "${context.projectTitle}"`)

    const prompt = `You are an expert code reviewer. Your job is to review implementation code for a specific task and identify issues that would prevent it from working correctly on the target stack.

CRITICAL: Your review must focus on **stack/environment compatibility**, not just general style. The developer knows JavaScript/TypeScript; your job is to flag issues they may not see: database constraints, framework limitations, missing dependencies, etc.

PROJECT STACK:
${context.projectStack}

PROJECT: ${context.projectTitle}

PRODUCT REQUIREMENTS:
${context.prdContent}

TASK:
Title: ${context.taskTitle}
Description: ${context.taskDescription}

GENERATED CODE TO REVIEW:
\`\`\`
${context.generatedCode}
\`\`\`

REVIEW INSTRUCTIONS:
1. Does this code actually work on ${context.projectStack}? (This is the KEY question.)
   - SQLite does NOT support: @@fulltext, foreign keys beyond basic cascade, JSON operators, window functions
   - Prisma migrations matter — check if schema is valid
   - Next.js route handlers must import correctly, handle both GET/POST as needed
   - Next.js 13+ uses /app directory with async components
2. Will this code compile and run without errors on the target stack?
3. Are dependencies missing or versions incompatible?
4. Are there security issues (SQL injection, XSS, missing validation)?
5. Are there obvious bugs or logic errors?

Return ONLY a JSON object (no markdown, no explanation):
{
  "verdict": "APPROVE" or "REQUEST_CHANGES" or "REJECT",
  "summary": "One or two sentences: overall assessment.",
  "issues": [
    {
      "severity": "HIGH" or "MEDIUM" or "LOW",
      "description": "Specific issue found"
    }
  ],
  "worksOnStack": true or false
}

Examples:
- HIGH severity: @@fulltext on SQLite, SQL injection, missing required import
- MEDIUM severity: potential null reference, missing error handling
- LOW severity: code style, missing comments

Be strict: if code won't actually work on the stack, say so. A reviewer that approves broken code is worthless.`

    const input: AgentInput = {
      role: 'reviewer',
      prompt,
      context: {
        taskTitle: context.taskTitle,
        projectTitle: context.projectTitle,
        codeLength: context.generatedCode.length,
      },
    }

    try {
      const output = await this.adapter.run(input)

      if (!output.text || output.text.trim().length === 0) {
        throw new Error('Reviewer returned empty review')
      }

      let parsed
      try {
        // Try direct parse
        parsed = JSON.parse(output.text)
      } catch {
        // Try extracting from markdown code blocks
        const jsonMatch = output.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (jsonMatch?.[1]) {
          try {
            parsed = JSON.parse(jsonMatch[1])
          } catch {
            logSafe('Could not parse reviewer output as JSON')
            throw new Error('Failed to parse review response as JSON')
          }
        } else {
          logSafe('Could not parse reviewer output as JSON')
          throw new Error('Failed to parse review response as JSON')
        }
      }

      // Validate with Zod
      const review = validateAndNormalizeReview(parsed)

      logSafe(`Reviewer: review complete for "${context.taskTitle}" — verdict: ${review.verdict}`)

      return {
        verdict: review.verdict,
        summary: review.summary,
        issues: review.issues,
        worksOnStack: review.worksOnStack,
        usage: output.usage,
      }
    } catch (error) {
      logSafe(`Reviewer error: ${error instanceof Error ? error.message : 'unknown'}`)
      throw error
    }
  }
}
