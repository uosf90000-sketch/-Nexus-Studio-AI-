# Decision Protocol — Nexus Studio AI (Personal Prototype)

> **Status:** Draft for review · **Scope:** Personal Prototype
> Defines how the three agent roles decide, and when they must wait for the single user.

---

## ملخص تنفيذي (عربي)

في النسخة الشخصية نبسّط الحوكمة. الاستقلالية **مستويان فقط** بدل أربعة:

- **MANUAL_APPROVAL** — يجهّز الإجراء وينتظر موافقتي.
- **AUTO_SAFE** — ينفّذ الإجراءات الداخلية الآمنة تلقائيًا (كتابة كود في فرع، تشغيل اختبارات، حفظ سجل).

القرارات الهندسية العادية: Builder يقترح، Reviewer يراجع عند الحاجة، وتُعتمد إذا مرّت معايير القبول والاختبارات. لا مجلس نماذج ولا تصويت.

الموافقة مطلوبة قبل: أول Push/PR، أي Merge، أي نشر خارجي، حذف بيانات، تغيير أسرار، أو أي تكلفة تتجاوز الحد. لا نسجّل Decision لكل تعديل صغير — فقط القرارات المهمة.

---

## 1. Core principle

Evidence over consensus. No model council, no voting. The common path is: **Builder proposes → Reviewer checks (when needed) → acceptance criteria + tests pass → approved.** One user is the only human in the loop.

## 2. Two autonomy modes (that's all the prototype needs)

| Mode | Behaviour |
|---|---|
| `AUTO_SAFE` | Executes safe internal actions automatically: write code on a branch, run build/lint/tests, save runs/logs/costs. |
| `MANUAL_APPROVAL` | Prepares the action and waits for the user's approval before proceeding. |

The full L0–L3 model and per-operation autonomy are deferred to a future multi-user version.

## 3. Approval is required before

- First **Push** or **Pull Request**
- Any **Merge**
- Any **external deployment**
- **Deleting data**
- **Changing secrets**
- Any **cost above the configured threshold**

Everything else that is internal and safe runs under `AUTO_SAFE`.

## 4. Routine engineering decisions

```
Builder proposes change
  → Reviewer reviews (when the task warrants it)
  → acceptance criteria + tests pass? → approved
  → else → back to Builder, within the retry limit (see Failure & Recovery)
```

## 5. Disagreement / uncertainty

If Builder and Reviewer don't converge, or evidence is insufficient: **stop and ask the user.** In a single-user prototype there is no Director to escalate to — the user is the resolver. Don't loop, don't guess.

## 6. Decision logging (deliberately light)

- Log **meaningful** decisions to `ExecutionLog` (which task, which agent/provider, outcome, cost).
- Do **not** create a mandatory `Decision` record for every small edit — that would make governance a burden on a prototype.
- A separate `Decision` object and `ApprovalRequest` table arrive **later**, when the first approval-gated external action is built.

## 7. Feasibility (kept, but lightweight)

The system still shouldn't assume every idea is worth building. A short feasibility read (Proceed / Revise / Reject) precedes planning. On Reject, it explains why in plain language and stops — it doesn't silently start coding. No heavyweight scoring engine in the prototype.

---
*Companion docs: FAILURE_AND_RECOVERY_MODEL.md, MVP_SYSTEM_ARCHITECTURE.md.*
