# Day 6 - Cars list, detail and CRUD

## Scope and handbook

Handbook Sections 5, 6 and 8.3 cover listing, detail, create/update/delete, null guards, confirmation, errors and refreshing after mutations. Day 6 is our work breakdown, not a numbered day in the PDF. Tracking, commands, problematic cars and active-status transitions are still separate Cars work; the whole module is not finished yet.

This branch was created from updated main at `a18838e` after Day 4 merged. Day 5 remains separate and was an open PR when this work started. No Day 5 files were copied into this branch. Reconcile with updated main before the Day 6 PR. Do not push directly to main.

## Actual API contracts

- `GET /api/admin/cars?page=&pageSize=&search=&sortBy=&sortOrder=` returns `{ data, total, page, pageSize }`. List search and sorting use the server. Search covers brand/model/plate/color/IMEI, not city.
- The mock ignores `status`. With a status selected, the client reads every matching server page (200 records per request), filters, then paginates. It never filters only the current page. A safety limit reports an error instead of showing a silently truncated result. This is a mock-backend workaround, not a scalable production filter.
- Status is derived: an active rental takes precedence as Rented; otherwise enabled is Active and disabled is Inactive. Active here means enabled and not rented.
- List records omit current city. The visible ten rows load their city from `GET /cars/:id`; an individual city failure does not hide the list. End-trip cities are not current location.
- Detail returns merged car response/detail fields, but omits `activeRentalId`. That field is shown from the list snapshot and labeled accordingly. All other fields remain available, including nested features, location, tariff, parking/gas and identifiers, with additional fields in an expandable section. Nulls show Not provided; zero and false remain meaningful.
- `POST /cars` and `PUT /cars/:id` accept lookup IDs. Brand/model/color/fuel/city choices are loaded from real lookup endpoints. Changing brand clears model/color. No new lookup records are created by the form.
- Update ignores city and active status, so the edit form does not pretend to save them. Create supports city. The mock replaces zero engine capacity with 2.0 on create; the form explains this rather than silently sending a value the server changes. Zero capacity is supported on edit.
- Updates send only changed fields, avoiding accidental overwrites of live distance values. Create/update responses are not full details, so the list is re-fetched and reopening detail performs another GET.
- Delete calls `DELETE /cars/:id` only after explicit confirmation. A 409 keeps the dialog open with the server message. Network failures never trigger automatic mutation retries.

## Safety and UI

All requests use the existing cookie API wrapper. The Cars route requires `cars.view`; mutation controls and handlers check `cars.create`, `cars.edit`, or `cars.delete`. The supplied mock routes only enforce authentication, so frontend permissions are not production authorization. A real deployment needs server-side enforcement.

Read requests are aborted on query change/unmount and stale responses are ignored. Mutation buttons are locked during submission. Names and nested detail values render as React text, not HTML; image/map URLs are displayed as data and not executed. Form numeric values are validated before sending.

The shared Table, Modal, StatusBadge and state components are reused. Tables scroll inside their own container; mobile forms use one column. No map, remote command or fabricated business action is included.

## Verification

- Authenticated curl checked the list and car 1 detail; a status query confirmed that the backend ignores that parameter. Temporary curl cookies were removed after logout.
- Verification on 17 September 2026: 59 tests (including 13 Cars tests) passed after detail/toolbar polish. TypeScript and production build passed. `git diff --check` passed.
- Cars tests cover response validation, nulls/zero, cookies/query parameters, multi-page filtering, CRUD methods, 401, safe detail rendering, view-only permissions, delete confirmation/409, delete refresh, list retry/empty results and dependent form choices.
- Browser checks: real list/detail, lookup-backed creation, edit followed by reopened detail showing the saved maximum speed, deletion and refreshed list; inactive filtering and search-empty state; desktop and 390px mobile layout with no page/dialog horizontal overflow. Browser console checks returned no warnings or errors.
- Temporary car `DAY6-QA-0916` was created for QA, updated from 180 to 190 km/h and deleted through the confirm dialog. Existing cars were not edited or deleted by these checks. The backend simulator continued running independently.

## UI polish

The summary groups vehicle identity, status and pricing; fuel is rounded to a whole percentage, speed and price include units, and absent values use a dash. Features show names only; location has its own section. Technical fields remain expandable. Search, status and sort controls share a toolbar. Desktop content uses available width instead of a fixed 1200px main container. Backend workaround explanations remain in this document rather than the operational UI.

## Before calling the module complete

1. Read and explain the request lifecycle, changed-field updates and filter workaround.
2. Complete the separately planned tracking/status/command work.
3. Review the final diff against current main, commit, open the PR with a screenshot, obtain review and merge. Local implementation alone does not satisfy the handbook's PR requirement.
