# ADR-0001: Single Next.js Full-Stack App (not multi-service)

**Date:** 2024-07-21  
**Status:** Accepted  
**Context:** Nexus Studio AI Personal Prototype  
**Deciders:** Development team + user

## Decision

Build a **single Next.js full-stack application** (using Route Handlers or Server Actions) rather than separating into NestJS backend + Next.js frontend.

## Rationale

1. **Faster iteration** — Single codebase, single deployment pipeline, no coordination overhead between two services.
2. **Simpler debugging** — One Node process, unified logs, no inter-service communication latency during development.
3. **Lower ops burden** — For a single-user prototype, one app is sufficient; multi-service is premature.
4. **Easier to refactor later** — If this grows, we can extract services later with a clear boundary; it's not harder than redesigning a monolith that was always split.

## Constraints

- TypeScript for type safety.
- Tailwind CSS + shadcn/ui for UI (consistent design system).
- Prisma + SQLite for local data (no need for separate DB until multi-user).
- All secrets in environment variables only.
- No NestJS, no Turborepo, no multi-app orchestration.

## Alternatives considered

1. **NestJS backend + Next.js frontend** — More modular on paper, but adds ceremony (API contracts, CORS, dual deployment) with zero current benefit.
2. **GraphQL API** — Reduces HTTP chatter, but introduces schema management and resolver complexity. REST + Server Actions is adequate for Phase 1.

## Consequences

- Simpler to build and debug.
- Scales to ~5–10 concurrent users before needing to rethink (the prototype's realistic ceiling).
- If we need multi-tenancy or horizontal scaling later, this decision will be revisited.

## Follow-up

- Once the prototype proves value, evaluate whether to keep as single app or split into services based on actual scaling needs.
