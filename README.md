# DRIGO Admin

Internship frontend built with React, TypeScript and Vite, connected to the separate DRIGO mock backend. Business data and state transitions come from that API.

## Implemented scope through Day 21 (local work)

- Two-step authentication, cookie sessions, route guards and logout.
- Permissions-based navigation, shared tables, dialogs, icons and request states.
- Overview: health check and signed-in account permissions.
- Dashboard: KPIs, trends, fleet summary, online users and recent activity.
- Cars: list/filter/detail, create/edit/delete, tracking, GPS routes, vehicle commands and problematic cars.
- Brands/models and per-brand colors using supported backend endpoints.
- Rentals: list/filter/detail, payments, route, end rental, switch car, status changes, compensation distance and distance packages.
- Customers: list/filter/detail, inline documents and image enlargement, approve/reject, block/unblock, delete/restore and UUID lookup.
- Customer tabs: payments, debt, bonus, devices, login history, revenue and reservations. Pay all requires confirmation and refreshes server data.
- Debts: debtor/all-debt lists, payment status filter, customer-scoped pay all/selected/single, equal split, add/delete and CSV export. See [Day 13 notes](docs/DAY_13.md) for mock limitations and branch dependency.
- Fines & Accidents: fine/review/scraper lists, sync status, customer/company billing, dismissal, per-car records and accident CRUD. See [Day 14 notes](docs/DAY_14.md) for backend differences and verification.
- Reservations & Delivery: reservation pipeline, cancel/assign-driver, active delivery map, driver and zone CRUD. See [Day 15 notes](docs/DAY_15.md) for validation and mock limitations.

Other navigation entries do not mean every backend module is implemented. Daily notes record exact scope and limitations; PR review is a separate completion step.

Day 16 adds Support: ticket search/status/pagination, chat replies, customer context, assignment/mute/status controls, saved replies and backend suggestions. See [Day 16 notes](docs/DAY_16.md). Day 15 is included from merged main.

Day 17 adds package/plan/template CRUD and read-only insurance, distance allowances and subscription plans/bookings. Distance mutations are unavailable in the backend; see [Day 17 notes](docs/DAY_17.md) for this open requirement and the singular package-create endpoint.

Day 18 adds Promotions, Discounts, Promo codes and Stories CRUD, availability controls, media previews, discount/story analytics and editable referral rewards. See [Day 18 notes](docs/DAY_18.md) for actual fields, derived campaign statuses and mock analytics limitations.

Day 19 adds analytics charts, a monthly report table/chart/totals and drill-down, all-time statistics, monthly financials, and Salik/ENOC summaries with transaction lists. [Day 19 notes](docs/DAY_19.md) document backend timezone and metric limitations.

Day 20 adds Fleet plan/moves/utilization, Geo zone CRUD with a polygon map, parking/gas lists, and Notifications broadcast with audience preview/confirmation, campaigns, schedules and history/feed. [Day 20 notes](docs/DAY_20.md) explain mock dispatch limitations and the Settings-permission fallback.

Day 21 adds Operations (cleanings/cancel/stats, reports, inspections, scraper, monitoring, inquiries, employees, devices and surveys), editable fees, IP/country block lists, SMS country configuration and administrator permission review. [Day 21 notes](docs/DAY_21.md) document actual endpoints, security limitations and verification. This work is submitted through the Day 21 feature-branch PR; merge follows review.

Final Day 21 review also adds failed-payment retry in Customer/Rental payments, problem-report status updates, parking cards with confirmed sync, and previous car journeys with route maps. See [the review notes](docs/DAY_21_REVIEW.md) for verified contracts and remaining limitations.

## Local setup

