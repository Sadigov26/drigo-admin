# Day 15 — Reservations & Delivery

## Scope

Handbook Sections 8.6 and 5.6. Based on origin/main 98deaa8 after the Day 14 PR merge. Backend code is unchanged.

- Reservations: all nine pipeline statuses, full-snapshot search, sorting, pagination, row-click detail, loading/empty/error states and manual refresh.
- Complete returned detail fields, including nested customer, car, driver and address data. Null values render as a dash.
- Cancel with confirmation and optional reason. Only states accepted by the actual backend are offered (all known states except Completed, Cancelled and Expired).
- Assign an active Online driver with zero active deliveries to an unassigned Pending/Confirmed reservation. Confirmation, immediate preflight, submit lock and server refresh prevent ordinary stale/double-click mistakes.
- Active-deliveries Leaflet map with manual refresh and an accompanying searchable list. Blue markers use driver coordinates; amber markers explicitly represent delivery destinations when driver coordinates are absent. Missing coordinates are reported, never replaced with fabricated positions.
- Delivery navigation: drivers and zones each have searchable/sortable/paginated tables, detail, create/edit forms and permanent-delete confirmation. Buttons respect delivery.create/edit/delete; reservation actions respect reservations.edit.
- Errors retain context. An uncertain mutation requires refresh before another attempt. No automatic mutation retry.
- Detail formatting rounds fuel to whole percentages without changing backend values. Driver photo URLs render as image previews with an in-page viewer and a recoverable loading failure. Prices, speed and color swatches use readable units and formatting.

## Real API differences and limitations

- GET /reservations supports status/sort/pagination but not search. Delivery lists also lack search. The UI fetches complete pages (200 per page, maximum 10,000 records), checks totals and duplicates, then searches/filters locally. A changing/incomplete snapshot shows a retryable error rather than searching only the first page. Larger datasets need backend search.
- Reservation detail omits cancelReason even though cancel accepts and stores reason. The UI displays a returned cancelReason if available; otherwise it says the API did not return it. It does not pretend the reason was persisted by storing it only in browser state.
- Assign-driver only changes Pending/Confirmed to DriverAssigned. The mock otherwise accepts repeated, offline or terminal assignments and increments activeDeliveries each time. The frontend restricts these cases and checks current driver/reservation data before POST. This is not atomic; backend validation/idempotency is still needed against concurrent clients.
- New drivers always start Offline and active, regardless of submitted status. The create form only sends fullName, phoneNumber, email and zoneId. Edit can change availability; Busy is not offered as a manually invented state for an idle driver.
- Zones have name, centerLat, centerLng, radiusKm, isActive and driverIds, not city. No invented city field is displayed or submitted.
- Zone POST treats zero coordinates as missing and substitutes random values. The frontend rejects zero on create and documents this mock limitation; edit supports valid zero coordinates.
- There is no GET /deliveryZones/:id; detail refresh finds the zone in the complete list.
- The mock does not clean up relationships on driver/zone deletion. UI blocks deletion of drivers with active deliveries or zone membership, and zones still referenced by drivers. It does not silently modify related records. Zone membership management (/deliveryZones/:id/drivers) is beyond this day's requested CRUD and may be needed to detach seeded memberships.
- Driver zoneId and zone.driverIds can disagree in the mock. Both are treated as references for safe deletion; no fabricated reconciliation is performed.
- Active deliveries includes DriverAssigned/PickingUp/InDelivery, sometimes with no driver. Destination fallback is visibly distinguished from a driver location.
- Map base tiles use OpenStreetMap with attribution. Driver names/popups stay in the browser; tile requests reveal the viewed map area to the tile provider, as in the existing Cars module.

## State transition to explain

Choose driver -> refresh reservation and driver -> verify availability and active-delivery feed -> POST assign-driver with driverId -> backend sets reservation DriverAssigned, driver Busy and increments activeDeliveries -> reload reservation and list. Switching to Delivery or the map issues fresh reads, so no old driver/map cache is reused.

Cancel posts reason, marks Cancelled and reduces the driver's active count; if it reaches zero, the backend makes the driver Online. Refresh always uses the backend result rather than assuming these states locally.

## Verification

- Inspected backend route/mapping source and live curl responses for reservations, active deliveries, drivers and zones before implementation.
- `node scripts/verify-day15.mjs ../drigo.dev.node` passed against a disposable in-memory instance: 401, all pipeline filters, assignment -> Busy + map membership, cancellation -> Online + removal from map, repeated cancel 409, driver/zone CRUD and missing-record 404.
- The script inserts reservation fixtures only in its disposable instance because no reservation-create endpoint exists. It never connects to the running backend or persists its data.
- API tests cover full-page loading, stale assignments, driver availability, form validation, explicit payloads and linked-record deletion guards.
- UI tests cover row opening, confirmation/double-submit, refresh, read-only permissions and retry/empty states.
- Shared detail tests cover fuel rounding, null values, safe image previews, image failure and preserving nested fields.
- Final full test run: 21 test files, 198 tests passed (`npm test -- --maxWorkers=2`).
- Production build passed. Browser checks confirmed the active-delivery map, driver photo preview and in-page image viewer using live read-only data. Mutating contract checks run only against the disposable backend.
- The existing auth focus test needed its authenticated render's passive effects flushed before dispatching focus. Its same 401/redirect assertion now passes without changing production authentication code.

## Handoff

Implementation is local on feature/day-15. Commit/push, PR screenshot, review and merge are separate publishing steps. Do not mark the handbook's overall Definition of Done complete until review and merge. Next scheduled module: Support (Day 16).
