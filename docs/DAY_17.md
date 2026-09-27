# Day 17 — Tariffs, subscriptions and insurance

## Scope

`/tariffs` has seven sections, with local search, sorting, pagination and independent loading/empty/error/retry states. Clicking a row or its ID opens all returned fields, including nested template tariffs and country records. Amounts use the record currency, dates use Dubai time and missing values display a dash.

Packages, plans and templates have create/edit forms and confirmed deletion. Controls use `tariffs.create`, `tariffs.edit` and `tariffs.delete`; the route uses `tariffs.view`. Successful writes reload the list from the API. Duplicate submissions are locked. A network/server failure preserves the form and disables resubmission until it is closed; check the refreshed list before retrying an uncertain request.

Insurance, subscription plans/bookings and distance allowances are read-only. Booking status filters cover Pending, Active, Assigned, Completed and Cancelled.

## Backend differences from Section 8.11

- Package creation is **POST `/api/admin/tariff-package`**, singular. POST `/tariff-packages` returns 404. Listing, update and deletion use the plural path.
- Packages contain `unitCount`, `timeUnit`, `price`, `currency`, `isActive` and countries, not a package name. Duration is shown without inventing one. Creation uses the backend's default country; edits preserve countries.
- Plans contain name, description and active state, not package references or prices. The form only sends these supported fields.
- Template CRUD edits name, description and active state. Existing nested tariffs remain untouched and visible in details. New templates have an empty tariffs array. Applying templates and nested tariff editing are not part of this day's UI.
- **Distance CRUD is blocked:** GET `/tariff-distances` works, but POST, PUT and DELETE return 404. No nonfunctional mutation controls are shown. Backend changes are required before this handbook item can be marked complete.
- Most list endpoints return plain arrays and ignore pagination/search parameters. Subscription bookings return `{ data, total, page, pageSize }`. The frontend retrieves all booking pages before local filtering, rejects incomplete/duplicate/changing-total snapshots, and cancels reads on section changes.
- Insurance uses `dailyPrice` and `deductible`. Subscription plans use model, monthly price, included km and minimum months. Bookings expose customer/model, months, monthly price, status and dates. These actual fields replace guessed plan labels or totals.
- The mock delete handlers currently do not enforce linked-record conflicts. The UI handles HTTP 409, tested with a mocked response; the isolated real backend verifies successful deletion and 404, not an invented 409 guarantee.
- No backend files were changed. Insurance/subscription write endpoints, where present, are intentionally not used.

## Verification

Read-only curl checks against localhost:4000 inspected all seven live response shapes before implementation. CRUD checks run only in an isolated in-memory instance (`PERSIST=false`, `SIM_TICK_MS=0`):

```bash
node scripts/verify-day17.mjs ../drigo.dev.node
npm test
npm run build
```

The script checks seven lists, booking pagination, package/plan/template create/update/delete, singular package creation, authentication 401, missing records 404 and all three missing distance mutation routes. No live training records are created, edited or deleted by the script.

Component/API tests cover endpoint selection, payload validation, read-only resources, duplicate/changing snapshots, row details, create refresh, delete confirmation/409 and permission-based controls.

## Review and delivery

### Presentation pass

- Shared table action columns now use their content width and align to the right. This applies consistently to modules using an `actions` column.
- Shared toolbar controls use 40px heights, 20px label lines and a 6px label gap. Browser measurements confirmed identical top/bottom positions for tariff search/status/sort/order and Support search/status controls. Status badges remain on one line.
- Primary buttons in the admin content and dialogs size to their label; authentication buttons retain their full-width layout. Package Refresh/Add controls remain on one row.
- Support conversation bubbles distinguish Customer, Team and Auto messages. Saved replies and suggestions use separate cards with category/confidence labels and draft insertion controls. No messages are sent when selecting a template.
- Template panels have bounded scrolling. At a 390px viewport the chat/context stack into one column without page overflow. The tariff table and template cards were visually inspected in the local browser.
- Production build and the targeted shared-table, Support and tariff tests passed (27 tests). The isolated Day 17 backend script passed before this presentation-only pass.
- Full regression suite: 25 test files, 218 tests passed. Final toolbar alignment was additionally verified by browser geometry measurements.

Branch: `feature/day-17`, based on `feature/day-16` so unmerged Support work and merged Day 15 remain present. Do not replace the branch with an older main and lose those modules. Once Day 16 is merged, compare Day 17 against updated main before opening its PR.

Publishing, screenshot attachment and PR review are separate pending steps. The distance CRUD backend gap remains open; this is not a claim that every handbook item is complete.

Next planned work: Day 18 Promotions. Do not implement it as part of this change.
