# Day 11 - Customers: list, detail and verification

Based on Handbook sections 5.6, 8.7 and 10. Branch: `feature/day-11`, from reviewed main after PR #10.

## Scope

- Customer list: server pagination, search by name/email/phone, approval filter and sorting.
- Row click or customer-name button opens a responsive detail modal.
- Summary, Documents and Account details organize every field returned by the detail endpoint, including referral, document OCR, face verification, nullable values and deletion metadata.
- Approve/reject, explicit block/unblock, soft delete and restore require confirmation. Actions refresh detail and list; duplicate submission is locked synchronously.
- `customers.edit` controls verification/block/restore and `customers.delete` controls deletion. Route access uses `customers.view`. These are UI controls; backend authorization remains the server's responsibility.
- Shared API wrapper handles cookies, timeouts, server messages and expired-session events. No direct fetch in components, backend edits or new dependencies.

## Actual backend differences

- `/users?approvalStatus=approved` is supported; `verified` is not a recognized filter. Pending is `!isApproved && !isBlocked`. Approved and blocked can overlap, so the list shows both badges where applicable.
- `/users` excludes deleted records before applying any filter. A Deleted list cannot be implemented honestly with this endpoint. Open customer by UUID can retrieve a deleted record and offer Restore. Immediately after Delete, the detail remains open and also offers Restore. No guessed endpoint or local-only archive is used.
- `PUT /users/:id/verify` accepts `{approve: true|false, rejectionReason?}`. Reject marks documents Rejected, but face status Pending; it clears approval rather than adding a new account-status enum. The pending filter still includes rejected unapproved customers.
- `PATCH /users/:id/block` sends `{blocked: true|false, reason}` explicitly, never relies on toggle semantics.
- Customer detail does not expose blockReason; the UI does not invent it.
- Every action re-reads the customer before mutation. This catches stale dialogs but is not an atomic server-side concurrency guarantee.
- Document/photo links allow only HTTP(S), use no-referrer and do not automatically load external images.
- Day 12 payment/debt/bonus/devices/login-history/revenue/reservation sub-tabs are intentionally deferred.

## Review walkthrough

Approve -> fresh detail check -> PUT verify -> backend updates approval and document/face flags -> GET detail and list -> approved badge and updated document state; the row leaves the pending-filter list.

Deletion is soft deletion. The record disappears from the collection but GET by UUID still works. Restore clears deletion fields; it does not automatically approve or unblock the customer.

## Verification and handoff

Live local GET list/pending/detail responses were inspected before implementation. Mutation tests use mocks or an isolated in-memory backend, not the user's running dataset.

- `npm test -- --maxWorkers=1 --testTimeout=30000`: 145 tests across 15 files passed.
- `npm run build`: TypeScript and production build passed.
- `node scripts/verify-day11.mjs C:/Users/sadig/Desktop/drigo.dev.node`: isolated real-backend approve/reject, document/face states, block/unblock, delete/restore and list contracts passed.
- Browser: customer list, row-click detail, Summary and Documents inspected. Mobile detail checked at 390px: document scroll width 390px, modal width 358px; no page-level horizontal overflow. The viewport override was reset afterwards.

PR screenshot, review and merge are separate handoff steps; do not push directly to main.
