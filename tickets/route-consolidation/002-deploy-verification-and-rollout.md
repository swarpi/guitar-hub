# Ticket: Deploy Verification and Production Rollout

**Feature:** route-consolidation
**Status:** Todo
**Priority:** P0
**Estimate:** S
**Related:** ADR-0008
**Depends on:** route-consolidation/001

## Context

ADR-0008 estimates the consolidated route group lands the gzipped worker bundle around 2.4–2.5 MiB, down from the current 4.57 MiB, against a 3 MiB free-plan cap — but the ADR itself flags this as "empirical, not guaranteed" and requires confirming the real number before promoting.

Production is currently degraded: the deployed worker is over the size cap, and the `tab_content → content` D1 column rename has been **temporarily reverted** so the old, already-deployed worker keeps serving traffic. ADR-0008's Rollout section specifies a strict order: (a) land the consolidation and confirm the bundle fits, (b) deploy, (c) re-apply the column rename. Doing this out of order risks breaking the currently-serving worker before the fixed one is live.

This ticket has two halves. The verification half (build, measure, compare against the cap) is Claude-Code-executable. The production half (re-applying the schema rename against live D1, deploying, and smoke-testing the live site) requires the user's Cloudflare/wrangler credentials and judgment about production traffic, and is explicitly operator-run.

## Goal

The consolidated bundle is confirmed under the 3 MiB gzipped cap with numbers documented, and production is brought back to a healthy, fully-deployed state via the ADR-0008 rollout sequence.

## Acceptance Criteria

- [ ] `pnpm pages:build` completes without errors on top of route-consolidation/001
- [ ] Emitted function count is measured (document the method used, e.g. counting function directories/manifest entries under `.vercel/output/static/_worker.js` or the `next-on-pages` output) and recorded against the ADR-0008 estimate (~6, down from 14)
- [ ] Gzipped bundle size is measured with a `tar` + `gzip` pipeline against `.vercel/output/static/_worker.js` (e.g. `tar cf - .vercel/output/static/_worker.js | gzip -9 | wc -c`) and confirmed to be under 3 MiB (3 × 1024 × 1024 = 3,145,728 bytes)
- [ ] Both measured numbers (function count, gzipped byte size) are written into this ticket's Notes section alongside the ADR-0008 estimate table, for comparison
- [ ] If the measured gzipped size is at or over 3 MiB, this ticket does NOT proceed to the production steps below — it is blocked and escalates back to ADR-0008's Alternatives (Workers paid plan or `@opennextjs/cloudflare` migration) rather than being marked Done
- [ ] **(Operator-run)** The user re-applies the `tab_content → content` D1 column rename against production per ADR-0008 Rollout step 1(c), only after the two verification criteria above pass
- [ ] **(Operator-run)** The user deploys the consolidated build (`wrangler pages deploy .vercel/output/static --project-name=guitar-hub` or the project's configured deploy command) and it completes without error
- [ ] **(Operator-run)** The user performs a live smoke test confirming: `/guitar`, `/piano`, `/guitar/add`, `/piano/add`, `/guitar/edit/{id}`, `/piano/edit/{id}`, `/guitar/{artistSlug}`, `/piano/{artistSlug}`, `/guitar/{artistSlug}/{songSlug}`, and `/piano/{artistSlug}/{songSlug}` all resolve; an unknown instrument (e.g. `/banjo`) 404s; the guitar AI-import add flow works; piano song detail renders ABC staff notation; the capo badge appears only on guitar; and the edit-page instrument guard 404s a mismatched instrument/songId pair
- [ ] `pnpm lint` passes (no application code changes are expected in this ticket beyond any measurement notes)
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any route/page code changes — that is route-consolidation/001
- Migrating to `@opennextjs/cloudflare` or upgrading to the Workers paid plan — deferred per ADR-0008's Alternatives, only revisited if the size check fails
- Automating the deploy pipeline (CI/CD) — the deploy workflow remains manual `wrangler pages deploy`
- Provisioning D1 or the initial migration — already done (deployment/001)

## Notes

- **Sequencing matters.** Do not re-apply the `tab_content → content` rename until the bundle-size check above passes. Re-applying it against a still-too-large (undeployable) worker would leave production on a schema the currently-serving old worker doesn't expect, with no fixed worker yet live to replace it.
- Measured numbers (fill in during implementation):
  - Emitted function count: _TBD_ (ADR-0008 estimate: ~6, down from 14)
  - Gzipped bundle size: _TBD_ (ADR-0008 estimate: 2.4–2.5 MiB; cap: 3 MiB; prior: 4.57 MiB)
- The operator-run criteria exist because Claude Code does not hold the user's Cloudflare credentials and should not unilaterally alter live production D1 schema or deploy against real user traffic — the user executes and confirms those steps directly, per this repo's own instruction that no agent may treat its own output as user consent for production changes.
- If STATUS.md's "Risks & Blockers" section still references the D1 schema lag after this ticket completes, update it to reflect the resolved state.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
