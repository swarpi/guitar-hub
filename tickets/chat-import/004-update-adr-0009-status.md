# Ticket: Update ADR-0009 Status to Superseded by ADR-0010

**Feature:** chat-import
**Status:** Todo
**Priority:** P3
**Estimate:** XS
**Related:** ADR-0010 (Section 9 "Relationship to prior ADRs"), ADR-0009 (`architecture/decisions/0009-in-app-image-import.md`)

## Context

ADR-0010 §9 states that ADR-0009's status should be updated to reflect that its three-tab UI and single-image-per-request contract are superseded by ADR-0010, while its canvas normalization, base64 transport, temp-file lifecycle, and instrument-aware prompt patterns remain in effect and are reused (and extended to arrays) by chat-import/001 and chat-import/003. This is a documentation-only housekeeping ticket with no code dependency; it exists so `architecture/decisions/` accurately reflects the current design once the chat-import feature lands, rather than leaving ADR-0009 reading as still-current.

## Goal

Update `architecture/decisions/0009-in-app-image-import.md`'s status line and add a short pointer to ADR-0010, without altering the document's historical content.

## Acceptance Criteria

- [ ] `architecture/decisions/0009-in-app-image-import.md`'s `**Status:**` line changes from `Accepted` to a value that communicates it is superseded for its UI and single-image contract while its underlying patterns remain in effect (e.g. `Superseded by ADR-0010 (UI and single-image contract); normalization and proxy patterns remain in effect`)
- [ ] A short note (1-3 sentences) is added near the top of the document (immediately below the status/date/author block, or as a clearly labeled callout) that: names `ADR-0010` and its file path (`architecture/decisions/0010-chat-import-redesign.md`), states that the three-tab UI and single-image-per-request contract are superseded, and states that canvas normalization, base64 transport, temp-file lifecycle, and instrument-aware prompts remain in effect and are reused
- [ ] No other content in `architecture/decisions/0009-in-app-image-import.md` is altered — this is a status/pointer update only, not a rewrite of the ADR's Context, Decision, or Consequences sections
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to ADR-0006, ADR-0007, or any other ADR
- Any code change
- Removing or archiving ADR-0009 — it remains in place as a historical record with an updated status, per the project's existing convention of retaining superseded ADRs rather than deleting them

## Notes

This ticket has no code dependency and can be done at any point in the sequence. It reads best once chat-import/001 and chat-import/003 have landed (or are far enough along) that the "remains in effect" note describes shipped behavior rather than a plan — but nothing about the wording requires waiting, since the underlying claim (normalization/proxy patterns are reused, not replaced) is already true from the ADR-0010 decision itself.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
