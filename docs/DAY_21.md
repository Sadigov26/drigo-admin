# Day 21 — Operations, Settings & Security and polish

## Scope and publication

Implements the requested Section 8.16/8.17 scope, including additions documented in [DAY_21_REVIEW.md](DAY_21_REVIEW.md). Published through PR #21 and merged to main on 2 October 2026. The final handoff audit confirms 21 distinct author dates through that delivery; no commit dates were altered. See [FINAL_HANDOFF.md](FINAL_HANDOFF.md) for current checks and packaging.

## Operations

- Cleanings: searchable/sortable/paginated records, status filter, statistics and confirmed cancellation. Only Scheduled/InProgress rows offer cancellation. Re-read the cleaning before mutation, then reload both list and statistics.
- Car reports and services: read-only lists, status filtering and full record details, as explicitly requested. The handbook's broader GET/PUT wording is not treated as permission to add unrequested editing.
- Business inquiries: list/detail and confirmed status changes (New, Contacted, Qualified, Closed, Rejected).
- Employees, connected devices and exit surveys: read-only records with detail views, null guards and request states.
- Scraper: source status and manually confirmed trigger. No trigger on page load, refresh or prefetch.
- Monitoring: overview, database, Redis, Docker and Teltonika panels. Known health states have status colors; raw returned values remain available, including expandable arrays.

## Real API contracts and handbook differences

Read the backend route definitions and checked authenticated GET responses with curl before implementation. The separate backend was not modified.

