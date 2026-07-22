# PHASE_2C2_INSTRUCTIONS.md — Nexus Studio AI (Personal Prototype)

> Read this file and the four docs in the repo **before writing any code**.
> Follow them literally. Do **not** build beyond the scope defined here.
> Phases 1, 2A, 2B, 2C1 are complete and merged. This builds directly on them.
>
> **This is the most safety-critical phase in the project.** It is the first time
> the system writes to the filesystem. Read the safety rules in §1 twice.

---

## 0. Read first

1. `MVP_SYSTEM_ARCHITECTURE.md`
2. `DECISION_PROTOCOL.md`
3. `FAILURE_AND_RECOVERY_MODEL.md`

If anything you're about to build isn't supported by these docs, **stop and ask**.

---

## 1. What we are building — file writing, maximally constrained

**Write the generated code of a TaskRun to disk — but ONLY into an isolated folder, ONLY if the Reviewer approved it, ONLY as a new file, and NEVER executing anything.**

### THE SAFETY RULES (non-negotiable — enforce every one in code)

1. **Write ONLY inside `generated/<projectId>/`** at the repo root. Never write anywhere else. Before every write, resolve the absolute path and assert it is inside `generated/` — if it isn't, refuse and error. This blocks path-traversal (`../`, absolute paths) in AI-produced filenames.
2. **Write ONLY approved code.** A file is written only if its TaskRun has a Review with `verdict === "APPROVE"` **and** `worksOnStack === true`. Anything else (`REQUEST_CHANGES`, `REJECT`, `worksOnStack:false`, or no review) → refuse, do not write.
3. **Never overwrite.** If the target file already exists, do **not** overwrite it — stop and report. Only brand-new files are created.
4. **Never execute.** No `exec`, no `child_process`, no `spawn`, no running of the written code. Writing bytes to a file is the only filesystem action allowed.
5. **`generated/` is in `.gitignore`.** Generated output must never be committed to the repo.
6. **Record every write** in the database: which file path, which TaskRun, which Review, timestamp.

If any rule can't be satisfied, the correct behaviour is to **refuse and report**, never to "work around" it.

---

## 2. The flow

```
A TaskRun whose Review is APPROVE + worksOnStack:true
  → derive a safe filename (sanitize; strip any path separators / .. )
  → resolve absolute target path inside generated/<projectId>/
  → assert path is inside generated/  (else refuse)
  → assert file does NOT already exist  (else refuse)
  → write the code text to the file
  → record a WrittenFile row (path, taskRunId, reviewId, createdAt)
  → show the user what was written (path + confirmation), read-only
```

No execution. No GitHub. No overwrite. No writing outside `generated/`.

---

## 3. Hard constraints

- Same single Next.js app. Reuse existing adapters, mocked test setup, redaction, cost tracking (though this phase may not call a provider at all — it writes already-generated code).
- Filename comes from task context but must be **sanitized**: remove path separators, `..`, leading slashes, and anything that could escape the folder. If a safe name can't be derived, refuse.
- **No provider call is required** to write a file — this phase is deterministic filesystem work gated on an existing approved review.
- Secrets stay in `.env.local`; never log a key.
- **Do not create any folder or layer that this phase doesn't actually use.**

---

## 4. Database (this phase)

Add a `WrittenFile` model. Minimum fields:

- `id`, `taskRunId` (relation), `reviewId` (relation)
- `path` (the relative path under generated/)
- `createdAt`

Do NOT add commit hashes or PR fields — GitHub is a later, separate phase.

---

## 5. Task IDs

Every file/task gets an ID like `NEXUS-P2C2-001`, …

---

## 6. Expected files

```
.gitignore                                  # ensure generated/ is ignored
prisma/schema.prisma                        # add WrittenFile model (+ migration)
src/modules/files/writer.ts                 # the safe writer: all §1 checks live here
src/modules/files/service.ts                # orchestrates: verify approval -> write -> record
src/app/api/task-runs/[id]/write/route.ts   # trigger a write for one approved TaskRun
src/app/projects/[id]/                        # UI: "Write file" button (only enabled if approved) + result display
tests/writer.test.ts                        # see required test cases below
tests/files.test.ts
```

---

## 7. Required test cases (these are the point of this phase)

The tests must prove the safety rules, using a temp directory (never the real repo):

1. Writes an approved TaskRun's code to `generated/<projectId>/` successfully.
2. **Refuses** to write when the review is `REQUEST_CHANGES` / `REJECT` / `worksOnStack:false` / missing.
3. **Refuses** a filename containing `..` or a path separator or an absolute path (path-traversal attempt) — asserts nothing is written outside `generated/`.
4. **Refuses** to overwrite an existing file.
5. Records a `WrittenFile` row on success; records nothing on refusal.
6. Confirms no `exec` / `child_process` / `spawn` anywhere in the writer path.

---

## 8. Acceptance criteria (done when)

1. For a TaskRun with an APPROVE + worksOnStack:true review, I click "Write file" and a new file appears under `generated/<projectId>/`, and I see its path.
2. For any non-approved TaskRun, the write is refused with a clear message — nothing is written.
3. All six safety rules in §1 are enforced in code and covered by the tests in §7.
4. `generated/` is gitignored; no generated file is committed.
5. `Build` + `Lint` + `Tests` all pass (tests use a temp dir, not the real repo).
6. No secret/key printed to logs.

---

## 9. Rules

- **The six safety rules in §1 are absolute.** When in doubt, refuse and report.
- No execution of written code, ever, in this phase.
- No GitHub in this phase.
- No writing outside `generated/`. No overwriting. No unapproved code.
- Stop on any security or data-loss risk.
- **Do not start GitHub integration until I approve this phase.**

---

## 10. When done, report

1. Changed/added files with task IDs and status.
2. Build / Lint / Test results — especially the refusal tests (§7.2, §7.3, §7.4) passing.
3. A real example: write one approved file and paste its path + the recorded WrittenFile row.
4. Explicit confirmation: writes are confined to `generated/`, no overwrite, no exec/child_process/spawn in the writer path, `generated/` is gitignored.
5. Proposed GitHub-integration scope for the next phase — do not implement it.
