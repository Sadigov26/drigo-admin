# Day 19 — Analytics & Monthly Report

## Scope

Implements handbook Section 8.14 and the monthly-report appendix: charts, monthly table and totals, monthly chart, month drill-down and all-time KPI cards. `/analytics` has Charts, Monthly report, Salik and ENOC sections. All operations are read-only. No backend files or business records were changed.

Recharts is reused from Dashboard, avoiding a new chart dependency. Charts include titles, exact endpoint sources, units, legends, accessible chart layers and expandable source-value tables. Zero is valid data, not an empty state. Invalid numeric chart values are errors rather than invented zeroes. Panels load independently and expose retry; aborted/unmounted requests cannot replace newer results.

## Real contracts and differences

Authenticated curl responses and backend route implementations were inspected before coding.

| Endpoint | Actual response / display |
| --- | --- |
| `/analytics/revenue-daily?days=30` | `{days, points:[{date,revenue}], currency}`; AED line chart |
| `/analytics/debt-daily?days=30` | `{days, points:[{date,added,collected}]}`; two lines, not outstanding balance |
| `/analytics/utilization-daily?days=30` | `{days, points:[{date,utilization}]}`; percentage line chart |
| `/analytics/customer-funnel` | `{steps:[{step,count}]}`; Registered, Verified, First rental, Repeat customer |
| `/analytics/demographics` | `{total,gender,age,platform}`; separate bar charts for supplied categories; **no city breakdown** |
| `/analytics/fleet-health` | `{total,conditions,openProblemReports,openAccidents}`; Good, Low fuel, Needs service, Offline plus full details |
| `/reports/monthly?months=6` | `{months:[nested report],totals}`; table, chart and backend totals |
| `/reports/monthly/:month` | One complete report object; `YYYY-MM` validated before requesting |
| `/reports/statistics` | All-time nested statistics; four top KPI cards plus all fields in an expandable section |
| `/dashboard/monthly-financials?months=6` | `{months,currency}`; five lines: revenue, Salik, ENOC, operating cost and net |
| `/salik/summary` | All-time totalTrips, totalAmount, billedAmount, unbilledAmount, currency |
| `/salik/trips` | Paginated trip records with plate, gate, amount, billed flag and dates |
| `/enoc/summary` | All-time transaction count, totalLiters, totalAmount, currency |
| `/enoc/transactions` | Paginated records with station, liters, pricePerLiter, amount and dates |

Important distinctions:

- The requested spelling `/dashboard/monthlyfinancials` returns **404**. The actual endpoint has a hyphen: `/dashboard/monthly-financials`.
- Fleet conditions overlap and must not be presented as a partition of total cars. Needs service counts open service records, not unique vehicles. Active/rented are available in statistics, not fleet-health categories.
- Salik **billed does not mean paid**. The UI uses Billed/Unbilled and does not invent payment state.
- Summaries contain no per-gate/per-station arrays. Breakdown is calculated from the complete transaction snapshot, never just the visible page. Pagination totals, duplicates and premature empty pages are checked; changing snapshots show retry errors. This small mock supports complete-snapshot search/sort and client pagination; a large production dataset needs server aggregation and filters.
- ENOC summary rounds liters and amount to integers; transaction aggregates retain two decimals. Differences are not silently altered.
- Daily debt means additions and collections. Utilization is the backend's rental-count approximation capped at 100%, not measured per-car hours. Funnel stages are returned as-is; repeat and verified counts may not form a strictly decreasing funnel because the backend uses different populations/flags.
- Operating cost = Salik + ENOC. Net = total revenue minus operating cost. Billed fines and collected debt are separate report fields, not added again to revenue. The report total block is shown verbatim; it does not include every count column.
- Backend month generation uses local month starts converted to UTC month labels. On a non-UTC server this can label the preceding month; the report and financials series can therefore disagree for identically named months. The UI preserves the returned labels, keeps sources separate and warns about this limitation. Fixing backend timezone semantics is outside this frontend task.
- Date-only chart labels are preserved. Trip/transaction timestamps use Dubai time. Monetary values use AED; volume is in liters. Read-only details retain every returned transaction/report field, including nulls.

## UI and verification

- Daily period: 7/30/90/180 days. Monthly period: 3/6/12/24, default 6.
- Month links fetch `/reports/monthly/:month` into a detail dialog, not a copy of the table row.
- Each remote panel has loading/error/retry; empty chart/list states are distinct. Statistics and monthly financials remain independent of report failures.
- Salik/ENOC tables have search, sortable headers, ten-row pagination and complete row details. Aggregation always includes all loaded records, independent of search/page.
- Layout uses responsive chart cards, contained horizontal table scrolling and readable detail grids.

```bash
npm test -- --maxWorkers=1 --testTimeout=30000
npm run build
node scripts/verify-day19.mjs ../drigo.dev.node
```

Full suite: 244 tests passed across 29 files. Ten Day 19 unit/component tests cover invalid chart values, totals, month validation, complete snapshot/abort propagation, duplicate/change guards, station grouping, chart empty states/period controls, drill-down, retry and transaction pagination/details. Production build passed.

The isolated backend check passed six analytics resources, all six monthly drill-downs, report totals/net arithmetic, statistics, financials, Salik/ENOC pagination and 401/404. It uses `PERSIST=false`, `SIM_TICK_MS=0` on an ephemeral port and never mutates the running database. Browser inspection confirms charts render with real API data; see PR for final review.

## Review explanation

MonthlyReport intentionally has three separate responsibilities: `/reports/statistics` supplies all-time KPIs, `/reports/monthly` supplies period rows/totals and the report chart, and clicking a month requests `/reports/monthly/:month` for complete details. `/dashboard/monthly-financials` is an additional chart, not a replacement for the required report chart. A failure in one source must not hide the others.

## Branch

### September 30 follow-up review

Added real response-contract guards: reject duplicate/invalid month labels, reject a drill-down response for a different month, validate drill-down financial values before rendering, and reject invalid report periods before requesting. Regression tests retain valid zero and negative net revenue values. This is a new follow-up commit; original commits and PR publication dates are not rewritten. Day 18 has merged and PR #19 now targets main.

Focused analytics suite: 14 tests passed (including four new regression tests).

`feature/day-19` is based on Day 18, preserving all implemented modules. Day 18 PR #18 was open during initial implementation and has since merged. PR #19 targets main and still requires review. Day 20 Fleet & Geo + Notifications is not implemented here.
