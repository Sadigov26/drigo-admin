# Verification scripts

Optional developer integration checks for business state transitions. The handbook does not mandate these script files; they help verify the actual API contracts.

Each script starts the separate backend in-memory with `PERSIST=false` and `SIM_TICK_MS=0`, using a free loopback port. It does not connect to the running server on port 4000 or write its persisted database. The test server closes when the script finishes, including after an assertion failure.

## Usage

Install the backend dependencies first. Run these commands from the frontend directory using Node 24:

```bash
node scripts/verify-day10.mjs ../drigo.dev.node
node scripts/verify-day11.mjs ../drigo.dev.node
node scripts/verify-day12.mjs ../drigo.dev.node
node scripts/verify-day13.mjs ../drigo.dev.node
node scripts/verify-day14.mjs ../drigo.dev.node
node scripts/verify-day15.mjs ../drigo.dev.node
```

The argument identifies the local backend repository. The scripts execute that repository's code, so use only the trusted internship backend. A failed assertion returns a nonzero exit code.

## Coverage

### Day 10 — Rental actions

- Reject requests without a session (401).
- Switch car and check both old and new vehicle allocation.
- Add compensation distance and a km package; check the package payment.
- Change rental status using the backend's GET contract.
- End a rental, check Completed and a freed car, then verify a second end returns 409.

### Day 11 — Customer lifecycle

- Reject requests without a session (401).
- Approve and check document/face verification and list filters.
- Reject and check document Rejected / face Pending states.
- Block/unblock and check the blocked filter.
- Soft-delete and check removal from the list; restore and check reappearance.

### Day 12 — Customer tabs and debt payment

- Check payments, login-history and reservations pagination contracts.
- Check devices, bonus history, revenue and debt response shapes.
- Pay outstanding debts, check paidCount, paid flags and zero outstanding total.
- Check another customer's debts remain unchanged.
- Repeat pay-all and check it reports zero newly paid records.

### Day 13 — Debt management

Day 13 additionally checks manual debt creation, exact splitting, selected/single/all payment, permanent deletion and 404, paid filters, removal from the debtor list, CSV headers/content and isolation of another account. Run `verify-day13.mjs` with the same backend argument as above.

### Day 14 — Fines and accidents

Day 14 checks fine billing creates one unpaid debt, company billing/dismissal do not, scraper/review/sync and per-car totals, accident CRUD/status and 401/404. Run `verify-day14.mjs` with the same backend argument. It mutates only an isolated in-memory instance.

### Day 15 — Reservations and delivery

Day 15 (`verify-day15.mjs`) checks reservation status filters, assign-driver/Busy/map transitions, cancel/Online/409 and driver/zone CRUD with 401/404. Reservation fixtures are inserted only in the script's disposable in-memory database, never the running database.

### Day 16 - Support

`node scripts/verify-day16.mjs ../drigo.dev.node` verifies reply persistence and Open-to-Pending/unread transitions, status filters, operator assignment, mute/unmute, context, templates, suggestions and 401/400/404 responses. It creates a ticket only in its disposable in-memory backend, never in the running database.

### Day 17 — Tariffs and subscriptions

`node scripts/verify-day17.mjs ../drigo.dev.node` verifies seven lists, booking pagination, package/plan/template CRUD, singular package creation, 401/404 and missing distance mutation routes. Writes are limited to its disposable in-memory backend. HTTP 409 presentation is covered by frontend tests because these mock delete handlers do not enforce linked-record conflicts.

### Day 18 — Promotions and engagement

`node scripts/verify-day18.mjs ../drigo.dev.node` checks four list/detail/create/update/delete flows, explicit availability/status updates, discount/story analytics, referral settings persistence and 401/404 responses. It starts its own ephemeral backend with persistence and simulation disabled. No running development records are changed. Delete-conflict UI is tested with a mocked 409 because the provided backend does not enforce this constraint.

### Day 19 — Analytics and monthly reports

Day 19: `node scripts/verify-day19.mjs ../drigo.dev.node` verifies analytics response shapes, six monthly reports and matching drill-downs, totals/net arithmetic, statistics, the hyphenated financials endpoint, Salik/ENOC pagination and 401/404. It is read-only against an isolated frozen backend.

### Day 20 — Fleet, Geo and Notifications

`node scripts/verify-day20.mjs ../drigo.dev.node` checks fleet reads, geo CRUD, audience previews, mock broadcast/history/feed, campaign CRUD, schedules, pagination and 401/404 in an isolated backend (`PERSIST=false`, `SIM_TICK_MS=0`). It does not change running development data or send real notifications.

### Day 21 — Operations, settings and security

`node scripts/verify-day21.mjs ../drigo.dev.node` checks cleaning cancellation/statistics, operational lists and inquiry status, scraper trigger, monitoring, fee updates, IP/CIDR and country add/remove, SMS configuration, safe administrator fields and permission replacement. It also checks missing handbook-style routes. All mutations run in the disposable backend, not the running development database. No real security policy or administrator grant is changed. Frontend tests separately cover confirmations, validation, 409, uncertain results, permissions and cross-module offline handling.

The Day 21 script also checks payment retry success/failure and read-back, wrong-owner rejection, unchanged debts/rental status, problem-report status updates, parking sync acknowledgement, and previous car journeys/route points. Retry outcomes are deterministic only inside this disposable test backend.

## Mock credential usage


`admin` / `admin123` and OTP `123456` are the backend's documented training credentials. The tests use them to establish a real mock session; they do not implement login or seed business data in the frontend. These scripts are not imported by the application or included in its browser bundle. Never replace these values with production credentials.

Unit/component tests still run separately with `npm test`. The scripts do not replace UI, accessibility or permission checks.
