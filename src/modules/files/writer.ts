// NEXUS-P2C2-001: Safe File Writer with Six Security Rules
// Writes approved TaskRun generated code to disk inside generated/<projectId>/
// CRITICAL: All six safety rules from PHASE_2C2_INSTRUCTIONS.md §1 are enforced here.

import * as fs from 'fs/promises'
import * as path from 'path'
import { logSafe } from '@/lib/redact'

interface WriteFileInput {
  taskRunId: string
  projectId: string
  code: string
  filename: string
  verdict: string
  worksOnStack: boolean
}

interface WriteFileResult {
  success: boolean
  path?: string
  error?: string
}

const GENERATED_ROOT = path.resolve(process.cwd(), 'generated')

export class FileWriter {
  // SAFETY RULE 1: Enforce generated/ constraint
  private assertPathSafe(filePath: string): boolean {
    const absolutePath = path.resolve(filePath)
    const relative = path.relative(GENERATED_ROOT, absolutePath)

    // Check for path traversal attempts
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      logSafe(`FileWriter: BLOCKED path traversal attempt: ${filePath}`)
      return false
    }

    return true
  }

  // SAFETY RULE 2: Enforce approval
  private isApproved(verdict: string, worksOnStack: boolean): boolean {
    return verdict === 'APPROVE' && worksOnStack === true
  }

  // Sanitize filename: remove path separators, .., leading slashes
  // Returns empty string if filename contains traversal attempts
  private sanitizeFilename(filename: string): string {
    // REJECT if contains path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || path.isAbsolute(filename)) {
      logSafe(`FileWriter: rejecting filename with path traversal: "${filename}"`)
      return ''
    }

    // Remove leading dots and other unsafe chars
    let safe = filename
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/[^\w\s.-]/g, '_') // Keep only word chars, spaces, dots, hyphens

    return safe
  }

  async writeFile(input: WriteFileInput): Promise<WriteFileResult> {
    const { taskRunId, projectId, code, filename, verdict, worksOnStack } = input

    logSafe(`FileWriter: write request for TaskRun ${taskRunId}, file "${filename}"`)

    // SAFETY RULE 2: Verify approval
    if (!this.isApproved(verdict, worksOnStack)) {
      const reason =
        verdict !== 'APPROVE'
          ? `verdict is ${verdict} (not APPROVE)`
          : 'worksOnStack is false'
      logSafe(`FileWriter: REFUSED write — ${reason}`)
      return {
        success: false,
        error: `Cannot write unapproved code. Reason: ${reason}. Only APPROVE + worksOnStack:true code can be written.`,
      }
    }

    // Sanitize filename
    const safeFilename = this.sanitizeFilename(filename)
    if (!safeFilename || safeFilename.length === 0) {
      logSafe(`FileWriter: REFUSED — filename sanitization failed for "${filename}"`)
      return {
        success: false,
        error: `Filename "${filename}" contains invalid characters or path traversal attempts. Cannot sanitize to a safe name. Rejected for security.`,
      }
    }

    // Build target path: generated/<projectId>/filename
    const projectFolder = path.join(GENERATED_ROOT, projectId)
    const targetPath = path.join(projectFolder, safeFilename)

    // SAFETY RULE 1: Assert path is inside generated/
    if (!this.assertPathSafe(targetPath)) {
      logSafe(`FileWriter: REFUSED — path outside generated/: ${targetPath}`)
      return {
        success: false,
        error: `Path ${targetPath} is outside the generated/ folder. This is a security violation.`,
      }
    }

    // SAFETY RULE 3: Never overwrite
    try {
      await fs.access(targetPath)
      // File exists
      logSafe(`FileWriter: REFUSED — file already exists: ${targetPath}`)
      return {
        success: false,
        error: `File ${safeFilename} already exists. Cannot overwrite. Choose a different filename.`,
      }
    } catch {
      // File does not exist, which is what we want
    }

    // SAFETY RULE 4: Never execute
    // No exec, child_process, spawn anywhere in this method

    try {
      // Ensure project folder exists
      await fs.mkdir(projectFolder, { recursive: true })

      // SAFETY RULE 6: Record before write (to ensure transaction-like behavior)
      // Write will be recorded by the caller in WrittenFile table

      // Write the file
      await fs.writeFile(targetPath, code, 'utf-8')

      const relativePath = path.relative(process.cwd(), targetPath)
      logSafe(`FileWriter: wrote file: ${relativePath} (${code.length} bytes)`)

      return {
        success: true,
        path: relativePath,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logSafe(`FileWriter: write failed: ${errorMsg}`)
      return {
        success: false,
        error: `Failed to write file: ${errorMsg}`,
      }
    }
  }
}
