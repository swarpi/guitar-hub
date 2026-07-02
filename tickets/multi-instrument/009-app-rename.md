# Ticket: App Rename — Guitar Hub to Music Hub

**Feature:** multi-instrument
**Status:** Todo
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

- [ ] `src/app/layout.tsx`:
  - `metadata.title` changed from `"Guitar Hub"` to `"Music Hub"`
  - `metadata.description` changed from `"A personal fingerstyle guitar tablature collection"` to `"A personal music sheet and tablature collection"`
- [ ] `public/manifest.json`:
  - `name` changed from `"Guitar Hub"` to `"Music Hub"`
  - `short_name` changed from `"Guitar Hub"` to `"Music Hub"`
- [ ] `src/components/Header.tsx`: the display text `"Guitar Hub"` changed to `"Music Hub"` (wherever the app name appears — logo text, `<title>` suffix, or `aria-label`)
- [ ] `wrangler.toml`: `name = "guitar-hub"` changed to `name = "music-hub"`; `database_name = "guitar-hub-db"` is NOT changed
- [ ] `package.json`: `"name": "guitar-hub"` changed to `"name": "music-hub"`
- [ ] `public/offline.html`: `<title>Offline — Guitar Hub</title>` changed to `<title>Offline — Music Hub</title>`; `<h1>Guitar Hub</h1>` changed to `<h1>Music Hub</h1>`
- [ ] All page-level `title` metadata strings that include `"Guitar Hub"` as a suffix (e.g., `"Add a Song — Guitar Hub"`) are updated to use `"Music Hub"` — search for any remaining `Guitar Hub` occurrences in `src/`
- [ ] `grep -r "Guitar Hub" src/ public/` returns no matches after the change
- [ ] `pnpm build` passes with no errors
- [ ] `pnpm lint` passes
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

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

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
