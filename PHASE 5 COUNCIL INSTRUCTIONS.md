# PHASE_5_COUNCIL_INSTRUCTIONS.md — Nexus Studio AI (The Council)

> Read this file and `MVP_SYSTEM_ARCHITECTURE.md` before writing any code.
> Follow it literally. Do **not** build beyond the scope defined here.
>
> **Context:** the council is the heart of this product, not an add-on. Earlier phases
> ran everything on a single provider. This phase restores the intended design:
> multiple models with distinct roles, deliberating visibly, with an explicit
> decision protocol.

---

## 1. What we are building

**A council of three models that discusses an idea in the open, and a visible transcript of that discussion.**

The user enters an idea. The council deliberates. The user **watches the conversation happen** — who said what, why, and what it cost — and sees the final verdict.

This phase covers the **council only**. The agentic programmer (Claude Code) and auditor (Codex) come in the next phase.

---

## 2. The council — roles and providers

| Member | Provider | Role |
|---|---|---|
| **Director** | ChatGPT (OpenAI) | Frames the decision, weighs the others, issues the final verdict |
| **Engineer** | Claude (Anthropic) | Technical feasibility, complexity, stack fit, build effort, risks |
| **Analyst** | Gemini (Google) | Market, demand, existing competitors, duplication, differentiation |

Each member gets its **own adapter** behind the existing `AgentAdapter` interface. Do not assume swapping is free — each provider needs its own request/response mapping and its own tests.

**Roles are configurable** — the mapping of role → provider lives in config, not hardcoded, so a member can be swapped later.

---

## 3. The deliberation flow

```
User enters an idea
  → Council session opens
  → ROUND 1 (opening positions, in order):
       Analyst  — market, demand, who already does this, what's different
       Engineer — feasibility, complexity, effort, technical risks
       Director — frames the real decision and the open questions
  → ROUND 2 (responses — each member SEES round 1):
       Analyst and Engineer respond to each other and to the Director's framing
  → VERDICT:
       Director issues: PROCEED | REVISE | REJECT
       with a written reason and, if REVISE, what specifically to change
  → Session closes
```

**Hard limit: 2 rounds + verdict.** No open-ended debate — it costs money and rarely improves the answer. Make the round count configurable but default to 2.

Each member's turn receives the full transcript so far as context — this is a real conversation, not three isolated opinions stapled together.

---

## 4. The decision protocol (this is what makes it a council, not theatre)

- **Routine case:** the Director decides, using the Analyst's and Engineer's input. The reason must reference what they actually said.
- **Disagreement:** if the Analyst and Engineer conflict on a factual point, the Director must state the conflict explicitly and say which way it decided and why — it may not paper over it.
- **Insufficient evidence:** if the council cannot decide from what it has, the verdict is **REVISE** with the specific missing information named — never a coin-flip PROCEED.
- **The user overrides everything.** The verdict is a recommendation. The user can proceed against a REJECT, or stop after a PROCEED. Show the verdict as advice, not a gate.

---

## 5. The transcript must be visible (core requirement)

Every message is stored and displayed to the user:

- **who** spoke (role + which model)
- **what** they said, in full
- **when**, and **which round**
- **what that message cost** (tokens + cost)

Display it as a readable conversation in Arabic RTL — like watching a meeting. Not a JSON dump, not a collapsed summary. The user explicitly wants to read the debate.

Show a **running total cost for the session** at the top or bottom, always visible.

---

## 6. Database

Add:

- `CouncilSession` — id, projectId, status, verdict (PROCEED/REVISE/REJECT), verdictReason, totalCost, createdAt
- `CouncilMessage` — id, sessionId, round (int), role (DIRECTOR/ENGINEER/ANALYST), provider, model, content (text), inputTokens, outputTokens, cost, createdAt, order

Messages are ordered so the transcript replays exactly as it happened.

---

## 7. Hard constraints

- Reuse the existing `AgentAdapter` interface, redaction helper, and cost-tracking path.
- **New API keys required:** OpenAI and Google. They live in `.env.local` / Railway variables only — never logged, never in the repo. If a provider's key is missing, fail cleanly with a clear message naming which member can't speak — do **not** silently fall back to another model.
- Retry max 2 per member turn. If a member fails after retries, record the failure in the transcript ("this member couldn't respond") and let the Director proceed with what it has — do not abort the whole session.
- Validate each member's output with Zod. The Director's verdict must be one of the three allowed values.
- Cost guardrail: a session must respect `COST_WARNING_THRESHOLD`; if exceeded mid-session, stop and tell the user rather than continuing to spend.
- **No code generation in this phase.** The council only discusses and decides.

---

## 8. Task IDs

`NEXUS-P5-001`, …

---

## 9. Expected files

```
prisma/schema.prisma                        # CouncilSession + CouncilMessage (+ migration)
src/lib/adapters/openai-adapter.ts          # ChatGPT
src/lib/adapters/gemini-adapter.ts          # Gemini
src/lib/adapters/index.ts                   # role -> provider mapping from config
src/modules/council/roles.ts                # role prompts (Director / Engineer / Analyst)
src/modules/council/session.ts              # runs the rounds, enforces protocol + limits
src/app/api/projects/[id]/council/route.ts  # start a session / fetch transcript
src/app/projects/[id]/                        # UI: transcript view + verdict + running cost
tests/council-session.test.ts               # mocked — all three providers
tests/adapters.test.ts                      # per-provider mapping tests
```

---

## 10. Acceptance criteria

1. I enter an idea and see **three different models actually discuss it** over two rounds, then a verdict.
2. The full transcript is readable in Arabic RTL — who spoke, what they said, which round, what it cost.
3. Each member is genuinely a different provider (verifiable in the transcript metadata) — not the same model wearing three names.
4. The Director's verdict references what the other two actually said; a conflict between them is named explicitly, not smoothed over.
5. Session cost is visible and the guardrail stops a runaway session.
6. A missing provider key fails clearly and names the member — no silent fallback.
7. `Build` + `Lint` + `Tests` pass, all providers mocked.

---

## 11. When done, report

1. Files added/changed with task IDs.
2. Test results (mocked).
3. **A real transcript** from a real idea — the actual three-model discussion, pasted in full, so I can judge whether the debate is substantive or three models agreeing politely.
4. The exact env var names needed for OpenAI and Google — **names only, no values**.
5. Where the deliberation felt weak or repetitive — I want to know if the council is actually adding value over a single model.
