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

// Review schemas (Phase 2C1)
export const ReviewIssueSchema = z.object({
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  description: z.string().min(1, 'Issue description required').max(500),
})

export const ReviewSchema = z.object({
  verdict: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
  summary: z.string().min(1, 'Summary required').max(500),
  issues: z.array(ReviewIssueSchema).default([]),
  worksOnStack: z.boolean(),
})

export type ReviewIssue = z.infer<typeof ReviewIssueSchema>
export type Review = z.infer<typeof ReviewSchema>

// Validate and normalize review
export function validateAndNormalizeReview(data: unknown): Review {
  const review = ReviewSchema.parse(data)
  return {
    verdict: review.verdict,
    summary: review.summary.trim(),
    issues: review.issues,
    worksOnStack: review.worksOnStack,
  }
}
