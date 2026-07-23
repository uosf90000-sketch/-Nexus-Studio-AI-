// NEXUS-P5-008: Council session orchestration

import { prisma } from '@/lib/prisma'
import { getAdapter, CouncilRole } from '@/lib/adapters'
import { getConfig } from '@/lib/config'
import { z } from 'zod'

export type Verdict = 'PROCEED' | 'REVISE' | 'REJECT'

const VerdictSchema = z.enum(['PROCEED', 'REVISE', 'REJECT'])

interface CouncilConfig {
  maxRounds: number
  maxCostUSD: number
}

export class CouncilSession {
  private projectId: string
  private idea: string
  private sessionId: string
  private config: CouncilConfig
  private totalCost: number = 0

  constructor(projectId: string, idea: string, config: Partial<CouncilConfig> = {}) {
    this.projectId = projectId
    this.idea = idea
    this.sessionId = '' // Set after session creation
    this.config = {
      maxRounds: config.maxRounds || 2,
      maxCostUSD: config.maxCostUSD || getConfig().costs.warningThreshold,
    }
  }

  async run(): Promise<{ verdict: Verdict; reason: string; cost: number }> {
    // Create session in database
    const session = await prisma.councilSession.create({
      data: {
        projectId: this.projectId,
        status: 'ACTIVE',
        totalCost: 0,
      },
    })
    this.sessionId = session.id

    try {
      // Conduct deliberation
      for (let round = 1; round <= this.config.maxRounds; round++) {
        await this.conductRound(round)

        if (this.totalCost > this.config.maxCostUSD) {
          await this.updateSession('FAILED', null, null)
          throw new Error(
            `Cost threshold exceeded ($${this.totalCost.toFixed(2)} > $${this.config.maxCostUSD})`
          )
        }
      }

      // Get verdict from Director
      const directorRole: CouncilRole = 'DIRECTOR'
      const { verdict, reason } = await this.getVerdict(directorRole)

      // Update session with final verdict
      await this.updateSession('COMPLETED', verdict, reason)

      return {
        verdict,
        reason,
        cost: this.totalCost,
      }
    } catch (error) {
      await this.updateSession('FAILED', null, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  private async conductRound(roundNumber: number): Promise<void> {
    const roles: CouncilRole[] = roundNumber === 1 ? ['ANALYST', 'ENGINEER', 'DIRECTOR'] : ['ANALYST', 'ENGINEER']

    for (let index = 0; index < roles.length; index++) {
      const role = roles[index]
      await this.getCouncilMemberOpinion(role, roundNumber, index)
    }
  }

  private async getCouncilMemberOpinion(role: CouncilRole, round: number, order: number): Promise<void> {
    const adapter = getAdapter(role)
    const systemPrompt = this.getSystemPrompt(role)
    const userMessage = await this.getUserMessage(role, round)

    try {
      const response = await adapter.call({
        systemPrompt,
        userMessage,
      })

      // Save message to database
      await prisma.councilMessage.create({
        data: {
          sessionId: this.sessionId,
          round,
          role,
          provider: response.provider,
          model: response.model,
          content: response.content,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          cost: response.cost,
          order,
        },
      })

      this.totalCost += response.cost
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Log failure but continue
      await prisma.councilMessage.create({
        data: {
          sessionId: this.sessionId,
          round,
          role,
          provider: 'unknown',
          model: 'unknown',
          content: `[Failed to generate opinion: ${errorMsg}]`,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          order,
        },
      })
    }
  }

  private getSystemPrompt(role: CouncilRole): string {
    const baseContext = `You are part of a council reviewing a product idea. Your role is specific:
Idea: "${this.idea}"

Be direct, concise, and base your response on real expertise.`

    switch (role) {
      case 'ANALYST':
        return `${baseContext}

Your role: ANALYST (Market perspective)
Focus on: market demand, competitive landscape, differentiation, and user value.
Ask: Does this solve a real problem? Who competes already? Is the idea differentiated?`

      case 'ENGINEER':
        return `${baseContext}

Your role: ENGINEER (Technical perspective)
Focus on: feasibility, complexity, effort estimate, technical risks, and stack fit.
Ask: Can we build this? How hard? What could go wrong technically?`

      case 'DIRECTOR':
        return `${baseContext}

Your role: DIRECTOR (Decision maker)
You speak last. Reference what the Analyst and Engineer actually said.
If they disagree on a fact, state the disagreement explicitly.
Issue a verdict: PROCEED | REVISE | REJECT`

      default:
        return baseContext
    }
  }

  private async getUserMessage(role: CouncilRole, round: number): Promise<string> {
    // Get all previous messages as context
    const previousMessages = await prisma.councilMessage.findMany({
      where: {
        sessionId: this.sessionId,
        round: { lt: round },
      },
      orderBy: [{ round: 'asc' }, { order: 'asc' }],
    })

    let context = ''
    if (previousMessages.length > 0) {
      context = '\n\nPrevious deliberation:\n'
      context += previousMessages
        .map(
          (msg) =>
            `[Round ${msg.round}, ${msg.role}]: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}`
        )
        .join('\n')
    }

    if (round === 1) {
      return `Please give your perspective on this idea in 2-3 sentences.${context}`
    } else {
      return `The council has shared opening positions. Please respond to each other and to any points the Director raised.${context}`
    }
  }

  private async getVerdict(role: CouncilRole): Promise<{ verdict: Verdict; reason: string }> {
    const previousMessages = await prisma.councilMessage.findMany({
      where: {
        sessionId: this.sessionId,
      },
      orderBy: [{ round: 'asc' }, { order: 'asc' }],
    })

    const context = previousMessages.map((msg) => `[${msg.role}]: ${msg.content}`).join('\n\n')

    const adapter = getAdapter(role)
    const systemPrompt = `You are the Director of a product review council.
You must issue a final verdict. You can choose ONE:
- PROCEED: Move forward with this idea
- REVISE: The idea needs changes. Specify what.
- REJECT: This idea shouldn't be pursued.

Base your decision on what the Analyst and Engineer said. If they disagree, state the disagreement.
Format your response as JSON: {"verdict": "PROCEED|REVISE|REJECT", "reason": "..."}`

    const response = await adapter.call({
      systemPrompt,
      userMessage: `Here is the full council discussion:\n\n${context}\n\nIssue your verdict as JSON.`,
    })

    try {
      const parsed = JSON.parse(response.content)
      const verdict = VerdictSchema.parse(parsed.verdict)
      return {
        verdict,
        reason: parsed.reason || 'No reason provided',
      }
    } catch (error) {
      // Fallback: extract from text
      if (response.content.includes('PROCEED')) return { verdict: 'PROCEED', reason: response.content }
      if (response.content.includes('REJECT')) return { verdict: 'REJECT', reason: response.content }
      return { verdict: 'REVISE', reason: response.content }
    }
  }

  private async updateSession(status: string, verdict: Verdict | null, reason: string | null): Promise<void> {
    await prisma.councilSession.update({
      where: { id: this.sessionId },
      data: {
        status,
        verdict,
        verdictReason: reason,
        totalCost: this.totalCost,
      },
    })
  }
}
