# Day 5 — Remaining dashboard panels

## Handbook alignment

Section 8.2 lists fleet summary, online users and recent activity alongside the Day 4 KPI cards and trends. The acceptance condition is live data that refreshes. Section 7 places the dashboard in Week 1; it does not prescribe an exact five-day schedule.

Sections 10 and 11 also require a feature branch based on main, a PR with a description and screenshot, review, and merge. Completing the code alone does not close Week 1. The current handoff is a local Day 5 commit only; push, PR and merge remain separate steps.

## Actual backend contracts

All three endpoints were called with curl using a temporary local test session. The session was logged out and its cookie file removed. Backend source was inspected without edits.

| Endpoint | Response used |
| --- | --- |
| `GET /api/admin/dashboard/fleet` | `total`, `available`, `rented`, `inactive`, `online`, `lowFuel`, `byCity: [{ city, count }]` |
| `GET /api/admin/dashboard/online-users` | An array, not a paginated envelope: `userId`, `fullName`, `platform`, `lastLoginAt` |
| `GET /api/admin/dashboard/recent-activity` | `recentRentals`, `recentReservations`, `recentSupportMessages` |

Fleet values and city names come directly from the response. Online/low-fuel counts overlap other fleet statuses; they must not be added together to calculate total cars. A missing fleet payload has an empty state, while malformed count data is an error.

Online users is capped at 50 by the server. The backend selects its `online` flag, not a last-login time window. The displayed last login can therefore be old. Location fields are not needed for this task and are not displayed or stored.

Recent rentals contain nested `user.fullName` and `car.plateNumber`; reservations contain flat `customerName` and `plateNumber`. Each recent collection is selected with `slice(-6).reverse()` in the backend, so the UI preserves that returned order by default. It does not request or invent six records when fewer exist. The response's separate `activity` event log is not needed for the requested three lists.

Support messages include `supportId`, `createdBy`, `isOperator`, `message` and `createdAt`. Message text is rendered through React, never as HTML. Optional missing names, prices and dates show "Not provided"; valid zero prices remain zero. Timestamps are labeled and formatted in the Dubai time zone.

## UI and requests

The existing API client remains the only fetch wrapper. Cookies, timeouts, HTTP errors and session-expiry handling still apply. `dashboard.view` is checked before mounting the page; frontend checks do not replace backend authorization.

All five dashboard endpoints load independently. The common Refresh button re-fetches all five; retry only re-fetches the failed resource. Aborted/unmounted requests cannot replace newer data. Each of the three recent lists has its own empty state; because they share one endpoint, a request failure is shown once for the recent-activity section with one retry action.

`SnapshotTable` reuses the shared Table for local search, sorting, filtering and pagination. These controls operate only on the bounded snapshot already returned (up to 50 online users, up to six records in each recent list). They are not substitutes for server pagination on the future Cars/Rentals/Customers modules. No unimplemented detail links or write actions were added.

## Verification

- 61 automated tests passed, including 15 new Day 5 tests.
- TypeScript and production build passed.
- Tests cover real field mappings, missing optional values, malformed responses, duplicate IDs, fleet counts, online-user filtering/pagination, six-row recent lists, safe message rendering, empty/loading/error/retry states, five-endpoint refresh and request cancellation.
- Existing permission denial and 401 redirection tests remain passing. Additional tests check session expiry on all three Day 5 endpoints and prevent an older response from overwriting a newer refresh.
- Real authenticated curl calls returned all three expected payloads.
- Browser review completed on 16 September 2026 with a real local session: desktop and 390px mobile layouts, fleet city counts, online-user filtering/search/pagination, search-empty state, and six records in each recent list. Tables scroll inside their containers without page-level horizontal overflow.
- Refresh loaded fresh data and advanced the fetch timestamps. Browser console checks returned no warnings or errors. Loading, request-error, retry and session-expiry scenarios were verified by automated tests, not by interrupting the running backend.

## Local branch dependency

`feature/day-05` starts from Day 4 commit `420d87c`. At preparation time, Day 4 had been pushed but had not yet been merged into main. This is a local dependency branch; verify the current main and Day 4 PR status before publishing Day 5. The Day 5 commit contains only the changes after that Day 4 baseline.

Before opening the Day 5 PR, merge Day 4 through its own reviewed PR, fetch the updated main and reconcile the Day 5 base. If Day 4 was squash-merged or changed during review, transfer only the Day 5 delta onto a branch from updated main; do not blindly include the Day 4 commit again. Inspect the final PR diff to confirm it contains only Day 5 changes.

## Week 1 closing checklist

- [x] Auth, cookie session, guards and logout implemented.
- [x] Permissions menu and shared components implemented.
- [x] Section 8.2 dashboard endpoint integrations implemented.
- [x] Automated tests and build pass.
- [x] Review desktop/mobile layouts and search-empty state; test loading/error/retry states automatically.
- [ ] Read and explain the request lifecycle, data mappings, table controls and permission checks.
- [ ] Day 4 PR: description, screenshot, review and merge.
- [ ] Day 5: main-based final diff, commit, PR description and screenshot, review and merge.
- [ ] Update local main after merge, then begin the Cars module.

Commit dates are actual work/commit dates; several named tasks completed on one date do not count as several distinct commit days.