1. Start the separate backend with `npm start` in `../drigo.dev.node`.
2. Copy `.env.example` to `.env`: `VITE_API_BASE_URL=http://localhost:4000`.
3. Run `npm install`, then `npm run dev` here. Development uses Node 24.
4. Open [localhost:5173](http://localhost:5173).

Provided training login: `admin` / `admin123`, OTP `123456`. These are mock credentials, not production secrets. Other accounts are documented by the backend. Use localhost consistently for browser sessions, not a mixture with 127.0.0.1.

VITE-prefixed values are public browser configuration: never put secrets there. `.env`, `dist/` and `node_modules/` are ignored by Git.

## Checks

```bash
npm run typecheck
npm run build
npm test -- --maxWorkers=1 --testTimeout=30000
```

Tests cover authentication, permissions, API errors, shared components and implemented modules. Browser checks complement mocks for layout, focus and cookies. `npm audit` is a separate dependency advisory check.

### Backend contract scripts

`scripts/verify-day10.mjs`, `verify-day11.mjs` and `verify-day12.mjs` are developer integration tests, not frontend application code or sample business records. They are not imported into the browser bundle or run by `npm run dev`.

```bash
node scripts/verify-day10.mjs ../drigo.dev.node
node scripts/verify-day11.mjs ../drigo.dev.node
node scripts/verify-day12.mjs ../drigo.dev.node
node scripts/verify-day13.mjs ../drigo.dev.node
node scripts/verify-day14.mjs ../drigo.dev.node
node scripts/verify-day15.mjs ../drigo.dev.node
node scripts/verify-day16.mjs ../drigo.dev.node
node scripts/verify-day17.mjs ../drigo.dev.node
node scripts/verify-day18.mjs ../drigo.dev.node
node scripts/verify-day19.mjs ../drigo.dev.node
node scripts/verify-day20.mjs ../drigo.dev.node
node scripts/verify-day21.mjs ../drigo.dev.node
```

Each starts a separate in-memory backend on a free loopback port with persistence and simulation disabled. They check rental actions, customer lifecycle and debt payment without changing the running backend database. Fixed login values authenticate against the provided mock account. Keep these checks in version control; never add production credentials.

See [scripts/README.md](scripts/README.md) for the assertions covered by each script. These checks are development additions, not filenames mandated by the handbook.

## Source structure

- `src/auth/`: forms, session and guards.
- `src/api/client.ts`: cookie requests, timeouts and HTTP errors.
- `src/permissions/`: account grants and module access.
- `src/components/`: reusable UI and icons.
- `src/dashboard/`, `src/cars/`, `src/catalog/`, `src/rentals/`, `src/customers/`: module implementation.
- `src/debts/`: debt lists, account actions and CSV download.
- `src/fines/`: fine review/billing, car fines and accident records.
- `src/delivery/`: reservations, active delivery map, drivers and zones.
- `src/support/`: tickets, conversations, customer context and response assistance.
- `src/tariffs/`: tariff forms, pricing lists, insurance and subscriptions.
- `src/promotions/`: campaigns, discounts, promo codes, story media, analytics and referral settings.
- `src/analytics/`: read-only charts, monthly reports, Salik and ENOC.
- `src/fleet/`: fleet and geo views, notifications and reusable record displays.
- `src/operations/`: operations, fees/security configuration and administrator permissions.
- `src/App.tsx`, `src/pages/`, `src/styles.css`: routes, overview and shared layout.
- `scripts/`: isolated backend contract checks.
- `docs/DAY_*.md`: daily scope, API findings and verification.

## Backend limitations

- The database contains more fields and modules than public API responses expose. The frontend never reads the database directly.
- Blocking sends `{ blocked: true, reason }`. The backend stores `blockReason`, but the customer detail mapper does not return it. Unblocking clears it. Displaying a persisted reason requires a backend API change.
- Bonus history is empty in this mock; some devices and login history are generated on each request. Document images can be generic placeholders.
- Pay all marks debt records paid; it does not retry rental payments or settle PaymentPending rentals. The preflight snapshot check cannot make separate GET/POST requests atomic.
- Payment retry updates the payment status/failure reason only in this mock; it does not settle debts or complete a PaymentPending rental. The UI confirms the attempt, reads back its result and blocks immediate resubmission after an uncertain result.
- Security lists and SMS configuration are stored by the mock, not enforced as a production firewall or SMS policy. Monitoring metrics are simulated. Frontend permission checks cannot replace backend authorization.

## Workflow and next work

Start from updated main on a feature branch. Make meaningful commits, push the feature branch, open a PR with a description and screenshot, then merge after review. Never push directly to main or modify the separate backend to hide an API mismatch.

Understand each committed change. Work on at least 21 different days; commit dates must reflect actual work. The original car-browser project remains separate.

Current work: Day 21 Operations, Settings & Security, payment retry and final presentation polish on `feature/day-21`. Publication through a feature-branch PR is authorized; review and merge remain separate steps. Daily notes DAY_01 through DAY_21 are present. See [final review notes](docs/DAY_21_REVIEW.md) for tested behavior, process checks and remaining backend limitations.
