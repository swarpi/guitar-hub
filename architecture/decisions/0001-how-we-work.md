# ADR-0001: How We Work with AI Agents

**Status:** Accepted  
**Date:** 2026-05-04  
**Updated:** 2026-05-08  
**Author:** [your name]

## Context

Working with AI coding assistants can be highly productive, but without structure it often leads to:
- Inconsistent code quality and style
- Decisions made without considering alternatives
- Lost context between sessions
- No clear separation between planning and execution

We need a workflow that maximizes the benefits of AI assistance while maintaining engineering rigor. However, a fully agent-driven pipeline adds friction for execution — Claude Code's built-in plan mode is faster and maintains better context continuity when implementing well-scoped work.

## Decision

We adopt a **hybrid approach**: specialized agents own the process, Claude Code plan mode owns execution.

### Agents (process)

1. **Architect** — Focuses on design decisions. Produces ADRs. Asks clarifying questions before deciding. Has read access to the codebase but does not write code.

2. **Planner** — Takes specs and ADRs as input. Decomposes work into tickets scoped for plan mode sessions. Does not implement.

3. **Ticket Verifier** — Automatically invoked after each ticket. Verifies diffs against acceptance criteria and linked ADRs. Checks for convention violations and test adequacy. Updates ticket status and syncs the backlog. Does not fix issues directly — flags them for fixing via plan mode.

4. **Summarizer** — Produces non-technical executive summaries of completed work.

### Plan mode (execution)

Each ticket from the Planner is executed using Claude Code's plan mode (`shift+tab`). Plan mode:
- Explores the codebase and proposes a plan before implementing
- Executes within a single session with full context continuity
- Adapts its depth to the task — simple ticket, simple plan

After plan mode completes a ticket, the Ticket Verifier is invoked automatically to validate the work and update tracking.

### When to skip the pipeline

- Bug fixes, typos, and small changes → plan mode directly
- Well-understood changes with no architectural implications → plan mode directly
- New features or significant decisions → full pipeline starting with Architect

All significant decisions are recorded as ADRs. All work items are tickets with acceptance criteria. Conventions are documented per-language.

## Consequences

### Positive

- Clear separation of concerns reduces cognitive overload per session
- ADRs create a searchable decision history
- Tickets with acceptance criteria make "done" unambiguous
- Plan mode provides fast, context-aware execution without agent switching overhead
- Conventions prevent style drift across sessions
- The workflow adapts to task size — no ceremony for small changes

### Negative

- More upfront documentation work for new features
- Requires discipline to follow the process for larger changes
- Plan mode doesn't produce persistent process artifacts (ADRs, reviews) — the agents handle that

### Neutral

- This is a personal workflow; team adoption would require additional coordination conventions

## Alternatives Considered

### Unstructured chat-based development

Just talk to the AI and let it write code directly. Rejected because it leads to inconsistent decisions and lost context.

### Fully agent-driven pipeline (previous approach)

All agents in sequence, including a dedicated Executor for implementation. Rejected because plan mode provides better context continuity and speed for execution, and the Executor agent was redundant — plan mode always superseded it in practice.

### Plan mode only (no agents)

Use plan mode for everything. Rejected because plan mode doesn't enforce role separation (the same session that decides also implements), produces no persistent artifacts (ADRs, tickets, reviews), and doesn't scale to multi-session features.

### Heavy-process frameworks (e.g., full Agile ceremony)

Too heavyweight for a solo developer. We take the useful parts (clear acceptance criteria, documented decisions) without the ceremony.
