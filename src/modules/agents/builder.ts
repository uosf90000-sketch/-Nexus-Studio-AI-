// NEXUS-P2B-001: Builder Agent
// Generates implementation code for a single task + its PRD context
// Output is TEXT ONLY — never written to files, never executed

import { ClaudeAdapter } from './claude-adapter'
import type { AgentInput } from './adapter'
import { logSafe } from '@/lib/redact'

interface BuilderTaskContext {
  taskTitle: string
  taskDescription: string
  prdContent: string
  projectTitle: string
}

interface BuilderOutput {
  generatedCode: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export class Builder {
  private adapter = new ClaudeAdapter()

  async generateCode(context: BuilderTaskContext): Promise<BuilderOutput> {
    logSafe(`Builder: generating code for task "${context.taskTitle}" in project "${context.projectTitle}"`)

    const prompt = `You are an expert full-stack developer. Given a specific implementation task and its product requirements, generate focused, production-ready code for that task ONLY.

CRITICAL: Your response is CODE ONLY. No explanations, no markdown, no philosophy. Return compilable, testable code.

PROJECT: ${context.projectTitle}

PRODUCT REQUIREMENTS:
${context.prdContent}

TASK TO IMPLEMENT:
Title: ${context.taskTitle}
Description: ${context.taskDescription}

INSTRUCTIONS:
1. Write code for the SPECIFIC task above — not the entire project.
2. Use the tech stack: Next.js, TypeScript, React, Tailwind CSS, shadcn/ui, Prisma.
3. Code must be:
   - Importable and composable (not a single monolithic file)
   - Focused on the feature described in the task
   - Include type definitions
   - Ready for testing
4. If the task is about a database model, generate the Prisma schema fragment.
5. If the task is about an API route, generate the Next.js route handler.
6. If the task is about a React component, generate the component code.
7. Always include error handling and validation.
8. No console.log beyond logging infrastructure errors. Use proper logging.
9. Assume all dependencies (React, Prisma, Next.js, etc.) are already installed.

Generate ONLY the code block(s) needed for this task. Start coding now.`

    const input: AgentInput = {
      role: 'builder',
      prompt,
      context: {
        taskTitle: context.taskTitle,
        projectTitle: context.projectTitle,
        prdLength: context.prdContent.length,
      },
    }

    try {
      const output = await this.adapter.run(input)

      if (!output.text || output.text.trim().length === 0) {
        throw new Error('Builder returned empty code')
      }

      // Store raw code text — no parsing/validation of code syntax here
      // (we're not executing it, just storing for review)
      const generatedCode = output.text.trim()

      logSafe(`Builder: generated ${generatedCode.length} chars of code for "${context.taskTitle}"`)

      return {
        generatedCode,
        usage: output.usage,
      }
    } catch (error) {
      logSafe(`Builder error: ${error instanceof Error ? error.message : 'unknown'}`)
      throw error
    }
  }
}
