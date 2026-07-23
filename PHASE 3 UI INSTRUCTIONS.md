# PHASE_3_UI_INSTRUCTIONS.md — Nexus Studio AI (Founder View)

> Read this file and the four docs in the repo **before writing any code**.
> Follow it literally. Do **not** build beyond the scope defined here.
> Phases 1 through 2C3 are complete and merged. The whole engine works — but the user
> has never actually *used* it. This phase makes it usable.

---

## 0. Read first

1. `COMPETITIVE_DIFFERENTIATION.md` — specifically the **Founder View vs Developer Handoff View** section. This phase builds the **Founder View**.
2. `MVP_SYSTEM_ARCHITECTURE.md`

---

## 1. What we are building — the Founder View

**A single, usable interface that lets the user run the entire existing loop from a browser, by clicking — without a terminal, without curl, without asking Claude Code.**

This phase adds **no new backend logic**. Every capability already exists as a service or API route. This is wiring + interface.

### The loop the UI must expose

```
Enter an idea
  → see the summary + PRD
  → generate tasks         → see the ordered task list
  → pick a task, build     → see the generated code
  → review                 → see verdict, issues, worksOnStack
  → write file             → see the written file path
  → push + open PR         → see the branch and PR link
```

At every step the user sees: **what happened, why, and what it cost.**

---

## 2. Two non-negotiable requirements

### A. Arabic-first, full RTL
This product targets Arab/Gulf founders. The interface is **Arabic by default with proper RTL layout** — not an English UI with translated strings. Mirror layout, alignment, icon direction, and spacing correctly. Numbers, code blocks, and English identifiers stay LTR inside an RTL page.

### B. Mobile-first
The primary user runs this on a **phone**. Design for a narrow screen first and let it scale up — not the reverse. Every action must be reachable and readable on mobile. No hover-only interactions. Tap targets sized properly.

---

## 3. Founder View language — plain, not technical

The founder is non-technical. The interface speaks their language:

- Say "المهام" not "Task entities". Say "التكلفة حتى الآن" not "aggregate CostEntry".
- Show the review as a **plain verdict** with a clear meaning: approved / needs changes / rejected — plus the issues in readable language.
- `worksOnStack: false` should read as something like "هذا الكود ما راح يشتغل على إعدادات المشروع الحالية" — not a raw boolean.
- Technical detail (IDs, tokens, raw JSON) is available but **not the default view**. Put it behind a "تفاصيل تقنية" toggle.

**Copy guidance:** active voice, sentence case, name things by what the user controls. Buttons say what happens ("ولّد المهام", "راجع الكود"), and the resulting state uses the same word.

---

## 4. What every screen must always show

The governance value has to be *felt*, not just stored:

- **الحالة** — where the project is in the loop right now.
- **التكلفة** — running cost for this project, visible at all times, not buried.
- **السبب** — for decisions the system made, in one plain sentence.
- **الخطوة التالية** — what the user can do next, and what needs their approval.

Blocked or refused actions must explain **why** and **what to do about it** — e.g. "ما نقدر نكتب هذا الملف لأن المراجعة طلبت تعديلات."

---

## 5. Hard constraints

- **UI + wiring only.** No new agents, no new backend rules, no schema changes unless a field is genuinely missing for display.
- Use the existing API routes and services. If a route is missing for something the UI needs, add the thin route — but no new business logic.
- Same stack: Next.js + Tailwind + shadcn/ui.
- Loading and error states for every async action. Never leave the user staring at a dead screen.
- Actions that are not allowed yet (e.g. write file before an approving review) should be **visibly disabled with a reason**, not hidden and not silently failing.
- Secrets never surface in the UI. No tokens, no keys, ever.
- **Do not build the Developer Handoff View** in this phase — that's separate.

---

## 6. Design direction

Make one deliberate visual decision rather than a default dashboard. This is a **governance** tool for founders: the feel should be calm, orderly, and trustworthy — the opposite of a chaotic AI toy. Choose a palette and type pairing that works properly in Arabic (pick an Arabic display/body face that actually looks good at these sizes — don't let Arabic text fall back to a default system font while Latin text gets a styled one).

The loop itself is the signature element: the user should be able to see, at a glance, how far their idea has traveled and what's left. Make that progression the memorable part of the interface — not decoration around it.

Keep everything else quiet.

---

## 7. Task IDs

Every file/task gets an ID like `NEXUS-P3-001`, …

---

## 8. Acceptance criteria (done when)

**The single criterion that matters:**

> From my phone, I can open the app, type an idea, and click my way through the entire loop — PRD, tasks, build, review, write file, PR — seeing the status, the reasons, and the cost at each step, **without opening a terminal and without asking Claude Code to do anything.**

Plus:

1. Interface is Arabic with correct RTL throughout; readable and usable on a phone screen.
2. Every step shows status, cost, and a plain-language reason.
3. Disallowed actions are disabled **with a visible reason**.
4. Loading and error states everywhere; no dead ends.
5. No secrets displayed anywhere.
6. `Build` + `Lint` + `Tests` all pass; existing tests still green.

---

## 9. When done, report

1. Files added/changed with task IDs.
2. Build / Lint / Test results.
3. **Screenshots of each screen at phone width** — this is the main deliverable for review.
4. A short walkthrough of the flow as the user will experience it.
5. Anything in the loop that turned out to be awkward or missing once you wired it up — I want to know where the product itself is weak, not just the code.
