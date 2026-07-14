# Project Status

> Last updated: 2026-07-14 17:08 UTC

## Current Phase

| Phase | Status |
|-------|--------|
| Decide | |
| Map | |
| Decompose | Done |
| Execute | Next |
| Review | |
| Audit | |
| Learn | |
| Report | |

## Active Work

New feature: **in-app image import** (ADR-0009, Accepted) — an "Image" mode in the "Import via AI" form (file / drag-drop / clipboard-paste) that transcribes a screenshot or photo of a song sheet one-shot and pre-fills the Add-a-Song form for review. Guitar → tab text, piano → ABC. Local-only, same posture as the existing text/URL AI import (reverses the ADR-0007 §7 descope of ADR-0006 Phase 3). Decomposed into four `ai-import` tickets (006–009). **Ticket 006 (proxy image handling) is Done and verified** (commit `d281b6c`) — the proxy now writes an incoming base64 image to a temp file, runs `claude -p` against an instrument-aware prompt, and cleans up. Next step: ticket 007 (client normalization module, parallelizable and independent of 006), then 008 (ImportForm image UI, depends on 006+007) and 009 (add-page gate, independent).

sheet-ingest (ADR-0007) is feature-complete: all eight tickets (001–008) Done and verified, migration `0002_sheet-metadata.sql` applied to production D1 (2026-07-12), and the app is deployed and live on `guitar-hub.pages.dev`.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-14 17:08 UTC

| Hash | Date | Message |
|------|------|---------|
| `fa536e2` | 2026-07-14 | Add ImportForm image input mode (ai-import ticket 008) |
| `94acc17` | 2026-07-14 | Add client-side image normalization module (ai-import ticket 007) |
| `f33e911` | 2026-07-13 | Mark ai-import ticket 006 Done (verifier approved) |
| `d281b6c` | 2026-07-13 | Add AI proxy image-input branch (ai-import ticket 006) |
| `ca5cbe0` | 2026-07-13 | Add ADR-0009 (in-app image import) and decompose into ai-import tickets 006-009 |
| `5069d37` | 2026-07-12 | Deploy to Cloudflare Pages after 0002 migration |
| `70389f6` | 2026-07-12 | Apply 0002 sheet-metadata migration to production D1 |
| `a0f810a` | 2026-07-12 | Add sheet-ingest Claude Code skill (sheet-ingest ticket 008) |
| `53589db` | 2026-07-12 | Sync STATUS.md dashboard after ticket 006/007 commits |
| `a883575` | 2026-07-12 | Run falling-notes frame-to-MIDI spike: real Synthesia tutorial to validated MusicXML (sheet-ingest ticket 007) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                           |  57 +++---
 architecture/decisions/0009-in-app-image-import.md  | 218 +++++++++++++++++++++++
 scripts/ai-proxy.ts                                 |  19 ++
 scripts/image-import.test.ts                        | 248 ++++++++++++++++++++++++++
 scripts/image-import.ts                             | 161 +++++++++++++++++
 src/components/AddPageClient.test.tsx               |  70 +++++---
 src/components/AddPageClient.tsx                    |   3 +-
 src/components/ImportForm.test.tsx                  | 319 +++++++++++++++++++++++++++++++++-
 src/components/ImportForm.tsx                       | 269 +++++++++++++++++++++++++---
 src/lib/image-normalize.test.ts                     | 165 ++++++++++++++++++
 src/lib/image-normalize.ts                          | 138 +++++++++++++++
 tickets/_backlog.md                                 |  10 +-
 tickets/ai-import/006-proxy-image-handling.md       |  84 +++++++++
 tickets/ai-import/007-image-normalization-module.md |  67 +++++++
 tickets/ai-import/008-import-form-image-input.md    |  97 +++++++++++
 tickets/ai-import/009-add-page-instrument-gate.md   |  59 +++++++
 16 files changed, 1901 insertions(+), 83 deletions(-)
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| [006 — AI Proxy: Image Input Handling](tickets/ai-import/006-proxy-image-handling.md) | ai-import | Done |
| [007 — Client-Side Image Normalization Module](tickets/ai-import/007-image-normalization-module.md) | ai-import | Up Next |
| [008 — ImportForm: Image Input Mode](tickets/ai-import/008-import-form-image-input.md) | ai-import | Up Next |
| [009 — Add Page: Widen AI-Import Gate to Guitar and Piano](tickets/ai-import/009-add-page-instrument-gate.md) | ai-import | Up Next |
| [003 — Offline Fallback Page](tickets/pwa/003-offline-fallback-page.md) | pwa | In Review |

## Risks & Blockers

