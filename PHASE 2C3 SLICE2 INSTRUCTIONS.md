# PHASE_2C3_SLICE2_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phases 1 through 2C3-Slice-1 are complete and merged.
>
> This is the **final build slice**. After it, the only remaining step is a real
> end-to-end test against GitHub (done separately, with a real token).

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md`
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`
4. `PHASE_2C3_INSTRUCTIONS.md` — the absolute rules in its §2 still apply in full.

If anything you're about to build isn't supported by these docs, **stop and ask**.

---

## 1. What we are building — PR creation only

**Open a pull request from an existing pushed branch to the default branch of the SEPARATE per-project output repo. Link it to the TaskRun and Review. Show the user the PR link. Stop there.**

> **THE RULE THAT NEVER CHANGES: no merging, and no auto-merge — not now, not in any later phase.**
> Creating a PR is where automation ends. Merging is a human decision made by the user in the GitHub UI, always. A PR that is opened but not merged is the correct, finished state for this system.

---

## 2. Absolute rules (carried over — all still binding)

1. **Never touch the Nexus platform repo.** PRs are only ever opened on the designated per-project output repo. Assert the target is not the Nexus repo.
2. **No merge. No auto-merge. Ever.** Do not call any merge API. Do not add a "merge" button that merges. Do not implement auto-merge on APPROVE.
3. **Only approved work.** A PR is opened only for a branch that came from an approved (APPROVE + worksOnStack:true), written, pushed file.
4. **PR targets the output repo's default branch** — never the Nexus repo, never a branch outside that repo.
5. **No execution.** No `exec`, `child_process`, or `spawn`. Use the GitHub API.
6. **Token safety.** Fine-grained token scoped to output repos only; lives in `.env.local`; never logged (reuse redaction); never committed. Missing/invalid token → fail cleanly.
7. **Record every PR** in the database.
8. **All tests mocked.** Tests must never hit the real GitHub API or use a real token.

Refuse and report rather than working around any rule.

---

## 3. The flow

```
An existing GitPush (branch + commit from Slice 1, from an approved file)
  → verify target repo is the per-project output repo (NOT Nexus)  → else refuse
  → open a PR: head = nexus/<taskRunId>  base = output repo default branch
  → PR title/body reference the task, the review verdict, and the TaskRun id
  → record a PullRequest row (repo, number, url, taskRunId, reviewId, createdAt)
  → show the user the PR URL (read-only)
STOP. Do not merge. Do not poll for merge. Do not auto-merge.
```

---

## 4. Hard constraints

- Same single Next.js app. Reuse the GitHub adapter, redaction, mocked test setup from Slice 1.
- No provider (Claude) call is needed — this is deterministic work on an existing pushed branch.
- The PR body should carry traceability: task title, review verdict, `worksOnStack`, TaskRun id. (This is the product's whole point — the PR should explain *why* this code exists and that it was reviewed.)
- **Do not create any folder or layer that this slice doesn't actually use.**

---

## 5. Database (this slice)

Add a `PullRequest` model. Minimum fields:

- `id`, `taskRunId` (relation), `reviewId` (relation), `gitPushId` (relation)
- `repo`, `number`, `url`
- `createdAt`

Do NOT add merge status, merged-at, or auto-merge fields — merging is out of scope permanently.

---

## 6. Task IDs

Every file/task gets an ID like `NEXUS-P2C3B-001`, …

---

## 7. Required test cases (all mocked)

1. Opens a PR for a valid pushed branch from approved work; records a `PullRequest` row.
2. **Refuses** if the target repo is the Nexus platform repo.
3. **Refuses** if the underlying work isn't approved.
4. **Refuses** if there is no corresponding GitPush (no branch to open a PR from).
5. Fails cleanly if the token is missing/invalid — no partial state, nothing recorded.
6. Confirms: no merge API is ever called; no `exec`/`child_process`/`spawn`; token never logged.

---

## 8. Acceptance criteria (done when)

1. For an approved, pushed branch, I trigger "open PR" and get a PR URL on the **output repo**; the PR body shows task + review traceability.
2. A `PullRequest` row is recorded on success; nothing on refusal.
3. **Nothing is merged**, no merge API called, no auto-merge anywhere in the codebase.
4. Nexus repo never touched.
5. Token in `.env.local` only, never logged; all tests mocked.
6. `Build` + `Lint` + `Tests` all pass.

---

## 9. Rules

- The rules in §2 are absolute. When in doubt, refuse and report.
- **Merging is permanently out of scope.** If a future request asks for auto-merge, refuse and point to this document.
- No real token or secret in the repo. Stop on any security or data-loss risk.
- After this slice, **do not start anything new** — the next step is a real end-to-end test performed by the user.

---

## 10. When done, report

1. Changed/added files with task IDs and status.
2. Build / Lint / Test results — especially the refusal tests (§7.2–§7.5).
3. A mocked example: the PR that would be created (repo, head branch, base, title/body showing traceability) and the recorded `PullRequest` row.
4. Explicit confirmation: no merge API called anywhere, no auto-merge, Nexus repo untouched, token never logged, all tests mocked.
5. A short checklist of what the user needs to do for the **real** end-to-end test (separate output repo, fine-grained token scoped to it, which env var to set) — do not perform it.
