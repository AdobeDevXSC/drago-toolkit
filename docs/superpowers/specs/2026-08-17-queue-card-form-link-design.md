# Queue card → intake form link

**Date:** 2026-08-17
**Branch base:** `feat/queue-status-filters`
**Status:** approved, implementing

## Goal

Each card in the DA-embedded Pilot Applications queue (`tools/queue/queue.js`)
should show a link that opens the intake form for that submission, e.g.:

```
https://main--drago-toolkit--adobedevxsc.aem.page/intake/form?share=a3aec53b1ff9
```

The `share` token is the submission's existing **shareId** — the same value the
queue already uses as the Fusion delete key (`key`/`shareId`/`id`/`share_id`).
Opening the form with `?share=<id>` restores that submission's data.

## Design

- **URL builder** — new pure module `tools/queue/form-share-url.js` exporting
  `buildFormShareUrl(context, shareId)`:
  - host `https://main--${repo}--${org}.aem.page`, path `/intake/form`,
    query `share=<shareId>`.
  - `org`/`repo` come from the component's `this.context` (DA SDK / embedded URL
    resolution) — `adobedevxsc` / `drago-toolkit` here.
  - returns `null` when `org`, `repo`, or a valid `shareId` is missing. `shareId`
    is validated with the same rule the form uses (`/^[a-zA-Z0-9-]{4,128}$/`).
  - Isolated in its own module (no remote imports) so it is unit-testable —
    `queue.js` imports `DA_SDK` from da.live, which cannot load in the test runner.
- **Card rendering** — `queue.js` gains `_renderFormLink(record)`, rendered as the
  first item in the existing `ema-queue__card-actions` row (alongside
  Reviewed/Engaged). It renders a real `<a>` with `target="_blank"` +
  `rel="noopener noreferrer"` (the tool runs inside the DA iframe, so it must open
  a new tab). The link renders **only when `buildFormShareUrl` returns non-null**,
  so parse-error cards and rows without a share key get no link. Incomplete
  submissions **do** get one (resume-your-application case).
- **Styling** — `ema-queue__form-link` styled as a pill consistent with
  `ema-queue__toggle` / `ema-queue__view-details`, with an external-link icon.

## Defaults (confirmed)

- Host `.aem.page` (preview) and ref `main` — matching the example URL literally.
- Label: `Open form`.

## Tests

`test/tools/form-share-url.test.js` — asserts the exact example URL is produced,
`org`/`repo`/`shareId` are trimmed, hyphenated ids are accepted, and `null` is
returned for missing/invalid inputs.

## Out of scope (backlog)

**Soft delete** for the queue was requested but deferred — it needs the Fusion
"status" scenario (behind `STATUS_ENDPOINT`) to persist a `deleted` flag first.
Direction captured for a later task: reuse the reviewed/engaged status-webhook
pattern (`{ key, deleted: true|false }`), add a hidden "Deleted" filter bucket
with Restore, and keep the existing permanent hard-delete available from it.
