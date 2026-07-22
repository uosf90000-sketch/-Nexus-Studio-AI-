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

    const prompt = `You are a project planning expert. Given the following product requirements document (PRD), generate an ordered list of implementation tasks.

Each task should be:
- Clear and actionable
- Focused on a single responsibility
- In logical order of dependencies
- Estimated for a single developer session

PRD:
${prd}

Generate exactly 3-5 tasks. Format your response as JSON with an array of tasks, each with ONLY "title" (string) and "description" (string). The server will assign sequential order numbers.

Example format:
{
  "tasks": [
    {"title": "Set up project structure", "description": "Initialize the project with necessary folders and configuration files."},
    {"title": "Implement core functionality", "description": "Build the main features described in the PRD."}
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
