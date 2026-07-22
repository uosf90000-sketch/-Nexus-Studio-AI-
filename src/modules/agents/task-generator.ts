// NEXUS-P2A-001: Task Generator agent
// Role: PRD -> list of tasks (title + description only)
// Server assigns order deterministically
// Uses Claude adapter to generate structured tasks from a PRD

import { ClaudeAdapter } from './claude-adapter'
import type { AgentInput } from './adapter'
import { logSafe } from '@/lib/redact'
import { validateAndNormalizeTasks } from '@/lib/schemas'

interface GeneratedTask {
  title: string
  description: string
}

interface TaskGeneratorOutput {
  tasks: GeneratedTask[]
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export class TaskGenerator {
  private adapter = new ClaudeAdapter()

  async generateTasks(prd: string, projectTitle: string): Promise<TaskGeneratorOutput> {
    logSafe(`TaskGenerator: generating tasks from PRD for project "${projectTitle}"`)

    const prompt = `You are a technical architect. Analyze the PRD below and generate concrete, specific implementation tasks derived directly from the stated features and requirements.

CRITICAL RULES:
1. **Extract from PRD Features**: Each task must map to a specific feature, requirement, or component mentioned in the PRD. Do NOT generate generic tasks like "build UI" or "implement core functionality".
2. **Be Specific**: Task titles should reference the actual feature (e.g., "Build product search and filtering" not "Build user interface").
3. **Implementation-Ready**: Each task must be actionable by a developer in 1-2 sessions. Include technical context.
4. **Logical Order**: Order by dependencies (setup → data models → APIs → UI).
5. **No Padding**: Do NOT add extra tasks beyond what the PRD requires. Quantity should match feature complexity.

PRD for "${projectTitle}":
${prd}

INSTRUCTIONS:
1. Identify all major features/components in the PRD
2. For each feature, create a focused, specific task that a developer can implement
3. Generate 4-8 tasks total (scale with PRD complexity)
4. Example for e-commerce PRD:
   - "Implement product catalog database and search API" (not "build core functionality")
   - "Create shopping cart management with item persistence" (not "build UI")
   - "Integrate payment gateway with multiple provider support" (not "payment features")

Return ONLY valid JSON:
{
  "tasks": [
    {"title": "specific task title derived from PRD feature", "description": "detailed implementation steps and technical context"},
    ...
  ]
}`

    const input: AgentInput = {
      role: 'planner',
      prompt,
      context: { prdLength: prd.length, projectTitle },
    }

    try {
      const output = await this.adapter.run(input)

      let parsed
      try {
        parsed = JSON.parse(output.text)
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = output.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (jsonMatch?.[1]) {
          try {
            parsed = JSON.parse(jsonMatch[1])
          } catch {
            logSafe('Could not parse Claude output as JSON')
            throw new Error('Failed to parse task generation response as JSON')
          }
        } else {
          logSafe('Could not parse Claude output as JSON')
          throw new Error('Failed to parse task generation response as JSON')
        }
      }

      // Validate using strict schema
      const tasks = validateAndNormalizeTasks(parsed)

      if (tasks.length === 0) {
        throw new Error('Task generation produced no valid tasks')
      }

      return {
        tasks,
        usage: output.usage,
      }
    } catch (error) {
      logSafe(
        `TaskGenerator error: ${error instanceof Error ? error.message : 'unknown'}`
      )
      throw error
    }
  }
}
