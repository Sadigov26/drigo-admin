# Day 3 — Navigation and shared components

## Scope

Load the signed-in admin's permissions, show the permitted sidebar links and prepare reusable list and dialog components. Business module pages are explicit placeholders; dashboard data and CRUD are separate tasks.

## Backend contract

The route verified in the local backend is `GET /api/admin/permissions/my-permissions`, not `/api/permissions/my-permissions`. Its response includes `adminId`, `isSuperAdmin`, `permissionCodes` and `modulePermissions`. The frontend validates the fields it uses and checks that `adminId` matches the authenticated account.

All requests use the existing API client, including cookies, cancellation, timeouts and session-expiry handling. Permission data stays in memory. A failed permission request shows a retry action and does not grant access.

Each module link requires its exact `.view` code. An `.edit` permission alone does not reveal it. A backend-provided super-admin flag grants navigation to all modules. Overview remains the account home for every authenticated admin.

Direct module URLs use the same check as the sidebar. This is a UI restriction, not a security boundary: the backend must enforce authorization on every protected operation.

## Shared components

- `Table<T>` receives rows, columns, query state and callbacks. It handles pagination controls, sort indicators, search, custom cells and loading/empty/error states. Parents own requests; the table never fetches data itself.
- `Modal` uses native `dialog.showModal()` for modal focus behavior and an inert background. It supports Escape, an outside click and a close button, restores focus to the trigger and prevents body scrolling.
- `StatusBadge` maps known statuses to subdued semantic colors and keeps the status text visible. Unknown values use a neutral style.
- `LoadingState`, `EmptyState` and `ErrorState` share presentation and retry behavior across routes and tables.

Overview's permission table uses real permission codes to exercise these components. That endpoint returns the complete list, so search, sorting and pagination are local for this table only. Future business lists should use their backend's actual pagination/filter contract.

## Verification

- `npm test`: 32 tests passed across auth, API errors, permission guards and shared components.
- `npm run build`: TypeScript and production build passed.
- Local backend responses checked for admin, operator and fleet accounts.
- Operator browser session showed only Dashboard, Rentals, Customers and Support alongside Overview. Opening permission details and closing with Escape restored focus to the triggering row button.
- Automated tests cover fleet/operator menu differences, direct-route denial, retry, mismatched account data, pagination, sorting, search, empty/loading/error states, modal closing and badge tones.

## Review questions

1. Why do we check a direct URL even when its sidebar link is hidden?
2. Why is an `.edit` code not treated as a `.view` code?
3. What appears when permission loading fails or the session expires?
4. Why does this permission table filter locally while future business lists may not?
5. Which accessibility behaviors come from native `dialog`, and which do we implement?

## Git handoff

Work is on `feature/day-03`, created from the updated `main`. Keep this task's commit separate from the Day 4 dashboard draft. Push the feature branch and open a PR only when requested, then merge after review. Do not backdate commits or push application changes directly to `main`.
