# Project

This project uses a hybrid agentic workflow: specialized agents handle process (decisions, planning, review), and Claude Code's plan mode handles execution.

## Workflow — Hybrid Approach

Agents own the **process** — architecture decisions, work decomposition, quality gates, and maintenance. Claude Code plan mode owns the **execution** — implementing individual tickets efficiently within a single session.

| Phase | How | When |
|-------|-----|------|
| **Decide** | `/architect` agent | New feature, significant design choice, unclear requirements |
| **Map** | `/system-architect` agent | New system or major structural change |
| **Decompose** | `/planner` agent | ADR/spec ready, work needs to be broken into tickets |
| **Execute** | Claude Code **plan mode** (`shift+tab`) | Implementing a specific ticket (includes writing tests) |
| **Verify** | `/ticket-verifier` agent *(automatic)* | Runs after every ticket — validates, updates status, syncs backlog |
| **Audit** | `/code-auditor` agent *(optional)* | After large diffs, before commits, or on request — structural quality check |
| **Learn** | `/learner` agent | Feature complete and introduced a new technology or concept |
| **Design** | `/system-design` agent *(subskill)* | System design question, scaling analysis, or when any agent needs Alex Xu-style content |
| **Report** | `/html-summarizer` agent | Sprint or feature complete, stakeholder update needed |

### Why hybrid?

- Agents enforce **separation of concerns** — the Architect can't write code, the Ticket Verifier can't fix issues
- Plan mode provides **speed and context continuity** — it explores, plans, and executes in one session
- Artifacts (ADRs, tickets, reviews) **persist across sessions** — plan mode's output is code, agents' output is documentation

### Choosing the right tool

**New feature or significant change** → MUST start with `/architect`. No implementation until an ADR exists.

**Well-scoped ticket with acceptance criteria** → plan mode (`shift+tab`).

**Bug fix, typo, or small change** → just implement, no ceremony needed.

## Before Starting Any Feature

**When the user describes a new feature, significant change, or unclear requirements, you MUST invoke `/architect` before doing anything else.** Do not start implementing, planning, or decomposing work. The architect agent will ask clarifying questions and produce an ADR. Only after the ADR exists should work proceed.

1. **New feature or significant change** → you MUST invoke `/architect` first. No exceptions. Do not skip this step.
2. Check if tickets exist in `tickets/` — if not, run `/planner` to decompose the ADR into tickets
3. For each ticket: use plan mode (`shift+tab`) to implement it
4. After each ticket completes, the ticket-verifier runs automatically (see "After Completing Any Ticket" below)
5. If the ticket touches an existing ADR's scope, verify the decision still holds
6. If the feature introduced new technologies or concepts, run `/learner` for each one

## After Completing a Feature

When a feature is done and introduces new technologies, patterns, or concepts the user hasn't worked with before — automatically invoke `/learner` for each new concept. Look for:
- New libraries or frameworks added to dependencies
- New architectural patterns (e.g., event sourcing, SSE, pub/sub)
- New language features or APIs used for the first time
- New infrastructure concepts (e.g., WebSockets, gRPC, CRDT)

This ensures the user can confidently explain every technology in their project.

## Testing in Plan Mode

Plan mode writes tests as part of implementing each ticket. For every acceptance criterion:
1. Write at least one automated test that verifies it
2. Cover edge cases (empty, null, boundary values) and error handling
3. Run the tests and confirm they pass before marking the ticket done

Follow the project's existing test framework and patterns. Test observable behavior, not implementation details.

## Before Starting Any Ticket (in plan mode)

1. Read the ticket fully, including all linked documents
2. Read any referenced ADRs in `architecture/decisions/`
3. Check relevant conventions in `conventions/`
4. Let plan mode explore and propose the implementation plan
5. Verify the work end-to-end before marking done

## After Completing Any Ticket

**When you finish implementing a ticket — after tests pass, lint is clean, and code compiles — you MUST invoke `/ticket-verifier` before doing anything else.** Do not move to the next ticket. Do not ask the user what to do next. Invoke the ticket-verifier with the ticket path. The ticket-verifier validates acceptance criteria, updates ticket status, and syncs the backlog.

## Sub-Agent Deployment

When work can be parallelized, spin up sub-agents for independent tasks concurrently.

### Model selection

| Complexity | Model | Use when |
|------------|-------|----------|
| **Low** | Haiku | File lookups, grep, reading docs, running tests, formatting |
| **Medium** | Sonnet | Multi-file changes, code review, writing tests |
| **High** | Opus | Architecture decisions, complex refactors, subtle bugs |

**Default to Haiku** unless the task requires multi-step reasoning or cross-file understanding.

## Key Files and Directories

- `architecture/decisions/` — Architecture Decision Records (ADRs)
- `architecture.yaml` — System architecture definition (components, connections, tiers)
- `orchestration.yaml` — Agent workflow definition (roles, outputs, connections)
- `specs/` — Feature specifications
- `tickets/` — Work items organized by feature folder, with `_backlog.md` as the sprint board
- `conventions/` — Language and framework coding standards
- `conventions/folio.md` — Folio design system: governs every HTML artifact
- `learnings/` — Technology learnings and explainer decks (`_deck-template.html` + `deck-stage.js`)
- `summaries/` — HTML work-summary decks (`_slide-template.html` is the style reference)
- `.claude/agents/` — Subagent definitions for each role
- `STATUS.md` — Live project dashboard (auto-updated git data + manually maintained context)

## CLAUDE.md Maintenance

Keep this file lean and current (target: under 200 lines). A hook warns when it exceeds the limit.
- When you discover a new gotcha or pattern, add it here or to the appropriate linked file
- Route large or specialized content to separate files (e.g., `conventions/`, `docs/`) and link from here
- Remove stale entries that no longer reflect how the project works
- Never duplicate information that already lives in a linked file

## STATUS.md Maintenance

STATUS.md is a live project dashboard. Git sections (branch, commits, file changes) auto-update via a hook on every commit/push. You maintain the semantic sections:

**Update after significant milestones** (completing a ticket, finishing a phase, hitting a blocker):
1. **Current Phase** — Mark the active workflow phase(s) from the table
2. **Active Work** — One paragraph: what feature/ticket is in progress, next step
3. **Open Tickets** — Snapshot from `tickets/_backlog.md`
4. **Risks & Blockers** — Add blockers; remove resolved ones
5. **Session Log** — One-line entry with today's date and what was accomplished

Keep updates brief. STATUS.md is a dashboard, not a report — use `/html-summarizer` for detailed retrospectives.

## Writing Style for Artifacts

All written artifacts — ADRs, tickets, learnings, summaries — follow the voice of Alex Xu's *System Design Interview* books: frame the problem and requirements first, survey the options, deep-dive the chosen approach, compare trade-offs, wrap up with a recommendation. Calm, declarative, teaching tone. Concrete numbers over adjectives. No hype, no emoji.

HTML artifacts (learning decks, work summaries, architecture sketches) additionally follow the **Folio** design system — read `conventions/folio.md` before producing any HTML.

## Conventions

Check `conventions/` for language-specific standards. Always follow the conventions for the language you're working in.
