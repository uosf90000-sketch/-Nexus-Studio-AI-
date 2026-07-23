# PHASE_2C3_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phases 1–2C2 are complete and merged. This is the final integration, split into small slices.
>
> **This phase touches a real remote GitHub repository and uses a credential that can
> modify code. Treat it with the same (or greater) care as the earlier secret incident.**

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md`
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`

If anything you're about to build isn't supported by these docs, **stop and ask**.

---

## 1. What we are building right now — slice 1 only: branch + commit

**Push an approved, already-written file to a SEPARATE per-project GitHub repository, on a new branch, as a commit. Stop there. No PR, no merge.**

Scope is intentionally tiny. PR creation is slice 2. Merging is **always a human action in the GitHub UI** — never automated, ever (see §2).

### Where things go (decided)

- Generated output goes to a **separate GitHub repository per project** — NOT the Nexus platform repo. The Nexus repo is never touched by this integration.
- The repo name/target is provided in config or created explicitly by the user — the integration does **not** invent or push to arbitrary repos.

---

## 2. Absolute rules (non-negotiable)

1. **Never touch the Nexus platform repo.** This integration only ever pushes to the designated per-project output repo. Assert the target repo is NOT the Nexus repo before any push.
2. **No auto-merge. Ever.** Merging into any default branch is a human decision made in the GitHub UI. This phase does not merge, and no later phase will add auto-merge.
3. **Only approved, written files.** Push only files that already exist under `generated/<projectId>/` from an APPROVE + worksOnStack:true TaskRun. Never push unreviewed or unapproved code.
4. **Push to a NEW branch only.** Never commit directly to `main`/`master` of the output repo. Create a fresh branch (e.g. `nexus/<taskRunId>`), commit there.
5. **No execution.** No `exec`, no `child_process`, no `spawn`. Use the GitHub API (or a git library) for branch/commit — not shell-outs that run arbitrary commands.
6. **Token safety (critical):**
   - Use a **fine-grained GitHub token** scoped to the **output repos only** — NOT the Nexus repo, NOT the whole account. Minimum permissions: repository contents (read/write) and, later, pull requests. No admin, no delete.
   - Token lives in `.env.local` only. Never printed to logs (reuse the redaction helper). Never committed. Never returned in agent-visible output.
   - If the token is missing/invalid, fail cleanly with a clear message — do not proceed.
7. **Record every push** in the database (branch name, commit sha, repo, taskRunId, timestamp).

If any rule can't be satisfied → refuse and report. Never work around a safety rule.

---

## 3. The flow

```
An approved, written file (generated/<projectId>/... from an APPROVE review)
  → verify target repo is the per-project output repo (NOT Nexus)  → else refuse
  → create a new branch on the output repo (e.g. nexus/<taskRunId>)
  → commit the file to that branch via the GitHub API
  → record a GitPush row (repo, branch, commitSha, taskRunId, createdAt)
  → show the user: repo, branch, commit link (read-only)
STOP. No PR. No merge.
```

---

## 4. Hard constraints

- Same single Next.js app. Reuse redaction, cost tracking, mocked test setup.
- All GitHub calls must be **mockable** — tests must NOT hit the real GitHub API or use a real token.
- No provider (Claude) call is needed here; this is deterministic git work on an approved file.
- **Do not create any folder or layer that this slice doesn't actually use.**

---

## 5. Database (this slice)

Add a `GitPush` model. Minimum fields:

- `id`, `taskRunId` (relation)
- `repo`, `branch`, `commitSha`
- `createdAt`

Do NOT add PR fields yet — that's slice 2.

---

## 6. Task IDs

Every file/task gets an ID like `NEXUS-P2C3-001`, …

---

## 7. Required test cases (all mocked — never hit real GitHub)

1. Pushes an approved, written file to a new branch on the output repo (mocked API) and records a `GitPush`.
2. **Refuses** if the file/TaskRun isn't approved (no APPROVE + worksOnStack:true).
3. **Refuses** if the target repo is the Nexus platform repo.
4. **Refuses** to commit to `main`/`master` directly — only new branches.
5. Fails cleanly if the token is missing/invalid — no partial state.
6. Confirms no `exec` / `child_process` / `spawn` in the push path, and the token is never logged.

---

## 8. Acceptance criteria (done when)

1. For an approved, written file, I trigger "push to GitHub" and a new branch + commit appears on the **per-project output repo**; I see the branch and commit reference.
2. Nothing is ever pushed to the Nexus repo, to a default branch, or without approval.
3. No PR is created, nothing is merged.
4. Token is in `.env.local` only, never logged, tests use a mock.
5. `Build` + `Lint` + `Tests` all pass (mocked GitHub).
6. A `GitPush` row is recorded on success; nothing on refusal.

---

## 9. Rules

- The rules in §2 are absolute. When in doubt, refuse and report.
- No auto-merge, no touching the Nexus repo, no unapproved pushes, no direct-to-main commits.
- No real token or secret in the repo. Stop on any security or data-loss risk.
- **Do not implement PR creation (slice 2) until I approve this slice.**

---

## 10. When done, report

1. Changed/added files with task IDs and status.
2. Build / Lint / Test results — especially the refusal tests (§7.2–§7.5).
3. A description of a real (or fully-mocked) push: repo, branch, commit — and confirmation nothing hit the Nexus repo or a default branch.
4. Explicit confirmation: fine-grained token in `.env.local` only, never logged; no exec/child_process/spawn; no PR; no merge.
5. Proposed slice-2 scope (PR creation, still no auto-merge) — do not implement it.
