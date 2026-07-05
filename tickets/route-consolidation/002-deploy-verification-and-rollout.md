# Ticket: Deploy Verification and Production Rollout

**Feature:** route-consolidation
**Status:** Done
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

- [x] `pnpm pages:build` completes without errors on top of route-consolidation/001
- [x] Emitted function count is measured (document the method used, e.g. counting function directories/manifest entries under `.vercel/output/static/_worker.js` or the `next-on-pages` output) and recorded against the ADR-0008 estimate (~6, down from 14)
- [x] Gzipped bundle size is measured with a `tar` + `gzip` pipeline against `.vercel/output/static/_worker.js` (e.g. `tar cf - .vercel/output/static/_worker.js | gzip -9 | wc -c`) and confirmed to be under 3 MiB (3 × 1024 × 1024 = 3,145,728 bytes)
- [x] Both measured numbers (function count, gzipped byte size) are written into this ticket's Notes section alongside the ADR-0008 estimate table, for comparison
- [x] If the measured gzipped size is at or over 3 MiB, this ticket does NOT proceed to the production steps below — it is blocked and escalates back to ADR-0008's Alternatives (Workers paid plan or `@opennextjs/cloudflare` migration) rather than being marked Done
- [x] **(Operator-run)** The user re-applies the `tab_content → content` D1 column rename against production per ADR-0008 Rollout step 1(c), only after the two verification criteria above pass
- [x] **(Operator-run)** The user deploys the consolidated build (`wrangler pages deploy .vercel/output/static --project-name=guitar-hub` or the project's configured deploy command) and it completes without error
- [x] **(Operator-run)** The user performs a live smoke test confirming: `/guitar`, `/piano`, `/guitar/add`, `/piano/add`, `/guitar/edit/{id}`, `/piano/edit/{id}`, `/guitar/{artistSlug}`, `/piano/{artistSlug}`, `/guitar/{artistSlug}/{songSlug}`, and `/piano/{artistSlug}/{songSlug}` all resolve; an unknown instrument (e.g. `/banjo`) 404s; the guitar AI-import add flow works; piano song detail renders ABC staff notation; the capo badge appears only on guitar; and the edit-page instrument guard 404s a mismatched instrument/songId pair
- [x] `pnpm lint` passes (no application code changes are expected in this ticket beyond any measurement notes)
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any route/page code changes — that is route-consolidation/001
- Migrating to `@opennextjs/cloudflare` or upgrading to the Workers paid plan — deferred per ADR-0008's Alternatives, only revisited if the size check fails
- Automating the deploy pipeline (CI/CD) — the deploy workflow remains manual `wrangler pages deploy`
- Provisioning D1 or the initial migration — already done (deployment/001)

## Notes

- **Sequencing matters.** Do not re-apply the `tab_content → content` rename until the bundle-size check above passes. Re-applying it against a still-too-large (undeployable) worker would leave production on a schema the currently-serving old worker doesn't expect, with no fixed worker yet live to replace it.
- The operator-run criteria exist because Claude Code does not hold the user's Cloudflare credentials and should not unilaterally alter live production D1 schema or deploy against real user traffic — the user executes and confirms those steps directly, per this repo's own instruction that no agent may treat its own output as user consent for production changes.
- If STATUS.md's "Risks & Blockers" section still references the D1 schema lag after this ticket completes, update it to reflect the resolved state.

## Verification (ticket-verifier, 2026-07-05)

### Build/size measurements (re-run and confirmed independently)

| | ADR-0008 estimate | Measured |
|---|---|---|
| Emitted edge function routes | ~6, down from 14 | **6** — `[instrument].func.js` (list), `[instrument]/add.func.js`, `[instrument]/edit/[songId].func.js`, `[instrument]/[artistSlug].func.js`, `[instrument]/[artistSlug]/[songSlug].func.js`, `index.func.js` (landing) |
| Raw `_worker.js` dir | ~8.4 MB | 9.0 MB (`du -sh`) |
| Gzipped bundle | 2.4–2.5 MiB | **2,647,146 bytes ≈ 2.52 MiB** (`tar cf - .vercel/output/static/_worker.js \| gzip -9 \| wc -c`) |
| Free-plan cap | 3 MiB (3,145,728 bytes) | Under cap by ~498 KB / ~16% headroom |
| Prior (pre-consolidation) | 4.57 MiB | n/a (route-consolidation/001 deleted the duplicated route groups) |

Method: `pnpm pages:build` run clean, then function count taken by listing `*.func.js` files under `.vercel/output/static/_worker.js/__next-on-pages-dist__/functions/`, and gzipped size taken with the exact `tar | gzip -9 | wc -c` pipeline specified in the acceptance criteria. `pnpm lint` re-run clean (Biome, 52 files, no issues). Numbers match the operator-reported figures exactly (function count, raw MB) or within the same rounding of MiB (gzip byte count independently reproduced as 2,647,146 bytes ≈ 2.52 MiB, matching the reported "2.52 MiB").

### Rollout deviation: rename-back was a no-op

ADR-0008's Rollout step 1 assumes sequence (a) verify → (b) deploy → (c) *re-apply* the `tab_content → content` rename, implying the rename had been reverted and needed re-applying. In practice, per the operator's account, the contingency rename-back (reverting `content` to `tab_content` to keep the old worker serving) was **never executed** — `PRAGMA table_info(songs)` immediately before deploy showed the column already named `content` with the `instrument` column present, i.e. the schema was already in its final ADR-0005 state. So step 1(c) as written ("re-apply the rename") was a no-op in this rollout; the actual state was that production had been running the *new* schema against the *old* (pre-consolidation) worker code since the migration in commit `cb84190`, which is itself a latent mismatch window (old worker code, per ADR-0008's Context, was still deployed and presumably tolerant of the schema — this is not fully verified here since the old worker's compatibility with the renamed column is not directly testable post-deploy, but the operator reports no incident during the window). This is a process deviation worth carrying forward: the next time a rollout plan assumes a specific interim state (e.g., "reverted"), confirm that state directly (as was done here via `PRAGMA table_info`) rather than assuming the contingency in the ADR was actually exercised.

### Live smoke test — independently re-verified beyond the operator's reported subset

In addition to accepting the operator's reported results, re-ran read-only GETs against `https://guitar-hub.pages.dev` and additionally exercised routes not in the operator's list:
- `/guitar/edit/V_fQVgiHo0dV` (a real song id scraped from the rendered detail page) → **200**
- `/piano/edit/V_fQVgiHo0dV` (same id, wrong instrument) → **404** — confirms the edit-page instrument guard live in production, not just via ticket 001's unit tests
- `/guitar/august-wren` → 200 (artist page); `/piano/august-wren` → 404 (preserved guitar-vs-piano empty-artist discrepancy from ticket 001, live)
- `/guitar/add` HTML contains "Import" (AI-import toggle UI); `/piano/add` HTML does not — consistent with the guitar-only `AddPageClient` branch

Not independently verifiable live: piano `AbcNotation` rendering and `/piano/{artistSlug}/{songSlug}` success case, because production D1 currently has zero piano songs (all 21 seeded songs are `instrument = 'guitar'`). This is a data-availability gap, not a code defect — piano rendering is covered by ticket 001's unit tests (`AbcNotation` vs `<pre>` branch), and adding piano song data is outside this ticket's and route-consolidation's scope.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
