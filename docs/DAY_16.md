# Day 16 - Support

## Scope

Handbook Section 8.10: ticket list/status filter, chat/reply, customer context, status/assignment/mute, templates and AI suggestions. Backend code is unchanged.

- Ticket list: full-snapshot search, all four status filters, sortable columns, pagination, unread badges, row-click detail and loading/empty/retry states.
- Chat: every message page is loaded, then sorted by createdAt and id. Customer messages appear left, operator messages right, bot messages are labelled separately. The conversation scrolls to the latest message after loading; Refresh is manual, with no background polling to interrupt reading.
- Reply: Enter sends; Shift+Enter creates a new line; IME composition does not submit. Empty or over-5,000-character drafts cannot send. The limit is a frontend usability safeguard, not a claimed backend constraint.
- A synchronous submit lock prevents double clicks. Successful mutations refresh detail, messages, context and the ticket list. Drafts clear only after an acknowledged reply. Uncertain failures preserve the draft and require reviewing a refreshed conversation before retry; no automatic POST retry.
- Context preserves returned customer, verification, active rental, outstanding debt, flags, recent payments, other tickets and manual fines. Empty/null data has an explicit fallback. Ticket metadata is available separately.
- Templates and suggestions append to the draft, never send automatically. Suggestions are explicitly labelled for operator review, especially claims that an issue is resolved.
- Actions require support.edit; the route requires support.view. Read-only access does not expose the composer or mutation controls. Backend authorization remains necessary; frontend controls are not a security boundary.
- Narrow screens stack chat and context. Message attachment previews reuse safe HTTP(S) image handling with in-page enlargement and load-error fallback.

## Verified API contracts and differences

Read backend routes/mappers and used curl on the running backend before implementation:

- GET /supports returns { data, total, page, pageSize }; status and sort are supported, search is not. Local search reads all pages with duplicate/count checks, capped at 10,000 rows. Larger or changing/incomplete snapshots show a retryable error; production-scale search requires backend support.
- GET /supports/:id/messages is paginated and not chronologically ordered in the seed. Never assume its first page is the complete conversation.
- POST /supports/:id/messages requires **{ message }**, not { text }. It appends an operator message, clears unreadCount and changes Open to Pending. It also assigns the signed-in admin if the ticket has no operator.
- Detail omits unreadCount; the opening badge comes from the list, and successful reply clears it. Merely opening a ticket does not silently mark it read. Manual list refresh retrieves current unread counts.
- PUT /:id/assign requires **{ operatorId }**, not driverId/adminId. GET /api/admin/auth is the real paginated admin directory. Unknown operator IDs silently fall back to the current admin in the mock, so the UI validates the chosen ID against fresh directory data before assigning.
- PUT /:id/mute sends explicit { isMuted }; it does not rely on the mock's implicit toggle.
- PUT /:id/status accepts { status }. The UI restricts it to Open/Pending/Resolved/Closed. The mock has no strict transition graph or optimistic concurrency control; another operator may change the record between requests.
- Templates return an array with title/body/category. AI suggestions return an array with text/confidence; the mock returns fixed suggestions, not live AI generation. Frontend does not fabricate them.
- Context is a read-only operational snapshot, not the entire database or full customer history. recentPayments and manualFines are limited to five by the backend.

## Reply flow to explain

Draft -> POST { message } -> backend appends message and applies ticket transitions -> frontend re-fetches messages/detail/context/list -> the acknowledged message appears using server data. Do not append a guessed local record or automatically resend after a timeout: the first request may already have been saved.

## Verification

- API/component tests cover pagination completeness, chronological ordering, payloads, operator validation, status/mute, draft insertion, Enter vs Shift+Enter, submit lock, uncertain failure, independent panel retry and read-only access.
- `node scripts/verify-day16.mjs ../drigo.dev.node` passed: 401, wrong text payload 400, reply append/Open-to-Pending/unread reset, four status filters, assign, mute/unmute, context, templates, suggestions and 404.
- That script uses its own in-memory backend on an ephemeral loopback port with PERSIST=false and SIM_TICK_MS=0. It creates a disposable ticket and never writes to the running database.
- Before integrating Day 15: 20 files, 194 tests passed; production build passed. Combined-branch verification is recorded below.
- After integrating main/Day 15: 23 test files, 208 tests passed. Reservations, Delivery and Support were opened successfully against the running backend; the Day 15 document and route implementations are present.
- Browser read-only verification: real ticket list and conversation, operator choices, customer context, desktop two-column layout and 390px stacked layout. No live ticket messages or mutations were submitted during verification. Temporary viewport override was reset.

## Git handoff

feature/day-16 initially started at 98deaa8 before Day 15 merged. Updated main (9463b91, PR #15) is now integrated. Reservations and Delivery routes are retained alongside Support, and docs/DAY_15.md is present. No Day 15 implementation was deleted; the temporary placeholder pages came from the earlier branch baseline.

Commit/push and PR with screenshot/review remain publishing steps. Next module: Day 17 Tariffs & Subscriptions.
