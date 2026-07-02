# Ticket: Add Page Mode Toggle and Review State

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0006

## Context

The `/add` page is a server component (`export const runtime = "edge"`) that fetches artist names from D1 and renders `SongForm`. ADR-0006 Phase 1 requires a mode toggle at the top of this page — "Manual" and "Import via AI" — so the user can choose between typing fields by hand and pasting raw text for AI extraction.

The toggle and the extracted-field state are interactive and must live in a `"use client"` component. The server component must remain a server component to retain its D1 fetch. The solution is to extract the interactive layer into a new `AddPageClient` component that the server component renders.

`SongForm` already accepts `initialValues?: SongFormInitialValues` — no changes to that component are needed. The server action `createSong` and all DB files are untouched.

## Goal

Introduce `AddPageClient`, a client component that manages mode state and renders the correct UI, while keeping `AddPage` as a server component for the D1 artist-names fetch.

## Acceptance Criteria

- [x] A new `src/components/AddPageClient.tsx` client component exists with `"use client"` at the top
- [x] `AddPageClient` accepts props: `artistNames: readonly string[]` and `action: (formData: FormData) => Promise<{ error: string } | undefined>`
- [x] A mode toggle renders two buttons — "Manual" and "Import via AI" — at the top of the component; the active mode is visually distinct (filled/active style vs. inactive style using the existing design system tokens)
- [x] Default mode on page load is `"manual"`
- [x] In `"manual"` mode, the existing `SongForm` renders exactly as it did before (same props, same behavior)
- [x] In `"import"` mode with no extracted data, a placeholder `<div>` renders with the text "Import form coming soon" — this is the mount point for the `ImportForm` component, which arrives in ticket 002
- [x] `AddPageClient` holds state for `extractedFields: SongFormInitialValues | null`, initialized to `null`
- [x] `AddPageClient` exposes an `onExtracted(fields: SongFormInitialValues)` handler that sets `extractedFields` and switches the view to the review step
- [x] In the review step (import mode + extracted fields set), the page shows a "Back to Import" button above the form, followed by `SongForm` rendered with `initialValues={extractedFields}`
- [x] Clicking "Back to Import" clears `extractedFields` (back to `null`) and returns to the import input view
- [x] `src/app/add/page.tsx` is updated to render `<AddPageClient artistNames={artistNames} action={createSong} />` in place of `<SongForm>` — the `<Header>`, `<Breadcrumb>`, and `<h1>` remain in the server component
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] At least one test covers: mode toggle rendering, switching to import mode, switching back to manual; and the review state entering/exiting via `onExtracted`
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Implementing `ImportForm` — that is ticket 002
- The duplicate warning banner — that is ticket 003
- URL or image input modes (Phase 2 and 3 of ADR-0006)
- Any change to `SongForm`, `src/app/actions.ts`, `src/db/schema.ts`, or `src/db/queries.ts`
- Any change to `scripts/ai-proxy.ts`

## Notes

- Follow the test pattern in `src/components/OfflineBanner.test.tsx`: `// @vitest-environment jsdom`, `@testing-library/react`, `cleanup` in `afterEach`.
- For the test of the review state, call the `onExtracted` prop directly (pass a spy or a local state setter) rather than simulating a real AI call — the AI interaction belongs in ticket 002.
- The `SongFormInitialValues` interface is defined in `src/components/SongForm.tsx`. Import it (or re-export it) as needed. If importing across component files causes issues with the `"use client"` boundary, define a shared type in a small `src/types/song.ts` file.
- Mode toggle button styling: look at the existing button styles in `SongForm.tsx` (the submit and cancel buttons) and the design tokens in `tailwind.config` / global CSS for `bg-leather`, `text-cream`, `border-line`, `text-ink-soft`. The active mode button should resemble the primary (leather) button; the inactive mode should resemble the secondary (outlined) button.
- The "Back to Import" button can be a plain text link styled like the cancel button in `SongForm`.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
