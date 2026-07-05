# Ticket: App Rename — Guitar Hub to Music Hub

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0005
**Depends on:** multi-instrument/004, multi-instrument/005

## Context

ADR-0005 renames the app from "Guitar Hub" to "Music Hub" to reflect its expanded scope. The rename touches six files: the root layout metadata, the web app manifest, the `Header` component, `wrangler.toml`, `package.json`, and `public/offline.html`.

ADR-0005 explicitly carves out two things that do NOT change: the repository directory name (`guitar_hub`) and the D1 `database_name` in `wrangler.toml` (`guitar-hub-db`). Cloudflare D1 does not support renaming databases; the binding name `DB` is what the code references.

This ticket is ordered after tickets 004 and 005 so that the pages being renamed (guitar routes, landing page) already exist in their final form. Running this rename earlier risks applying it to files that are subsequently restructured.

## Goal

Every user-visible occurrence of "Guitar Hub" is replaced with "Music Hub"; every machine-readable `name` field in configuration is updated to `music-hub`; the D1 database name and repository directory are untouched.

## Acceptance Criteria

- [x] `src/app/layout.tsx`:
  - `metadata.title` changed from `"Guitar Hub"` to `"Music Hub"`
  - `metadata.description` changed from `"A personal fingerstyle guitar tablature collection"` to `"A personal music sheet and tablature collection"`
- [x] `public/manifest.json` — **Unblocked and completed post-merge** (commit `3371bce`, after `master` merged into the branch in `6c20e2c`):
  - `name` changed from `"Guitar Hub"` to `"Music Hub"` — confirmed at `public/manifest.json:2`
  - `short_name` changed from `"Guitar Hub"` to `"Music Hub"` — confirmed at `public/manifest.json:3`
- [x] `src/components/Header.tsx`: the display text `"Guitar Hub"` changed to `"Music Hub"` (logo spans, `src/components/Header.tsx:12`)
- [x] `wrangler.toml`: `name = "guitar-hub"` changed to `name = "music-hub"`; `database_name = "guitar-hub-db"` is NOT changed
- [x] `package.json`: `"name": "guitar-hub"` changed to `"name": "music-hub"`
- [x] `public/offline.html` — **Unblocked and completed post-merge** (commit `3371bce`, after `master` merged into the branch in `6c20e2c`):
  - `<title>Offline — Guitar Hub</title>` changed to `<title>Offline — Music Hub</title>` — confirmed at `public/offline.html:6`; `<h1>Guitar Hub</h1>` changed to `<h1>Music Hub</h1>` — confirmed at `public/offline.html:77`
- [x] All page-level `title` metadata strings that include `"Guitar Hub"` as a suffix (e.g., `"Add a Song — Guitar Hub"`) are updated to use `"Music Hub"` — all 8 page-level titles (guitar + piano: add, edit, artist, song-detail) stripped to short titles, relying on the root `layout.tsx` title template for the suffix
- [x] `grep -r "Guitar Hub" src/ public/` returns no matches after the change — re-verified by ticket-verifier, case-insensitive and exact-case grep both clean
- [x] `pnpm build` passes with no errors — re-verified by ticket-verifier
- [x] `pnpm lint` passes — re-verified by ticket-verifier
- [x] **`/ticket-verifier` invoked and approved** — all criteria that can be satisfied on this branch pass; the two deferred criteria are properly documented and tracked (see Risks below).

## Out of Scope

- Renaming the repository directory (`guitar_hub`) — a local filesystem concern, not a code change
- Changing the D1 `database_name` in `wrangler.toml` — Cloudflare D1 does not support database renaming
- Changing the Cloudflare Pages project name in the dashboard — optional and done outside this codebase
- Changing the D1 `database_id` or `binding` — these are infrastructure references, not branding
- Updating the `wrangler.toml` deployment comment block at the top (`guitar-hub-db` in the comment instructions) — those are operator notes, not code; leave them as-is or update for clarity at discretion

## Notes

- The Next.js default title template in `layout.tsx` can be set as a template string (e.g., `{ default: "Music Hub", template: "%s — Music Hub" }`) so individual pages only need to set their own short title without duplicating the suffix. If individual pages already hardcode `"— Guitar Hub"`, update each one. If they use the template, only the root metadata object needs changing.
- Run `grep -ri "guitar hub" src/ public/` (case-insensitive) to catch any casing variants (`Guitar Hub`, `guitar hub`, `GUITAR HUB`). Also check `package.json` and `wrangler.toml`.
- `wrangler.toml` comment at the top references `guitar-hub` in the D1 execute command: `wrangler d1 execute guitar-hub`. This references the Cloudflare project name (the `name` field), which IS being changed to `music-hub`. Update the comment to match.

