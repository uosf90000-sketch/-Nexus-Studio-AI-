# Failure and Recovery Model — Nexus Studio AI (Personal Prototype)

> **Status:** Draft for review · **Scope:** Personal Prototype
> Defines retry, stop, and pause/resume behaviour — sized honestly for a prototype.

---

## ملخص تنفيذي (عربي)

مبسّطة لتناسب النموذج الأولي:

- **Retry بحد أقصى محاولتين افتراضيًا**، لا حلقات غير محدودة. عند استمرار الفشل تتوقف المهمة وتعرض الخطأ.
- **Pause / Resume بين المهام أو عند checkpoints واضحة** — لا نَعِد باستئناف عملية Node من منتصفها.
- **لا يوجد Production Rollback** في النسخة الأولى. نتعامل مع **Preview فقط**.
- **Stop** يلغي المهام الجديدة ويحفظ حالة قاعدة البيانات، دون ادعاء إلغاء كل عملية خارجية فورًا.
- كل عملية خارجية idempotent قدر الإمكان (لا تكرّر إنشاء فرع/PR).

القاعدة: عند خطر فقدان بيانات أو تعارض أمني — **أوقف واعرض، لا تُخمّن.**

---

## 1. Principles (prototype-sized)

1. **Bounded retries** — default **max 2 attempts**, no infinite loops.
2. **Checkpoint-based recovery** — pause/resume happens **between tasks or at explicit checkpoints**, not mid-process. We do **not** promise to resume an interrupted Node process from its middle.
3. **Idempotent external actions** — creating a branch/PR checks-then-acts so a re-run doesn't duplicate.
4. **Fail safe** — on data-loss risk or security conflict, stop and surface.

## 2. Retry ladder (per task)

```
attempt 1 fails
  → capture logs + error context
  → attempt 2 (failure context fed back to the Builder)
  → still failing → mark task FAILED, show the error to the user, stop
```

`maxRetryCount` defaults to 2 and is configurable via `AppSetting` — not hardcoded.

## 3. Deployment scope: Preview only

- The prototype handles **Preview deployment** only.
- **No production rollback exists** in the first release. There is no production to roll back.
- A failed preview deploy: collect logs → show cause → let the user decide. No automated production recovery machinery is built yet.

## 4. Pause / Resume

- **Pause:** stop starting new tasks; the current task finishes to its checkpoint or is left in a clean recorded state.
- **Resume:** continue from the last completed task / checkpoint, reading state from the database.
- Recovery reads persisted records (`TaskRun`, `ExecutionLog`), never an agent's chat history.

## 5. Stop

`Stop` cancels **new** tasks and **saves the database state**. It does **not** claim to instantly cancel every external operation already in flight (e.g. a request already sent to a provider or GitHub). No data is deleted. Work can resume later from the last recorded point.

## 6. Failure taxonomy (minimal)

| Class | Example | Reaction |
|---|---|---|
| Transient | provider timeout | retry within limit |
| Deterministic | failing test / bad build | feed context back, retry once; then stop and show |
| Cost | over threshold | stop, ask user |
| Data-risk / security | could delete data, secret exposure | hard stop, ask user |

## 7. Governing rule

> On risk of data loss or a security conflict: **stop and surface — do not proceed on a guess.**

---
*Companion docs: DECISION_PROTOCOL.md, MVP_SYSTEM_ARCHITECTURE.md.*
