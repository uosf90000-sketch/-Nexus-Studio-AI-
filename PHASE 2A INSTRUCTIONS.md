# PHASE_2A_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phase 1 is complete and merged. This builds directly on it.

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md` — the binding architecture (single Next.js app, Prisma + SQLite)
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`

If anything you're about to build isn't supported by these docs, **stop and ask** — don't invent scope.

---

## 1. What we are building right now

**Only task generation and display. No code execution.**

**Take an existing project's PRD → generate a structured, ordered list of tasks → save them → display them in the project view.**

That's the entire scope. The Builder (writing code), the Reviewer, and GitHub integration are **later phases (2B, 2C)** — do **not** build them now.

---

## 2. Hard constraints

- Same single Next.js app from Phase 1. TypeScript. Tailwind + shadcn/ui. Prisma + SQLite.
- **Reuse** the existing `AgentAdapter` and Claude adapter from Phase 1 — do not create a new provider layer.
- **No code execution.** The tasks are data (text records), not something the system runs.
- **No GitHub calls, no Builder, no Reviewer** in this phase.
- All secrets stay in `.env.local`. Never log a key. Reuse the existing redaction helper.
- **Do not create any folder or layer that Phase-2A code doesn't actually use.**
- Check compatible package versions before installing anything new (likely nothing new is needed).

---

## 3. Database (additions for this phase)

Add a `Task` model to the Prisma schema. Minimum fields:

- `id` (task identifier, e.g. `NEXUS-T-001` style or a generated id)
- `projectId` (relation to Project)
- `title`
- `description`
- `order` (integer — the sequence position)
- `status` (enum/string: default `PENDING`)
- `createdAt`

Do **not** add `TaskRun`, `AgentRun`, `Review`, or execution-related tables yet — those belong to Phase 2B.

---

## 4. Agents (this phase)

- Add **one capability to the Planner** (or a small `taskGenerator` in the agents module): given a PRD, return an ordered list of tasks.
- Reuse the existing Claude adapter. Same cost-tracking path as Phase 1 (record a `CostEntry`).
- The output must be structured (JSON array of tasks), parsed safely, and saved.

---

## 5. Task IDs & ADR

- Every file/task in this phase gets an ID like `NEXUS-P2A-001`, `NEXUS-P2A-002`, …
- No new ADR needed unless you make a structural decision; if you do, add `ADR-0002-…`.

---

## 6. Expected files (Phase 2A)

```
prisma/schema.prisma                    # add Task model + migration
src/modules/agents/task-generator.ts    # PRD -> ordered task list (reuses adapter)
src/modules/tasks/service.ts            # create/list tasks for a project
src/app/api/projects/[id]/tasks/        # route: generate + fetch tasks
src/app/projects/[id]/                  # update project view to show tasks
tests/task-generator.test.ts            # mocked provider (reuse tests/setup.ts)
tests/tasks.test.ts                     # task service tests
```

Create only what's needed. Reuse Phase 1 files; don't duplicate.

---

## 7. Acceptance criteria (Phase 2A is done when)

1. From a project that already has a PRD, I click "generate tasks" and see an **ordered list of clear tasks** saved and displayed in the project view — no manual DB editing.
2. Each task has a title, description, and order.
3. The generation **cost is recorded** in `CostEntry` and shown.
4. **No secret/key is ever printed** to logs.
5. `Build` + `Lint` + `Tests` all pass — and tests use the **mocked** provider (no real API key, no network), consistent with Phase 1.
6. If the provider call fails or returns unparseable output, it **stops with a clear error** (max 2 attempts) — no infinite loop, no half-saved garbage.

---

## 8. Rules

- No fake/placeholder tasks that pretend generation worked when it didn't.
- No code execution of any kind.
- No real secrets in the repo.
- Stop on any security conflict or data-loss risk.
- **Do not start Phase 2B (Builder) until I approve Phase 2A.**

---

## 9. When done, report

1. The changed/added files with their task IDs and status.
2. Build / Lint / Test results (all passing, mocked).
3. A real example: paste the actual task list generated from a real PRD, so I can judge its quality.
4. Any issues or limitations you hit.
5. Proposed Phase 2B scope (do not implement it).
