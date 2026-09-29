# Day 18 — Promotions, discounts, promo codes, stories and referrals

## Scope and source of truth

Handbook Section 8.12 requests list/CRUD/status/analytics across the marketing resources. Implementation follows the supplied backend routes and actual responses, not guessed field names. The backend repository is unchanged. Earlier modules, including Reservations, Delivery, Support and Tariffs, remain routed.

Five sections are available at `/promotions`. Lists support search, status filtering, sorting and pagination, with independent loading/empty/error states. Rows open complete details; action buttons are separate, right-aligned controls. Forms use shared dialogs and aligned controls. Images have previews and in-app enlargement; story videos have controls and a source link.

## Real response inspection

Authenticated GETs were checked with curl against the running localhost:4000 backend before implementation:

```bash
curl -b cookies.txt 'http://localhost:4000/api/admin/promotions?page=1&pageSize=20'
curl -b cookies.txt 'http://localhost:4000/api/admin/discounts?page=1&pageSize=20'
curl -b cookies.txt 'http://localhost:4000/api/admin/promo-codes?page=1&pageSize=20'
curl -b cookies.txt 'http://localhost:4000/api/admin/stories'
curl -b cookies.txt 'http://localhost:4000/api/admin/referrals/settings'
```

Promotions, discounts and promo codes return `{data,total,page,pageSize}`; stories return an array; referral settings return an object. List queries are inconsistent: discounts implement backend search/status/sort while the other lists largely ignore those parameters. This UI loads the complete paginated snapshot before local filtering/sorting and ten-row pagination, rejecting duplicate IDs, changing totals and incomplete snapshots. This is suitable for the small mock catalog, not a scalable substitute for server-side search in production.

## Contracts and backend differences

| Resource | Editable fields and supported behavior |
| --- | --- |
| Promotions | `title`, `description`, `imageUrl`, `actionType` (None/OpenCar/OpenTariff/OpenUrl), `frequency` (Once/Daily/Always), `isActive`, `startDate`, `endDate`. GET detail and POST/PUT/DELETE; PATCH `/:id/status` with explicit `{isActive}`. |
| Discounts | `name`, `type` (Percentage/FixedAmount/FixedPrice), `value`, `status`, `targetAudience`, `scope`, nullable `usageLimit`, `startDate`, `endDate`. GET detail and POST/PUT/DELETE; PATCH `/:id/status` with `{status}`. Usage counters remain read-only. |
| Promo codes | `code`, `discountType` (Percentage/FixedAmount), `value`, nullable `maxRedemptions`, `isActive`, nullable `expiresAt`. GET detail and POST/PUT/DELETE. PUT with explicit `isActive` is used instead of the blind PATCH toggle endpoint. `redemptionCount` remains read-only. |
| Stories | `title`, `status` (Active/Draft/Archived), `targetAudience` (All/Verified), `items[]` with stable item IDs, Image/Video media, HTTP(S) URL and duration in seconds. GET detail and POST/PUT/DELETE; PATCH `/:id/status`. Existing item metadata/counters are preserved while editing; new counters come from backend defaults. |
| Referrals | GET/PUT `/referrals/settings`: `referrerBonus`, `refereeBonus`, `currency`, `minRentalsToQualify`, `isActive`. `updatedAt` is displayed but never sent as an editable field. |

- **Promotions do not expose a discount amount or a status string.** No fake amount is shown. Display status derives from `isActive` and dates: disabled → Paused, ended → Expired, future start → Scheduled, otherwise Active. Enabling does not change dates. A 30-second display timer is cleaned up on unmount; this is not server polling.
- Discounts use the backend's actual Active/Scheduled/Expired/Paused value rather than overriding it based on dates. Stories use their distinct Draft/Active/Archived lifecycle.
- Form date inputs explicitly use **UTC**. List/detail dates display **Dubai time**. Payloads use ISO timestamps; empty optional dates stay null.
- Analytics are available at `/discounts/:id/analytics` and `/stories/:id/analytics`, shown in details with separate loading/error/retry controls. No equivalent promotion/promo-code analytics route exists. Discount aggregates and story completion percentages are mock/synthetic; they are not audited business metrics. Some seeded Video items point to image URLs and cannot play as real video.
- Discount scope/audience strings are supported. Related-user/car/brand/package association endpoints in this mock are success stubs; no persisted association editor is claimed here.
- All four delete routes delete without linked-record checks. The frontend handles a future 409 and shows its message, but does **not** claim the current backend enforces conflicts.

## Mutation and safety behavior

Create/edit → validated POST/PUT → close form → re-fetch list/settings from backend. Delete requires confirmation. Availability changes require confirmation and a fresh detail read; stale status is rejected before the write. This preflight is not atomic and does not replace backend concurrency control.

`promotions.create/edit/delete` gate relevant controls and are rechecked before submission. A synchronous lock prevents double submission. Pending actions disable cancellation and submission. Uncertain network/5xx outcomes retain the form, block resubmission and ask for close/refresh rather than retrying a potentially successful write. Requests used for views are aborted on unmount and late results are ignored. Safe media accepts HTTP(S) only; React escapes text fields.

Validation rejects blank required names, invalid dates, reversed ranges, negative amounts, more than two decimal places, non-integer usage limits, percentages above 100 and active stories without media. Zero discount values are rejected because the backend's `Number(value) || 10` would silently replace them; zero referral bonuses are supported. Details retain every returned field, including nulls and server counters.

## Verification

```bash
npm test -- --maxWorkers=1 --testTimeout=30000
npm run build
node scripts/verify-day18.mjs ../drigo.dev.node
```

- API/component tests cover snapshot integrity, cancellation propagation, derived statuses, field validation, safe URLs, metadata preservation, explicit status requests, stale status, create/update verbs, confirmation/conflict UI, double-submit protection, refresh, referral edits, permissions and list empty/error/retry states.
- Isolated integration script passed all four CRUD/detail flows, status changes, both analytics endpoints, referral updates and 401/404. It uses a disposable in-memory backend with `PERSIST=false`, `SIM_TICK_MS=0`, on a free loopback port. Live business records are not mutated.
- Full test suite: 234 tests passed across 27 files. Production build (including TypeScript) passed.
- Browser: real promotion/story lists, create form and complete story details/analytics loaded. Filters align, header actions share a row, and table actions are right-aligned. Table action buttons use identical 100×36px dimensions across all four marketing lists; longer action labels no longer shift the columns. No live mutations were used for browser verification.

## Review questions

1. Why refresh after saving? The server owns defaults, counters and timestamps. The refreshed list reflects actual persisted state rather than a guessed local patch.
2. Why explicit `isActive` instead of toggle? Repeated blind toggles can reverse an already-applied change. Explicit state is more predictable; uncertainty still requires refresh.
3. Why separate promotion and discount statuses? Their API contracts differ: one is date-derived availability, the other is an explicit backend enum.
4. Why not show a promotion discount amount? It does not exist in that response; the frontend must not invent business data.

## Branch and handoff

`feature/day-18` starts from Day 17, preserving all earlier modules. Day 17 PR #17 was confirmed merged before publishing Day 18. Screenshot attachment is a separate user review step. Next work is Day 19 Analytics & Monthly Report, not part of this change.
