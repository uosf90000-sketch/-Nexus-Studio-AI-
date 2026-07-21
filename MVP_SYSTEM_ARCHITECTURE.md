# System Architecture — Nexus Studio AI (Personal Prototype)

> **Status:** Draft for review · **Scope:** Personal Prototype (single user, single app)
> **Audience:** Claude Code (implementation) + reviewer
> **Baseline:** One Next.js full-stack app. No separate backend, no monorepo, no multi-tenancy.

---

## ملخص تنفيذي (عربي)

هذه النسخة **نموذج شخصي (Personal Prototype)** يستخدمه مستخدم واحد لاختبار المسار: فكرة → PRD مختصر → مهام → تنفيذ مهمة عبر Claude → مراجعة → Build/Lint/Tests → Branch/PR على GitHub → عرض الحالة.

القرار المعماري: **تطبيق واحد بـ Next.js Full-Stack** (Route Handlers / Server Actions)، TypeScript، Tailwind + shadcn/ui، Prisma مع **SQLite محليًا**. لا NestJS، لا Backend منفصل، لا Better Auth، لا Turborepo، لا Event Bus عام، لا Multi-tenancy.

مستخدم واحد فقط — لا نظام تسجيل عام. التشغيل المحلي بلا تسجيل دخول؛ عند النشر لاحقًا نضيف رمز دخول بسيط. كل المفاتيح في Environment Variables فقط.

التقسيم داخلي (مجلدات `modules/`) داخل نفس التطبيق، وليس Packages أو Services. **لا يُنشأ مجلد أو طبقة إلا عند وجود كود فعلي يحتاجها.**

الوكلاء ثلاثة أدوار منطقية: **Planner، Builder، Reviewer** — ليست خدمات مستقلة ولا مجلس نماذج. لكل مزوّد **Adapter خاص** عند استخدامه؛ ولا نَعِد بأن تبديل المزوّد مجرد تغيير Config — قد يحتاج Mapping واختبارات.

---

## 1. Architectural decision

**One Next.js full-stack application.** The earlier draft described a NestJS + Next.js two-app platform with Better Auth and many modules — that was heavier than the agreed scope. For a single-user prototype whose only goal is to validate the idea→preview path, that is premature.

This decision must be recorded as **ADR-0001**.

## 2. Stack (confirmed for the prototype)

- **App:** Next.js full-stack (Route Handlers or Server Actions) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Data:** Prisma + **SQLite locally** (migrate to PostgreSQL only if/when we deploy and actually need it)
- **Repo:** a single Git project, a single deploy process
- **Secrets:** environment variables only

**Explicitly not now:** NestJS · Turborepo · separate backend · Better Auth · Organizations/Teams · multi-tenancy · Redis · BullMQ · microservices · general event bus · Plugin SDK · billing · production deploy automation.

## 3. Project structure (internal folders, one app)

```
nexus-studio-ai/
├── src/
│   ├── app/               # Next.js routes + UI pages
│   ├── modules/
│   │   ├── projects/      # project entity + lifecycle
│   │   ├── planning/      # idea → summary → short PRD → plan
│   │   ├── tasks/         # task entity, selection
│   │   ├── execution/     # runs one task; orchestrates a run
│   │   ├── agents/        # Planner / Builder / Reviewer roles + provider adapters
│   │   ├── reviews/       # reviewer pass
│   │   ├── github/        # branch / commit / PR
│   │   └── costs/         # cost entries + thresholds
│   ├── components/
│   ├── lib/
│   └── server/            # server-only helpers, prisma client, config
├── prisma/
├── docs/
├── tests/
└── scripts/
```

> These are folders inside one app — **not** independent packages or services. **Do not create a folder or layer until real code needs it.**

## 4. User & security

Single user. No public sign-up, no Better Auth now. Local runs need no login. When this is later deployed, add a simple access code or suitable protection — not before. All keys live in environment variables only; secrets are never logged and never returned in agent-visible output (a redaction helper in `lib/` handles this).

## 5. Agents (three logical roles, not services)

- **Planner** — idea → short PRD → plan → tasks
- **Builder** — implements one selected task (this is where Claude is used)
- **Reviewer** — reviews the Builder's output when needed

Each provider gets its **own Adapter** when introduced. We do **not** claim provider-swapping is a config change: different tools and output shapes may need mapping and their own tests. The adapter interface exists to keep providers replaceable *in principle*, with the honest expectation that swapping one costs adapter work + tests.

```ts
interface AgentAdapter {
  role: 'planner' | 'builder' | 'reviewer';
  run(input: AgentInput): Promise<AgentOutput>;   // provider-specific mapping inside
  estimateCost(input: AgentInput): CostEstimate;
}
```

## 6. First experience path (what the prototype tests)

1. Enter an idea
2. Generate a summary + short PRD
3. Generate a plan + tasks
4. Pick one task to execute
5. Send it to Claude (Builder)
6. Save output + log + cost
7. Reviewer pass when needed
8. Run Build + Lint + Tests
9. Create Branch + Commit / PR on GitHub
10. Show status + results to the user

**Do not attempt full autonomous end-to-end delivery in the first release.**

## 7. Database (only the necessary tables)

`Project · ProjectDocument · Task · TaskRun · AgentRun · Review · CostEntry · ExecutionLog · AppSetting`

- Add **`ApprovalRequest` later**, only when the first external action that needs approval is built.
- **`Decision` is not mandatory for every small change.** Log only meaningful decisions — otherwise governance becomes dead weight on a prototype.

## 8. Governance in the prototype (lightweight)

Two autonomy modes only (see DECISION_PROTOCOL): `MANUAL_APPROVAL` and `AUTO_SAFE`. The full L0–L3 model, per-operation autonomy, and the mandatory decision-object-per-change are **future**, not now.

---
*Companion docs: DECISION_PROTOCOL.md, FAILURE_AND_RECOVERY_MODEL.md, COMPETITIVE_DIFFERENTIATION.md.*
