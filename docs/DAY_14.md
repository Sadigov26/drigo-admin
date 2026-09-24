# Day 14 — Fines & Accidents

## Scope

Handbook Section 8.9: manual fines, review queue, scraper records, per-car fines and accident CRUD. Shared API client, cookie session/error handling, permission guard, tables, modals and status badges are reused.

- Fine lists: search, status filtering, sortable amount/date, pagination and loading/empty/error states.
- Row or underlined ID opens a refreshed detail with all returned fields and image previews.
- Customer/company billing and dismissal require confirmation. Controls lock during submission; stale or terminal fine states are rejected before POST. A missing customer disables customer billing.
- Car fines show portal figures separately from the current per-car record total. Recorded fines expand into complete details.
- Accidents: list, status filter, complete detail/photos, create/edit form and permanent-delete confirmation. Forms validate amounts, UUIDs, dates and linked records. Editing preserves photos and other fields omitted from the update body.
- Successful actions refetch the detail and current list. Failed/uncertain actions require refresh before retrying; no automatic financial mutation retries.
- The module uses fines.view/create/edit/delete permissions, matching the mock's single Fines permission module.

## Backend differences from handbook

- `/manual-fines/scraper` returns a paginated list of scraper-sourced fines, not a status page. Sync status is at `/manual-fines/sync-status`. The UI's scraper-record count is the complete list count, not a fabricated last-run count.
- bill-customer requires a linked customer on the fine. The button is disabled when fine.userId is null. Backend itself would otherwise mark Billed without creating debt.
- Review includes both Pending and Review records and returns an array.
- There is no GET fine-by-ID or accident-by-ID route. Detail refresh finds the current record in complete paginated lists.
- These lists do not support search. Search/filter/display pagination use a complete snapshot, capped at 10,000 records. Changed totals, duplicates and incomplete pages fail rather than silently hide data. Large datasets need server search.
- Car-fines portal aggregates are seeded separately and can differ from current manual-fine totals. The detailed total is the sum of all returned fine records, not an unpaid balance.
- Customer billing creates an unpaid Fine debt. Company billing and dismissal do not create customer debts.
- Backend does not prevent duplicate billing. Frontend preflight and double-click protection reduce risk but cannot make separate GET/POST requests atomic or protect against another client racing the request. Production needs backend idempotency/transition validation.
- The mock accepts arbitrary accident updates and lacks relational validation; the frontend validates references and sends an explicit field allowlist. Backend remains unchanged.

## Verification

- Inspected live curl responses for list/review/scraper/sync/car detail/accidents before implementation.
- Full suite: 184 tests passed across 18 files; production build passed after the final presentation edits.
- `node scripts/verify-day14.mjs ../drigo.dev.node` passed: unauthenticated 401, customer billing creates exactly one unpaid debt, company/dismiss leave debts unchanged, review/scraper contracts, car totals, accident create/status-update/delete and missing-record 404.
- Re-ran isolated Day 10–13 contract scripts successfully. All scripts use a fresh non-persistent backend, not the running database.
- Browser checks inspect lists and details without billing, deleting or creating live records.

## Review explanation

Confirm bill-customer -> recheck the fine and linked customer -> POST -> backend sets Billed/Customer and inserts an unpaid Fine debt -> reload fine/list. Opening Customers > Debt fetches the new debt from the backend; it is not a frontend-only balance adjustment.

## Delivery

feature/day-14 is based on origin/main at ca23968 (Day 13 merged). Commit, push, screenshot attachment, PR review and merge remain separate pending steps.

## Checkpoint through Day 14

The two supplied Downloads PDFs have identical main handbook requirements. Their appendices differ in language and sample Salik/ENOC counts; runtime data must not be hardcoded to either sample count.

Sections 8.1–8.5 and 8.7–8.9 map to implemented modules. Section 8.6 Reservations/Delivery is scheduled next, not missing from an already completed module. The single production fetch call remains in src/api/client.ts. Existing automated tests cover auth, permissions, dashboard, cars, catalog, rentals, customers and debts; this is regression evidence, not a guarantee that every possible UI path is defect-free.

Known remaining scope: payment retry (Section 5.6/appendix), advanced customer operations and later modules. No POST /users exists, so Add customer is not implemented. Per-brand colors follow the actual API; unsupported standalone color/delete endpoints are not invented. Debt split rejects amounts that the mock would round into a different total. CSV remains a plain-text export, not a styled workbook.

The 21-day commit requirement and PR approvals are process checks, not proven by passing tests. Day 14 is not fully Done under Section 11 until its PR is reviewed and merged.
