# ADR-0001 — Single Next.js Full-Stack App for the Personal Prototype

- **Status:** Accepted
- **Date:** 2026-07-21
- **Decision owner:** (you)
- **Task:** NEXUS-P1-001

---

## ملخص (عربي)

قرّرنا بناء النسخة الأولى كتطبيق **Next.js Full-Stack واحد** بدل معمارية بتطبيقين (NestJS + Next.js). السبب: النسخة الأولى **نموذج شخصي لمستخدم واحد** هدفه اختبار مسار الفكرة → PRD → Preview، والمعمارية الأثقل تضيف تعقيدًا بلا فائدة في هذه المرحلة.

---

## Context

The first version of Nexus Studio AI is a **single-user Personal Prototype**. Its only goal is to validate the idea → organized-project → preview path. An earlier draft proposed a two-app platform (NestJS backend + Next.js frontend) with Better Auth, a general event bus, and many modules. For a single-user prototype that is premature complexity: more moving parts, more setup, slower time to a working slice, and no benefit the prototype actually needs.

## Decision

Build the prototype as **one Next.js full-stack application**:

- Next.js (Route Handlers or Server Actions) + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + **SQLite** locally (PostgreSQL only later, if/when we deploy and need it)
- One Git repository, one deploy process
- Internal organization via `src/modules/*` folders — **not** packages or services
- No Better Auth, no separate backend, no monorepo, no multi-tenancy

## Consequences

**Positive**
- Fastest path to a working end-to-end slice.
- Fewer failure points; simpler local run.
- Module folders keep boundaries clean enough to extract later if the product grows.

**Negative / trade-offs**
- Not built for multiple users or teams — a future multi-user version will need real auth, a stronger DB (PostgreSQL), and possibly a service split. That work is deliberately deferred.
- Some architecture-doc concepts (L0–L3 autonomy, mandatory Decision objects, production rollback) are intentionally **not** implemented now.

## Alternatives considered

| Alternative | Why rejected for the prototype |
|---|---|
| NestJS + Next.js (two apps) | Heavier setup, more ops surface, no single-user benefit |
| Microservices | Network/deploy/tracing complexity with zero prototype payoff |
| Full monorepo (Turborepo + packages) | Boundary-management overhead slows the first slice |

## Revisit when

We move from a personal prototype to a multi-user product, or when a real constraint (scale, team access, deployment) forces a heavier architecture. At that point, supersede this ADR with a new one.
