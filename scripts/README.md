# Verification scripts

Optional developer integration checks for business state transitions. The handbook does not mandate these script files; they help verify the actual API contracts.

Each script starts the separate backend in-memory with `PERSIST=false` and `SIM_TICK_MS=0`, using a free loopback port. It does not connect to the running server on port 4000 or write its persisted database. The test server closes when the script finishes, including after an assertion failure.

## Usage

Install the backend dependencies first. Run these commands from the frontend directory using Node 24:

```bash
node scripts/verify-day10.mjs ../drigo.dev.node
node scripts/verify-day11.mjs ../drigo.dev.node
node scripts/verify-day12.mjs ../drigo.dev.node
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

## Why mock credentials appear here

`admin` / `admin123` and OTP `123456` are the backend's documented training credentials. The tests use them to establish a real mock session; they do not implement login or seed business data in the frontend. These scripts are not imported by the application or included in its browser bundle. Never replace these values with production credentials.

Unit/component tests still run separately with `npm test`. The scripts do not replace UI, accessibility or permission checks.