- None.

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
| 2026-07-05 | Ticket 009 done: Music Hub rename via layout title template, 8 page titles simplified, header/wrangler/package renamed; manifest+offline.html deferred (master-only files); ticket 010 flagged blocked pending master integration |
| 2026-07-05 | Merged master into branch (PWA, AI import, deploy config); re-homed AddPageClient onto /guitar/add; fixed tabContent→content wire mapping; finished 009 deferrals; ticket 010 done with programmatic SW v1-eviction proof; feature complete, verifier approved |
| 2026-07-05 | route-consolidation/002 done: measured 6 edge functions / 2.52 MiB gzipped (cap 3 MiB); production deployed and live smoke-tested; D1 rename-back contingency in ADR-0008's rollout plan turned out to be a no-op (schema was already final pre-deploy) — documented as a process deviation in the ticket; verifier approved |
| 2026-07-06 | sheet-ingest/001 done: migration 0002 adds nullable difficulty/key/source_url; parseSheetMetadata validation in create+update actions; SongForm gains three optional fields; detail page renders badges + source link; migration tested against real SQL files; 143/143 tests, verifier approved |
| 2026-07-06 | sheet-ingest/002 done: MCP server scaffold (`pnpm dev:mcp`, stdio) with add_sheet/list_sheets/update_sheet as thin adapters over createSongLogic/updateSongLogic; tsconfig.mcp.json shims @cloudflare/next-on-pages for plain-Node imports of actions.ts; 7 new handler tests (150/150 total); end-to-end stdio smoke test passed; verifier approved |
| 2026-07-06 | sheet-ingest/003 done: validate_notation tool renders ABC headlessly (abcjs under jsdom, XMLSerializer, resvg → PNG); pure validateAbc with stripped abcjs warnings, explicit X: header check; 4 new tests (154/154); stdio smoke test returned correct staff-notation PNG as MCP image block; verifier approved |
| 2026-07-06 | sheet-ingest/004 done: validate_notation gains musicxml branch via Verovio WASM (lazy toolkit singleton, buffered getLog diagnostics, DOMParser well-formedness pre-check since Verovio tolerates malformed XML); 4 new tests (158/158); stdio smoke test rendered correct one-measure score; verifier approved |
| 2026-07-06 | sheet-ingest/005 spike done: 6-image PD corpus + Audiveris 5.10.2 installed and run both ways; key finding — OMR discards chord symbols (misread as dynamics) but preserves dense multi-voice structure ~80–90%; routing recommendation documented in ticket for the 008 skill; verifier approved |
| 2026-07-06 | sheet-ingest/006 done: yt-dlp/ffmpeg + Python 3.11 venv (basic-pitch, music21; four platform pins documented); audio-pipeline.ts (downloadAudio/audioToMidi/midiToNotation, descriptive stderr Errors); 18 spawn-mocked tests (176/176); e2e synthesized clip → MIDI → MusicXML → VALID render committed to fixtures; live YouTube download verified; verifier approved |
| 2026-07-06 | sheet-ingest/007 spike done: evaluated 6 frame-to-MIDI projects, selected 41pha1/MIDI-Converter (user-approved clone to ~/tools, unlicensed → local-only posture); falling-notes-pipeline.ts (extractFrames 30 fps + framesToMidi stitch-and-detect with tuning options); 10 new mocked-spawn tests (187/187); real Synthesia tutorial e2e → VALID render, melody pitch-perfect, 6 failure modes documented for the 008 skill; verifier approved |
| 2026-07-12 | sheet-ingest/008 done: `.claude/skills/sheet-ingest/SKILL.md` written (routing table, ABC conventions, OMR error patterns, validation-loop protocol, known limitations); documentation-only, verified by read-through against ADR-0007, ADR-0005 §2, and tickets 002–007's actual results (no code, no test suite impact); sheet-ingest feature complete (001–008 all Done); verifier approved |
| 2026-07-12 | Applied migration `0002_sheet-metadata.sql` to production D1 (`guitar-hub`) via `wrangler d1 execute --remote`; `difficulty`/`key`/`source_url` columns confirmed present on the production `songs` table; standing risk cleared |
| 2026-07-12 | Deployed to Cloudflare Pages (`pnpm pages:build` → `wrangler pages deploy --project-name=guitar-hub`); 6 edge routes; live-smoke-tested `/`, `/guitar` (both 200) on `guitar-hub.pages.dev`; app now in sync with the migrated production schema |
| 2026-07-13 | ADR-0009 (in-app image import) authored and Accepted — "Image" mode in the AI import form (file/drop/clipboard-paste), one-shot review-in-form, guitar→tab & piano→ABC, local-only; reverses ADR-0007 §7 descope. Decomposed into ai-import tickets 006–009 (proxy image handling, client normalization module, ImportForm image UI, add-page gate widening); backlog updated, ready to execute |
| 2026-07-13 | ai-import/006 done: new `scripts/image-import.ts` (mediaTypeToExtension, buildImagePrompt, writeTempImageFile, cleanupTempImageFile, runImageExtraction) writes a base64 image to an `os.tmpdir()` temp file, runs `claude -p` against an instrument-aware prompt (guitar→tab/chord verbatim, piano→ABC), and cleans up on every outcome; `ai-proxy.ts` gains `instrument`/`image` request fields + an image branch before URL detection, same response envelope. 15 spawn/fs-mocked tests (202/202); manual curl for guitar+piano returned 200 with correct envelope and left zero temp files; verifier approved |
