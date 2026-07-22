// NEXUS-P2A-006: Validation schemas using Zod
import { z } from 'zod'

// Task schema - only title and description from AI
// Server assigns order
export const GeneratedTaskSchema = z.object({
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description required').max(1000, 'Description too long'),
})

export type GeneratedTask = z.infer<typeof GeneratedTaskSchema>

// Task generation response from TaskGenerator
export const TaskGenerationResponseSchema = z.object({
  tasks: z.array(GeneratedTaskSchema).min(4, 'Minimum 4 tasks').max(8, 'Maximum 8 tasks'),
})

export type TaskGenerationResponse = z.infer<typeof TaskGenerationResponseSchema>

// Validate and normalize generated tasks
export function validateAndNormalizeTasks(
  data: unknown
): GeneratedTask[] {
  const response = TaskGenerationResponseSchema.parse(data)

  // Normalize: trim strings
  return response.tasks.map(task => ({
    title: task.title.trim(),
    description: task.description.trim(),
  }))
}
