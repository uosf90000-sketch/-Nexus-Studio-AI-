# PHASE_2B_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phases 1 and 2A are complete and approved. This builds directly on them.

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md` — binding architecture
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`

If anything you're about to build isn't supported by these docs, **stop and ask**.

---

## 1. What we are building right now — and the ONE safety rule

**The Builder generates code for a single task and saves it as TEXT. It does NOT write files and does NOT execute anything.**

> **CRITICAL SAFETY RULE:** In this phase the Builder must **never** write to the filesystem, never create real project files, never run/execute generated code, and never touch the running Nexus codebase. It produces code **as a string**, stores it on a `TaskRun`, and displays it for the user to read. That is the entire scope.

This is deliberate: we validate the *quality* of generated code safely before ever letting it touch disk. File-writing and execution are **future phases**, not now.

---

## 2. The flow

```
User picks ONE task (from the Phase 2A task list)
  → Builder sends the task + its PRD context to the provider
  → provider returns generated code (as text)
  → validate the response
  → save a TaskRun record (code text, tokens, cost, status)
  → display the generated code to the user (read-only)
```

No file is created. No command is run. No GitHub. No Reviewer.

---

## 3. Hard constraints

- Same single Next.js app. Reuse the existing `AgentAdapter` / Claude adapter and the mocked test setup from earlier phases.
- **Builder output is a string saved to the DB.** It is NEVER written to a file or executed. Enforce this in code — there should be no `fs.writeFile`, no `exec`, no `child_process` anywhere in the Builder path.
- **One task at a time.** The user selects a single task; the Builder runs for that task only.
- **No GitHub, no Reviewer, no file writing, no code execution.** Those are 2C / later.
- Reuse `TaskRun` (prepared in 2A). Attach the execution to `TaskRun`, not to `Task`.
- Secrets stay in `.env.local`; reuse the redaction helper; never log a key.
- Retry max 2 attempts on failure (per FAILURE_AND_RECOVERY). On repeated failure, mark the `TaskRun` failed with a clear error and stop — do not save partial/garbage output.
- **Do not create any folder or layer that Phase-2B code doesn't actually use.**

---

## 4. Database (this phase)

Use/extend the `TaskRun` model (already prepared in 2A). Ensure it has at least:

- `id`, `taskId` (relation to Task)
- `status` (PENDING / RUNNING / SUCCESS / FAILED)
- `generatedCode` (text — the code string the Builder produced)
- `provider`, `model`
- `inputTokens`, `outputTokens`, `cost`
- `retryCount`, `error` (nullable)
- `startedAt`, `finishedAt`

Do **not** add file paths, commit hashes, PR fields, or review fields — those belong to later phases.

---

## 5. Agents (this phase)

- Add a **Builder** capability in the agents module: given one task + PRD context, return generated code as text.
- Reuse the existing Claude adapter and cost-tracking path.
- The prompt should ask for focused, relevant code for that specific task — same lesson as 2A: specific, not generic. Validate the response is non-empty text; if the provider returns nothing usable, retry then fail cleanly.

---

## 6. Task IDs

Every file/task in this phase gets an ID like `NEXUS-P2B-001`, `NEXUS-P2B-002`, …

---

## 7. Expected files (Phase 2B)

```
prisma/schema.prisma                         # ensure TaskRun has generatedCode + fields above (+ migration if needed)
src/modules/agents/builder.ts                # task + PRD -> generated code (text), reuses adapter
src/modules/task-runs/service.ts             # create/run a TaskRun, save code + cost, mark status
src/app/api/tasks/[id]/run/route.ts          # trigger a build for one task
src/app/projects/[id]/                        # UI: "Build" button per task + read-only code display
tests/builder.test.ts                        # mocked provider
tests/task-runs.test.ts                      # incl. a FAILURE test: on generation failure, TaskRun = FAILED, no partial code saved
```

Create only what's needed. Reuse earlier files.

---

## 8. Acceptance criteria (Phase 2B is done when)

1. I pick one task and click "Build"; the Builder generates code and I see it **displayed as read-only text** in the UI.
2. A `TaskRun` is saved with the code, provider, model, tokens, cost, and status.
3. **No file is written to disk and nothing is executed** — verify there is no `fs.writeFile` / `exec` / `child_process` in the Builder path.
4. Cost is recorded; **no secret/key is printed** to logs.
5. `Build` + `Lint` + `Tests` all pass, using the **mocked** provider.
6. **Failure test passes:** when generation fails, the `TaskRun` is marked FAILED with a clear error and **no partial code is saved** (max 2 attempts, no infinite loop).

---

## 9. Rules

- No fake/placeholder code pretending a build worked when it didn't.
- **Absolutely no filesystem writes or code execution** in this phase — this is the core safety boundary.
- No real secrets in the repo. Stop on any security or data-loss risk.
- **Do not start Phase 2C (Reviewer / GitHub / file-writing) until I approve Phase 2B.**

---

## 10. When done, report

1. Changed/added files with task IDs and status.
2. Build / Lint / Test results (all passing, mocked), including the failure test.
3. A real example: pick one real task and paste the **actual generated code** so I can judge its quality.
4. Explicit confirmation: no `fs.writeFile` / `exec` / `child_process` anywhere in the Builder path.
5. Proposed Phase 2C scope (do not implement it).
