# Day 8 — Brands, models and colors

## Implemented locally

- Brands navigation under the existing `cars.view` permission. Create and delete controls use `cars.create` and `cars.delete`; the backend has no separate brands/models/colors permission codes.
- Paginated, searchable and sortable brand table. The brand endpoint ignores search, so the client collects complete pages before filtering and paginating locally. Incomplete responses are errors, not partial search results.
- Real model counts from each visible brand's models endpoint (`carCount` is not a model count).
- Brand create modal, confirmed deletion and server error display including 409.
- Selected-brand model list, empty/loading/error/retry states and model create modal. Models use backend defaults for seats, speed and body type.
- Brand colors with validated six-digit hex swatches, a create modal with live preview, and a server refresh after successful creation. No color delete control is rendered.
- Requests use the shared API wrapper, cookies and cancellable reads. Mutations are not automatically retried; buttons are locked while saving.

## Contract checks and blockers

Authenticated curl calls verified `GET /brands`, `GET /brands/1/models` and **404 for `GET /colors`**. Backend route source confirms that global color GET/POST/DELETE routes do not exist. Available color routes are `GET/POST /brands/:brandId/colors`; no color deletion route exists.

Brand DELETE returns 409 for linked **cars**, not merely linked models. The frontend preserves the backend's message and does not invent a different server rule. There is no model update/delete endpoint in the requested contract.

The user approved brand-scoped color management without backend changes:

```text
Colors: standalone /api/admin/colors endpoint returns 404.
Color management is implemented per-brand via POST /brands/:id/colors.
Delete endpoint not available; omitted pending backend update.
```

The implementation follows this agreed scope. Color deletion remains deferred until the backend supports it. Day 7 was merged through PR #7; Day 8 is published on its own `feature/day-08` branch. PR, screenshot and review remain required before merging Day 8 into main.

## Checks

Tests cover complete page collection, incomplete responses, model ownership, safe hex values, cookie requests, model creation, 409 messages and UI refresh. Live create/delete operations have not been performed against user catalog records.
