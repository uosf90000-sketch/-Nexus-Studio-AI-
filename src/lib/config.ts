// NEXUS-P1-004: Configuration and validation
// Reads and validates environment variables at startup.
// All secrets must be in env vars only.

import { logSafe } from './redact'

interface Config {
  anthropic: {
    apiKey: string
    model: string
  }
  database: {
    url: string
  }
  costs: {
    warningThreshold: number
    maxRetryCount: number
  }
  app: {
    nodeEnv: 'development' | 'production'
    accessCode?: string
  }
}

function validateEnv(): Config {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env var is required')
  }

  const model = process.env.ANTHROPIC_MODEL
  if (!model) {
    throw new Error('ANTHROPIC_MODEL env var is required')
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL env var is required')
  }

  return {
    anthropic: {
      apiKey,
      model,
    },
    database: {
      url: dbUrl,
    },
    costs: {
      warningThreshold: parseFloat(process.env.COST_WARNING_THRESHOLD || '10'),
      maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT || '2', 10),
    },
    app: {
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production') || 'development',
      accessCode: process.env.APP_ACCESS_CODE,
    },
  }
}

let config: Config | null = null

export function getConfig(): Config {
  if (!config) {
    try {
      config = validateEnv()
      logSafe('Config loaded successfully')
    } catch (error) {
      console.error('Config validation failed:', error instanceof Error ? error.message : error)
      throw error
    }
  }
  return config
}
