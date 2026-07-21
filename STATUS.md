# Project Status

> Last updated: 2026-07-21 18:32 UTC

## Current Phase

| Phase | Status |
|-------|--------|
| Decide | |
| Map | |
| Decompose | Done |
| Execute | Done |
| Review | Done |
| Audit | |
| Learn | |
| Report | |

## Active Work

**chat-based import (ADR-0010) is feature-complete — all four `chat-import` tickets Done and verifier-approved.** The three-tab ImportForm (Paste Text / URL / Image) is replaced by a single chat interface: free-form text, multi-image attachments (2-4 typical, 10 cap), multi-turn refinement, and in-chat result cards with "Use this result"; URL mode dropped.

- **001 (proxy multi-image contract)** — Done, committed (`35c07c9`): proxy accepts an `images` array with a legacy `image` shim, threads conversation history into the `-p` prompt, bulk-cleans temp files.
- **002 (ImportForm chat core)** — Done: full rewrite to a chat thread + composer, multi-turn text-only flow, in-chat result cards, retry, URL mode removed.
- **003 (multi-image attachment)** — Done: file-picker/drag-drop/paste convergence, removable thumbnails, 10-image cap, per-image normalization with the size-retry guard, per-turn `IMAGE_SYSTEM_PROMPT` selection, default-message substitution, `images` array wiring, `instrument` forwarding restored.
- **004 (ADR-0009 status note, doc-only)** — Done: ADR-0009 marked Superseded by ADR-0010 for its UI/single-image contract, with a pointer callout; normalization/proxy patterns noted as still in effect.

**Uncommitted:** tickets 002–004's work (ImportForm rewrite + multi-image UI + tests + the ADR-0009 status note) is in the working tree, not yet committed. Next step: commit the chat-import feature. `pnpm build`, `pnpm lint`, and `pnpm test` (245/245) are all green.

ai-import (ADR-0009) remains feature-complete and deployed to `guitar-hub.pages.dev`; ADR-0009's status line now points forward to ADR-0010.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `feature/chat-import`  
**Last commit:** 2026-07-21 18:32 UTC

| Hash | Date | Message |
|------|------|---------|
| `c4e37f3` | 2026-07-21 | Add chat-based import: multi-turn, multi-image ImportForm (chat-import 002-004) |
| `5cf5f5f` | 2026-07-18 | Update STATUS.md for chat-import 001; add verifier-suggested test assertion |
| `35c07c9` | 2026-07-18 | Add ADR-0010 and proxy multi-image contract (chat-import ticket 001) |
| `890794f` | 2026-07-15 | Pass --add-dir to claude -p so it can read temp image files |
| `640d1c3` | 2026-07-14 | Fix JSON parsing when AI response is wrapped in markdown fences |
| `915ac6e` | 2026-07-14 | Widen AI-import gate to guitar and piano (ai-import ticket 009) |
| `fa536e2` | 2026-07-14 | Add ImportForm image input mode (ai-import ticket 008) |
| `94acc17` | 2026-07-14 | Add client-side image normalization module (ai-import ticket 007) |
| `f33e911` | 2026-07-13 | Mark ai-import ticket 006 Done (verifier approved) |
| `d281b6c` | 2026-07-13 | Add AI proxy image-input branch (ai-import ticket 006) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                                   |   78 +-
 architecture/decisions/0009-in-app-image-import.md          |    4 +-
 architecture/decisions/0010-chat-import-redesign.md         |  244 ++++++
 scripts/ai-proxy.ts                                         |   20 +-
 scripts/image-import.test.ts                                |  211 ++++++
 scripts/image-import.ts                                     |  129 +++-
 src/components/ImportForm.test.tsx                          | 1003 +++++++++++++------------
 src/components/ImportForm.tsx                               |  834 +++++++++++++-------
 tickets/_backlog.md                                         |    6 +-
 tickets/chat-import/001-proxy-multi-image-contract.md       |   77 ++
 tickets/chat-import/002-import-form-chat-core.md            |   83 ++
 .../chat-import/003-import-form-multi-image-attachment.md   |   81 ++
 tickets/chat-import/004-update-adr-0009-status.md           |   42 ++
 13 files changed, 1981 insertions(+), 831 deletions(-)
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| [001 — Proxy: Multi-Image Array Contract](tickets/chat-import/001-proxy-multi-image-contract.md) | chat-import | Done |
| [002 — ImportForm: Chat Core](tickets/chat-import/002-import-form-chat-core.md) | chat-import | Done |
| [003 — ImportForm: Multi-Image Attachment](tickets/chat-import/003-import-form-multi-image-attachment.md) | chat-import | Done |
| [004 — Update ADR-0009 Status](tickets/chat-import/004-update-adr-0009-status.md) | chat-import | Done |
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
| 2026-07-14 | ai-import 007–009 done and deployed: client normalization module (canvas downscale → JPEG), ImportForm Image mode (picker/drop/paste), add-page gate widened to piano; all verifier-approved; feature complete and live on guitar-hub.pages.dev |
| 2026-07-15 | Two image-import bug fixes: markdown-fence stripping before JSON.parse in ImportForm, and `--add-dir tmpdir()` in the `claude -p` spawn (headless claude could not read the temp image outside its cwd — the actual cause of the "Could not parse the AI response" error, reproduced and verified with the user's Tanjiro no uta screenshot). ADR-0010 (chat-based import) authored; decomposed into chat-import tickets 001–004 |
| 2026-07-18 | chat-import/001 done: proxy accepts `images` array (legacy `image` shimmed), `buildExtractionPrompt` threads Human:/Assistant: history before current turn + image paths, bulk temp-file cleanup on every outcome; 13 new tests (243/243); live-verified 2-image + 3-message request → stitched transcription, zero temp files left; verifier approved |
| 2026-07-18 | chat-import/002 done: ImportForm rewritten from three-tab UI to a chat thread + auto-expanding composer (Enter-to-send/Shift+Enter-newline), full multi-turn history sent per request, in-chat result cards with "Use this result", raw-text/empty-tab fallbacks, in-thread errors + retry, URL mode removed; test suite rewritten; verifier approved |
| 2026-07-19 | chat-import/003 done: multi-image attachment on the composer — file-picker/drag-drop/paste funnel through one `addImages` with a 10-image cap, removable thumbnails, per-image normalization reusing ai-import/008's one-shot size-retry guard, per-turn `IMAGE_SYSTEM_PROMPT` selection, "Transcribe the attached sheet(s)." default substitution, `images` array wiring, `instrument` forwarding restored, attachments cleared after send; +20 tests (245/245); build/lint/test green; verifier approved |
| 2026-07-21 | chat-import/004 done (doc-only): ADR-0009 status set to "Superseded by ADR-0010 (UI and single-image contract); normalization and proxy patterns remain in effect" with a pointer callout to ADR-0010; no other ADR content changed; verifier approved. chat-import feature complete (001–004 all Done); work 002–004 still uncommitted in the working tree |
