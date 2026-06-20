# Architecture Overview

This document provides a high-level view of the system architecture.

## Core Principles

1. **Separation of concerns** — Different cognitive tasks get different prompts and contexts
2. **Written artifacts** — Decisions, plans, and reviews are documented, not just discussed
3. **Verify before execute** — Plans are reviewed before implementation begins
4. **Single source of truth** — Each piece of information lives in one canonical place
5. **Right tool for the job** — Agents own process; plan mode owns execution

## The Flow (Hybrid)

```
Requirement → Architect → ADR/Spec → Planner → Tickets → Plan Mode → Code → Ticket Verifier → Merged
                (agent)                (agent)            (built-in)        (agent)
```

**Process phases** (agents): Architect, System Architect, Planner, Ticket Verifier, Summarizer
**Execution phase** (plan mode): Claude Code's built-in plan mode implements each ticket in a focused session

## When to Skip the Pipeline

Not every change needs the full workflow:
- **Bug fix or typo** → Plan mode directly, or just implement
- **Small well-understood change** → Plan mode directly
- **New feature or significant decision** → Start with Architect, then full pipeline

## Artifact Types

| Artifact | Purpose | Location |
|----------|---------|----------|
| ADR | Record architectural decisions | `architecture/decisions/` |
| Spec | Define feature requirements | `specs/` |
| Ticket | Actionable work item | `tickets/` |
| Convention | Language/framework standards | `conventions/` |