## Implementation Plan

> **Branch note:** `public/manifest.json` and `public/offline.html` do not exist on the working branch (`worktree-multi-instrument-001`) — they were added on `master` (commits `6d1e7cd`, `cfb57ca`) after the branch was cut. Their rename criteria are deferred to branch integration, when master's PWA files land on this branch (ticket 010 has the same dependency). All other criteria apply here.

1. `src/app/layout.tsx` — adopt the title template from the Notes: `title: { default: "Music Hub", template: "%s — Music Hub" }`; update `description` to "A personal music sheet and tablature collection"
2. Strip the hardcoded `" — Guitar Hub"` suffix from all seven page-level titles (guitar + piano: add, edit, artist, song detail) so they use the template — e.g. `"Add a Song"`, `` `${artist.name}` ``, `` `Edit ${song.title}` ``
3. `src/components/Header.tsx` — logo text spans `Guitar`/`Hub` become `Music`/`Hub`
4. `wrangler.toml` — `name = "music-hub"`; `database_name = "guitar-hub-db"` untouched; deployment comments updated at discretion to reference the real database name (`guitar-hub-db`), since `wrangler d1 create/execute` take the database name, not the project name
5. `package.json` — `"name": "music-hub"`
6. Verify with case-insensitive grep over `src/` and `public/`; run `pnpm test`, `pnpm lint`, `pnpm build`; then `/ticket-verifier`

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.

## Verification (ticket-verifier, 2026-07-05)

All acceptance criteria that can be satisfied on this branch pass:
- `pnpm test`: 54/54 passed
- `pnpm lint`: clean (biome check, 46 files)
- `pnpm build`: compiles, no TypeScript errors
- `grep -rin "guitar hub" src/ public/ package.json wrangler.toml`: no matches
- `grep -rn "Guitar Hub" src/ public/`: no matches
- Manual diff review confirmed `layout.tsx`, `Header.tsx`, `wrangler.toml`, `package.json`, and all 8 page-level titles match the ticket's intent; the title-template approach in `layout.tsx:24-30` is consistent with the ticket's Notes
- `wrangler.toml` deployment comment now correctly reads `guitar-hub-db` for the `wrangler d1 create`/`execute` commands — this also fixes a pre-existing inconsistency where the original comment said `guitar-hub` (no `-db` suffix) while `database_name` was always `guitar-hub-db`

**Risk — deferred criteria at merge time:** `public/manifest.json` and `public/offline.html` do not exist on `worktree-multi-instrument-001` (confirmed via `ls public/` on both the worktree and `master`). They were added on `master` after this branch was cut (commits `6d1e7cd`, `cfb57ca`) and are therefore out of reach for this ticket. Their "Guitar Hub" → "Music Hub" rename must be applied **when this branch merges/rebases onto `master`** — otherwise the merged app will carry a manifest and offline page still branded "Guitar Hub" alongside a renamed header and title. Whoever performs the branch integration should re-run `grep -ri "guitar hub" public/manifest.json public/offline.html` immediately after the merge and rename both files before closing out the multi-instrument feature. Ticket 010 (Service Worker and PWA Updates) has the identical dependency on `public/sw.js`, which also does not exist on this branch.

## Follow-Up Verification (ticket-verifier, 2026-07-05)

`master` merged into `worktree-multi-instrument-001` in commit `6c20e2c`, bringing `public/manifest.json`, `public/offline.html`, and `public/sw.js` onto the branch. The rename of the two previously-deferred files was applied in the reconciliation commit `3371bce`:
- `public/manifest.json`: `name` and `short_name` → `"Music Hub"` (confirmed lines 2-3)
- `public/offline.html`: `<title>` → `"Offline — Music Hub"` (line 6), `<h1>` → `"Music Hub"` (line 77)

Re-ran `grep -rin "guitar hub" src/ public/ package.json wrangler.toml` on the merged branch: no matches. Both deferred acceptance criteria are now checked above. This resolves the risk noted at merge time; no further action needed on this ticket.
