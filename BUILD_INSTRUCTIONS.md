# BUILD_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in `docs/` **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.

---

## 0. Read first (in this order)

1. `docs/architecture/MVP_SYSTEM_ARCHITECTURE.md`  ← the binding architecture
2. `docs/architecture/DECISION_PROTOCOL.md`
3. `docs/architecture/FAILURE_AND_RECOVERY_MODEL.md`
4. `docs/product/COMPETITIVE_DIFFERENTIATION.md` (context only, not a build spec)

If anything you're about to build isn't supported by these docs, **stop and ask** — don't invent scope.

---

## 1. What we are building right now

The **smallest end-to-end vertical slice**, nothing more:

**Enter an idea → generate a summary + short PRD → save it to the database → display it in the UI.**

No GitHub. No task execution. No reviewer. No deployment. Those come in later phases.

---

## 2. Hard constraints

- **One** Next.js full-stack app (Route Handlers or Server Actions). TypeScript.
- **UI:** Tailwind CSS + shadcn/ui.
- **Data:** Prisma + **SQLite** locally.
- **No:** NestJS · separate backend · Better Auth · Turborepo · multi-user · multi-tenancy · Redis · BullMQ · event bus · plugin SDK · billing · production deploy.
- Single user, single Git repo, no login for local runs.
- **All secrets in environment variables only.** Add `src/lib/redact.ts` that strips secrets from anything logged. Never print a key.
- **Do not create any folder or layer that Phase-1 code doesn't actually use.**
- **Check compatible package versions before installing.** Do not assume versions.

---

## 3. Database (this phase only)

Create Prisma models for **only** these tables:

- `Project`
- `ProjectDocument`  (holds the summary + PRD)
- `CostEntry`
- `ExecutionLog`

Do **not** add `Task`, `TaskRun`, `AgentRun`, `Review`, `ApprovalRequest`, or `Decision` yet.

---

## 4. Agents (this phase)

- Implement **one role only: Planner.**
- Put it behind an `AgentAdapter` interface (`run()`, `estimateCost()`).
- Implement **one adapter: Claude** (reads its key from env).
- Do **not** claim provider-swapping is a config change; the interface exists so a future adapter is *possible*, not free.

---

## 5. Task IDs & ADR

- Every file/task gets an ID like `NEXUS-P1-001`, `NEXUS-P1-002`, …
- Create `docs/architecture/adr/ADR-0001-single-app.md` recording the single-Next.js-app decision.

---

## 6. Expected files (Phase 1)

```
prisma/schema.prisma                 # Project, ProjectDocument, CostEntry, ExecutionLog
src/lib/prisma.ts
src/lib/redact.ts
src/lib/config.ts                    # reads env, validates presence of the API key
src/modules/agents/adapter.ts        # AgentAdapter interface
src/modules/agents/claude-adapter.ts # the one provider adapter
src/modules/agents/planner.ts        # idea -> summary + short PRD
src/modules/projects/service.ts      # create / get project + documents
src/app/                             # idea-input page, project-view page, route handler/action
tests/planner.test.ts
tests/projects.test.ts
.env.example
README.md
docs/architecture/adr/ADR-0001-single-app.md
```

Create only what's needed. If a file above turns out unused, don't create it.

---

## 7. Acceptance criteria (Phase 1 is done when)

1. I enter an idea in the UI and see a saved **summary + short PRD** displayed — with no manual DB editing.
2. The call's **cost is recorded** in `CostEntry` and shown to me.
3. **No secret/key is ever printed** to logs (verify the redaction path).
4. `Build` + `Lint` + `Tests` all pass.
5. If the provider call fails, the task **stops with a clear error** — no infinite loop (max 2 attempts, per the Failure & Recovery doc).

---

## 8. Rules

- No fake/placeholder code that pretends a feature works when it doesn't.
- No real secrets in the repo. `.env.example` only.
- Stop on any security conflict or data-loss risk.
- **Do not start Phase 2 until I approve Phase 1.**

---

## 9. When done, report

1. The project tree.
2. Task list with IDs and status.
3. What each part does.
4. Build / Lint / Test results.
5. Any issues or limitations you hit.
6. Proposed Phase-2 task list (do not implement it).
