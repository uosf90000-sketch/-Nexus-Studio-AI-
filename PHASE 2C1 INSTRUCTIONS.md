# PHASE_2C1_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phases 1, 2A, 2B are complete and merged. This builds directly on them.

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md`
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`

If anything you're about to build isn't supported by these docs, **stop and ask**.

---

## 1. What we are building right now — Reviewer ONLY

**A Reviewer that reads the code a TaskRun generated (Phase 2B) and produces a written review. Nothing else.**

> **CRITICAL SCOPE RULE:** This phase adds **only** a review step. It must **not** write files, **not** execute code, **not** touch GitHub, and **not** modify the generated code. It reads text, produces a review (text + a verdict), and saves it. File-writing and GitHub integration are **later, separate phases** — do not build them now.

The Reviewer's job is exactly the gap we already saw: the Builder produced code that *looks* right but may not actually work (e.g. it used `@@fulltext`, which SQLite doesn't support). The Reviewer must catch that class of problem.

---

## 2. The flow

```
An existing TaskRun with generatedCode (from Phase 2B)
  → Reviewer sends the code + the task + PRD context to the provider
  → provider returns a structured review
  → validate the review (Zod)
  → save it (linked to the TaskRun)
  → display the review to the user (read-only)
```

No file writing. No execution. No GitHub. No changing the generated code.

---

## 3. What the review must contain

The Reviewer returns a structured object (validate with Zod):

- `verdict`: one of `APPROVE` | `REQUEST_CHANGES` | `REJECT`
- `summary`: one or two sentences, plain language
- `issues`: array of findings, each with:
  - `severity`: `HIGH` | `MEDIUM` | `LOW`
  - `description`: what's wrong
- `worksOnStack`: boolean — does this code actually work on **this project's stack (Next.js + Prisma + SQLite)**? (This is the key check — the Builder doesn't know the target DB constraints.)

Prompt the Reviewer explicitly to check stack/DB compatibility, not just general code style.

---

## 4. Hard constraints

- Same single Next.js app. Reuse the existing `AgentAdapter`, Claude adapter, mocked test setup, redaction helper, cost tracking.
- **Reviewer output is text saved to the DB.** No file writes, no execution, no GitHub — enforce in code (no `fs.writeFile`, no `exec`, no `child_process` in the Reviewer path).
- Reviews **one TaskRun** at a time.
- Do NOT modify or overwrite the generated code — the review is separate data.
- Secrets stay in `.env.local`; never log a key.
- Retry max 2 attempts; on repeated failure mark the review FAILED with a clear error, save nothing partial.
- **Do not create any folder or layer that this phase doesn't actually use.**

---

## 5. Database (this phase)

Add a `Review` model (or extend TaskRun). Minimum fields:

- `id`, `taskRunId` (relation to TaskRun)
- `verdict` (APPROVE / REQUEST_CHANGES / REJECT)
- `summary`
- `issues` (JSON)
- `worksOnStack` (boolean)
- `provider`, `model`, `inputTokens`, `outputTokens`, `cost`
- `createdAt`

Do NOT add file paths, commit hashes, or PR fields — those are later phases.

---

## 6. Task IDs

Every file/task gets an ID like `NEXUS-P2C1-001`, `NEXUS-P2C1-002`, …

---

## 7. Expected files

```
prisma/schema.prisma                       # add Review model (+ migration)
src/modules/agents/reviewer.ts             # code + task + PRD -> structured review
src/modules/reviews/service.ts             # run + save a review for a TaskRun
src/app/api/task-runs/[id]/review/route.ts # trigger a review for one TaskRun
src/app/projects/[id]/                       # UI: "Review" button + read-only review display
tests/reviewer.test.ts                     # mocked provider
tests/reviews.test.ts                      # incl. a FAILURE test (no partial review saved)
```

Reuse earlier files; don't duplicate.

---

## 8. Acceptance criteria (done when)

1. For a TaskRun that has generated code, I click "Review" and see a **read-only structured review**: verdict, summary, issues (with severity), and `worksOnStack`.
2. A `Review` record is saved, linked to the TaskRun, with cost recorded.
3. **No file written, nothing executed, no GitHub** — verify no `fs.writeFile` / `exec` / `child_process` in the Reviewer path.
4. No secret/key printed to logs.
5. `Build` + `Lint` + `Tests` all pass with the **mocked** provider.
6. **Failure test passes:** on generation failure the review is marked FAILED, no partial review saved (max 2 attempts).
7. **Quality check I will judge:** give the Reviewer a piece of code with a real stack problem (e.g. Prisma `@@fulltext` on SQLite) and confirm the Reviewer actually flags it as not working on the stack. A reviewer that approves broken code is worthless.

---

## 9. Rules

- No fake/placeholder reviews.
- **No file writing, no execution, no GitHub** — this is the scope boundary.
- No real secrets. Stop on any security or data-loss risk.
- **Do not start file-writing or GitHub integration until I approve this phase.**

---

## 10. When done, report

1. Changed/added files with task IDs and status.
2. Build / Lint / Test results (all passing, mocked), including the failure test.
3. A real example: paste an actual review the Reviewer produced for a real piece of generated code — ideally one where it correctly flags a stack-incompatibility issue.
4. Explicit confirmation: no `fs.writeFile` / `exec` / `child_process` in the Reviewer path.
5. Proposed next-phase scope (file-writing OR GitHub — one, not both) — do not implement it.