| Feature | Actual contract |
| --- | --- |
| Cleanings | GET `/cleanings`, `/cleanings/stats`, `/:id`; PUT `/:id/cancel` |
| Operational records | GET `/car-reports`, `/car-services`, `/businessinquiries`, `/employees`, `/cars/connected-devices`, `/exit-surveys` |
| Inquiry update | PUT `/businessinquiries/:id/status` with `{ status }` |
| Scraper | GET `/scraper/status`; **GET `/scraper/trigger/:source`** mutates mock history; POST `/scraper/trigger` is unavailable |
| Monitoring | GET `/monitoring/overview`, `/database`, `/redis`, `/docker`, `/teltonika`; `/monitoring/api` is unavailable, API status is in overview |
| Trip fee | GET/PUT `/trip-fee`: `amount`, `isActive`; preserve currency |
| Excess distance | GET/PUT `/excess-km-charge`: `pricePerKm`, `isActive` |
| Fee records | GET `/service-fees`, `/penalty-configs`; PUT `/:id` with editable fields only |
| IP list | GET `/security/blocked-ips`; POST `/security/block-ip` with `{ entry, reason }`; DELETE `/security/block-ip/:entry` |
| Country list | GET `/security/blocked-country-codes`; POST `/security/block-country-code` with `{ countryCode, reason }`; DELETE `/security/block-country-code/:code` |
| SMS | GET/**POST** `/security/sms-country-mode` with `{ mode, countries }`, not a boolean toggle |
| Administrators | GET `/auth`, `/permissions`, `/permissions/admins/:id`; PUT `/permissions/admins/:id` with `{ permissionCodes }` |

Paths above are relative to `/api/admin`. The supplied `/security/blocked-countries` and `/security/sms-mode` routes return 404. Lists may be arrays or paginated envelopes; the existing validated snapshot loader collects pages for local search/sort/pagination and rejects inconsistent snapshots instead of silently displaying incomplete data.

## Settings and security safeguards

Forms allowlist editable fields, validate non-negative amounts with two decimal places, percentage limits, IPv4/IPv6/CIDR and two-letter country codes. Path segments are encoded, including CIDR slashes. SMS country codes are normalized/deduplicated. The mock accepts a mode label rather than publishing a constrained boolean enum, so the UI preserves that contract.

Mutations require review and confirmation. Buttons lock during requests; errors retain input; uncertain network/server results disable immediate repeat submission and ask for refresh. Successful actions re-fetch backend values. HTTP 409 is displayed rather than assumed to be success. Preflight GETs do not make a later mutation atomic.

Operations uses `fleet.view`/`fleet.edit` because the permission catalogue has no operations namespace. Settings uses `settings.view`, with edit/create/delete grants on the corresponding controls. Admin management uses `admins.view`; permission editing additionally requires a super-admin session and `admins.edit`. Own-account edits and super-admin targets are protected. The editor previews granted and revoked codes, validates the fresh catalogue/target before replacement and refreshes permission state afterwards.

These are frontend safeguards, not server authorization. The mock stores block entries but does not enforce an actual firewall or SMS policy. Monitoring values are simulated and must not be interpreted as production health probes. Scraper status timestamps are simulated; trigger creates a mock run, not a real external scrape. Production enforcement requires backend work outside this task.

## Verification

- Initial implementation: build passed and 293 tests passed across 34 files. Updated results after the ZIP review are recorded in [DAY_21_REVIEW.md](DAY_21_REVIEW.md).
- Authenticated read-only curl checks against port 4000 established real shapes and missing routes. No business/security records were mutated in the running development backend.
- `node scripts/verify-day21.mjs ../drigo.dev.node`: passed. Starts a disposable backend with `PERSIST=false`, `SIM_TICK_MS=0` on a free loopback port and closes it afterwards. Checks cleaning cancel/stats, operational reads, inquiry updates, scraper trigger, monitoring, fees, IP/country add/remove, SMS settings and permission replacement.
- Frontend tests cover review-before-submit, double-submit prevention, cleaning list/stats refresh, permission change previews, input validation, read-only access, 409, uncertain results and loading/error/empty states.
- Cross-module offline tests cover 19 screens. The shared client test checks expired-session events across protected endpoints; existing auth/guard tests cover redirect behavior. This uses mocked failures rather than stopping the user's running backend.
- At a 390px browser viewport, all 19 navigation pages were checked for document-level horizontal overflow: none observed. Wide tables retain internal scrolling. Admin permission and trip-fee dialogs were visually inspected at mobile width and cancelled without saving. Temporary viewport override was reset. No browser console errors were returned for this check.
- A full-suite run exposed a timing assumption in the existing Support test: its refresh assertion ran before the effect. It now waits for the second messages request instead of weakening the expected count.
- README updated; daily notes DAY_01 through DAY_21 are present.

This is a scoped regression check, not an assertion that every possible record, breakpoint or backend failure has been manually exercised. Tariff-distance mutations remain unavailable in the supplied backend. Payment retry is implemented and PR #21 is merged; see the final review and handoff notes for updated verification.

## Review questions

### Admin-facing presentation follow-up

Removed endpoint/source-path captions and implementation explanations from rendered Operations, Settings, Fleet, Notifications and Analytics views. Contract and mock limitations remain in documentation. Admin-facing instructions retain meaningful safeguards without development terminology. Nested records now have distinct bordered cards, headings and reference badges; connectivity uses Online/Offline status colors. Shared record media displays image previews with enlargement and unavailable-image fallback rather than raw URL text. Other links use descriptive attachment text and reject unsafe protocols. Permission protections are unchanged. No backend changes or publication were made.

Follow-up verification: full run had 293 passing tests and two presentation-test failures. Preserved the existing named-photo enlargement behavior and made the new Online assertion target the badge rather than matching field labels. Both affected files then passed (5/5 tests). Typecheck passed; the monitoring page was inspected in-browser. The earlier 293/293 result above refers to the pre-follow-up baseline, not a fresh full-suite run after these corrections.

1. Why refresh after writes? The backend owns the result, and derived statistics/list membership can also change.
2. Why confirm a GET scraper trigger? This backend uses a mutating GET; HTTP method alone does not make it safe to prefetch.
3. Why not show a boolean SMS switch? The actual API stores a mode label and country array, not an enabled flag.
4. Why are frontend permission gates insufficient? A caller can bypass the UI; the backend must authorize every mutation.
5. Why preserve unknown detail fields? Backend records contain more than the compact table columns; detail views keep returned information accessible without inventing missing values.
