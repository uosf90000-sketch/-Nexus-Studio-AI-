// NEXUS-P1-003: Secret redaction helper
// Never log API keys, tokens, or sensitive data.
// Use this before logging or returning any string that might contain secrets.

const SECRETS_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/gi, // Anthropic keys (sk-ant-...)
  /sk-[A-Za-z0-9_-]{20,}/gi, // Generic OpenAI-style keys
  /ANTHROPIC_API_KEY=.+/gi,
  /DATABASE_URL=.+/gi,
  /(?<=bearer\s)[\w-]+/gi, // Bearer tokens
]

export function redact(text: string | unknown): string {
  if (typeof text !== 'string') {
    return typeof text === 'object' ? JSON.stringify(text) : String(text)
  }

  let redacted = text
  SECRETS_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, '[REDACTED]')
  })
  return redacted
}

export function logSafe(message: string, data?: unknown) {
  const safeMessage = redact(message)
  const safeData = data ? redact(JSON.stringify(data)) : undefined
  if (safeData) {
    console.log(safeMessage, safeData)
  } else {
    console.log(safeMessage)
  }
}
