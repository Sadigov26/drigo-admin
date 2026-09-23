# Day 13 — Debts

Implements Handbook Section 8.8 using the existing mock backend unchanged.

## Scope

- Debtors: name, email, phone, outstanding amount and unpaid record count; search, sorting and pagination.
- All debts: customer, amount, type, paid/unpaid status and creation date; unfiltered initial view, payment-status filter, search, sorting and pagination.
- Click a customer/row to open their debt account. UUID lookup also opens accounts without debt so an initial debt can be added.
- Pay all, selected and single debts require a confirmation and current-state check. Selection is scoped to one customer and cleared after an operation.
- Split accepts 2–12 whole-number parts. Add debt validates a positive AED amount with at most two decimals, type and description. Delete has an explicit permanent-deletion confirmation.
- Successful actions refetch the customer debts and reload both list snapshots. No optimistic financial state is applied. Failed or uncertain actions require a refresh before another attempt.
- Actions require debts.edit, debts.create or debts.delete as appropriate; the page uses the existing debts.view route guard. Backend authorization remains the server's responsibility.
- CSV downloads the full debtor report via the shared API client's blob response mode, preserving cookies, timeout/error handling and session-expiry events. The object URL is revoked after download initiation.

## Verified contracts and limitations

| Endpoint | Actual behavior |
| --- | --- |
| GET /api/admin/debts | Paginated rows, supports isPaid/type/sort; no search |
| GET /api/admin/users/with-debt | Paginated customer rows and totalDebt; supports minDebt/sort; no search or unpaid count |
| GET /api/admin/users/:id/debt | Full account debt list and outstanding total |
| POST /api/admin/users/:id/debt/pay | All unpaid records become paid |
| POST /api/admin/users/:id/debt/pay-selected | Body: debtIds array |
| POST /api/admin/users/:id/debt/:debtId/pay | Single debt becomes paid |
| POST /api/admin/users/:id/debt/:debtId/split | Body: parts; returns success/parts |
| POST /api/admin/users/:id/debt | amount, type, description; returns created record, HTTP 201 |
| DELETE /api/admin/users/:id/debt/:debtId | Permanent removal; 404 if absent; mock currently has no 409 rule |
| GET /api/admin/users/with-debt/report | text/csv; attachment filename debtor-report.csv |

Search, display pagination and filters operate on complete paginated snapshots, not only one page. Unpaid counts are calculated from the all-debt snapshot. Loads detect changed page totals/duplicates and fail instead of displaying incomplete results. There is a 10,000-row safety cap; larger datasets need backend search/aggregation. Separate resources are not an atomic snapshot and simulator changes between requests remain possible. Each action rechecks the account immediately before mutation; that does not eliminate the final GET/POST race.

The mock split rounds each part equally without assigning a remainder. To prevent a changed total, the UI rejects combinations that cannot divide exactly in cents (e.g. 10 AED into three parts); it does not change backend code or silently alter the amount. Paid debts cannot be split/paid again through the UI. The backend itself is less restrictive.

HTTP errors including 409 are surfaced by the client even though the current delete route does not generate 409. Do not invent a conflict rule. Pay all includes every unpaid record as implemented by the backend, including Company-billed records; the UI follows the returned totals.

CSV is the full backend report, not the current local search results. The frontend checks the MIME type and uses a fixed safe filename. Spreadsheet users should import exported customer text as text, not formulas; the mock export does not provide spreadsheet-formula escaping.

The download adds a UTF-8 BOM and Excel's `sep=,` directive so regional Excel settings can separate the four columns. Report values are preserved. CSV does not store colours, column widths or cell types; import Phone as Text to preserve the leading plus. Non-Excel CSV importers should skip the separator directive. Customer creation is not part of Section 8.7 and the current backend has no POST /users route; a seeded customers.create permission alone does not create that API.

## Verification

- Read the route implementations and used curl against live GET lists and the CSV response before implementation.
- scripts/verify-day13.mjs starts a separate in-memory backend with persistence/simulation disabled. It passed list/filter, add, exact split, selected/single/all payment, delete/404, debtor removal, CSV headers/content and isolation checks.
- Component/API tests cover snapshot validation, sorting/search, exact action bodies, stale-state guards, rounding protection, errors, read-only permissions, confirmation/double submission and blob session handling.
- No running customer debts were paid, split or deleted during testing.
- Production build passed; the full unit/component suite passed 174 tests across 17 files.
- Browser checks covered opening a debt account, the add form, the paid filter and CSV download. The downloaded debtor-report.csv was verified in Downloads; live financial records were not mutated.

## Git dependency

feature/day-13 starts from the pushed Day 12 tip because Day 12 was not yet merged into main. Keep its PR based on feature/day-12 until that PR is merged, then review the final diff against main. Commit/push/PR/merge are separate steps, not completed by writing the module.

## Review explanation

Pay all calls the customer-scoped endpoint. The backend sets unpaid debts to isPaid=true and records paidAt. The frontend reloads the account plus both lists; when totalDebt is zero the backend no longer returns that customer in with-debt. The Customer debt account stays open so the operator can see the paid records.
