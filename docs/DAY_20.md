# Day 20 — Fleet & Geo + Notifications

## Scope and publication

Implemented on `feature/day-20`. Work was initially kept local; the user explicitly requested publication on October 1. Day 19 PR #19 was verified merged, and the branch was fast-forwarded to `origin/main` before committing Day 20. No existing commit dates or history were rewritten.

Handbook Sections 8.15 and 8.13 were read from the supplied PDF and compared with live responses and the separate backend source. Backend files were not modified.

## Screens

- `/fleet`: Plan, Moves, Utilization, Geo zones, Parking zones, Gas stations.
- Plan has a current/target chart and searchable sortable city table.
- Utilization has summary/chart plus per-car, distance and fuel tables. Fuel is rounded to whole percentages for display; coordinates retain six decimal places.
- Geo zones have create/edit/delete confirmation, validated polygon JSON, type/color/active fields and a Leaflet polygon map. Inactive outlines are dashed. Popups use text nodes, not injected HTML. Tiles failing does not hide records. Resize observation and map instances are cleaned up.
- `/notifications`: Broadcast, Campaigns, Scheduled, History and Feed. Campaign CRUD and scheduled create/delete use real endpoints. Every list has loading/error/retry/empty states, local search/sort/pagination and row details preserving all returned fields, including nullable values.
- URL `view` parameters preserve the selected section; invalid values safely select the default. Switching sections resets their transient list/form state.
- Shared action layout places equal-sized Edit/Delete controls at the right edge. Forms use consistent field heights and responsive grids. Dates in records use Asia/Dubai; scheduling inputs explicitly identify device timezone and serialize to UTC.

## Real endpoint contracts

| Endpoint | Response/use |
| --- | --- |
| `GET /fleetplan` | `{updatedAt, targets:[{city,targetCars,currentCars}]}` |
| `GET /fleet-moves` | Array: carId, plateNumber, fromCity, toCity, status, assignedTo, scheduledAt, createdAt |
| `GET /fleet-utilization/summary` | totalCars, activeCars, idleCars, utilizationRate, totalRevenue, totalDistance, avgRevenuePerCar, currency |
| `GET /fleet-utilization/by-car` | Paginated carId/plate/carName, isActive, currentlyRented, rentalCount, totalDistance, revenue |
| `GET /fleet-utilization/distance` | Array: carId, plateNumber, odometer, rentedDistance |
| `GET /fleet-utilization/fuel` | Array: carId, plateNumber, fuelType, fuelLevel, tankCapacity |
| `GET/POST /geozones`, `PUT/DELETE /geozones/:id` | name, type, isActive, polygon `[{lat,lng}]`, color; id/createdAt readonly |
| `GET /parkingZones` | name, latitude, longitude, radiusMeters, isFree, createdAt |
| `GET /gasStations` | name, brand, latitude, longitude, createdAt |
| `POST /notifications/preview-target` | `{targetAudience}` → `{audience,estimatedRecipients}` |
| `POST /notifications/broadcast` | `{title,body,targetAudience}` → `{success,recipientCount,sentAt}` |
| `GET /notifications/history`, `/notifications/feed` | Paginated title/body/type/targetUserId/channel/status/createdAt |
| Campaign GET/POST/PUT/DELETE | title, body, status, targetAudience, scheduledAt editable; sentAt/counts/id/createdAt readonly |
| Scheduled GET/POST/DELETE | title, body, targetAudience, scheduledAt; id/createdAt readonly |

GET contracts were first inspected with `curl.exe -s -b <local-cookie-file> http://localhost:4000/api/admin/<endpoint>`. Cookie files stay outside the repository. All requested endpoints plus the four concrete utilization endpoints, Feed and Scheduled were checked. No mutation was tested against the running development data.

## Backend differences and limitations

- Geo zones do **not** persist a city field. Supported seeded types are Operating, Restricted, NoParking and Premium. Do not infer type from the zone name: seed names and types may differ.
- Geometry is a `{lat,lng}` array, not GeoJSON `[lng,lat]`. Leaflet receives `[lat,lng]`. Coordinate ranges and at least three distinct points are required. This is not a GIS topology validator (self-intersecting polygons are not detected).
- Seed polygons are synthetic squares, sometimes offshore; the frontend shows actual returned coordinates rather than fabricating a city boundary.
- Distance and fuel endpoints return only the first **40 cars**. The UI explicitly states this. Per-car utilization is paginated and loads all pages.
- Summary `activeCars` counts **currently rented** cars. `idleCars` means every other car, including inactive ones; it is not an available-to-rent count. Revenue/distance are cumulative. `updatedAt` belongs to plan configuration, while current counts are recalculated on GET.
- Tank-capacity units for electric cars are not specified. No invented liters/kWh label is added.
- Audiences are All, Verified, Unverified, WithDebt and Inactive. Verified uses backend `isVerified`; Inactive means not online, not a frontend time threshold. WithDebt counts unique unpaid debtor IDs, which can differ from non-deleted customer counts.
- History and Feed currently return the **same** stored records.
- Broadcast logs a mock Delivered history record and reports an audience count; it does not send real push notifications. Campaign status edits are metadata updates, not campaign execution. The separate execute endpoint is outside this requested scope.
- Scheduled records are stored, but the supplied simulator has no scheduled-notification dispatcher. Saving a schedule does not prove future delivery.
- No dedicated `notifications.*` grants exist. UI policy uses existing `settings.view/create/edit/delete` grants for Notifications and `fleet.view/create/edit/delete` for Geo. This is a documented frontend fallback, not a claim that the mock enforces those permissions on its routes. Dedicated backend grants/enforcement remain a production requirement.
- Mock delete handlers do not enforce linked-record 409 conflicts. HTTP 409 is nevertheless displayed without dismissing the dialog and is covered by a component test.
- Search/sort are local on complete snapshots because these routes do not implement server-side search. Paginated snapshots reject changed totals, duplicate IDs and incomplete pages; they are not transactionally consistent if fields change without a total/ID change. A production high-volume API should offer server-side filters/sort.

## Mutation safety and review explanation

1. Broadcast validates title, body and audience, then calls preview-target. An edit invalidates the preview.
2. Review opens an explicit confirmation dialog. Immediately before POST, audience size is checked again; changed counts require renewed confirmation.
3. POST writes to the backend. A successful response is shown; History/Feed refetch on entering their tab. No local fabricated history row is inserted.
4. An uncertain network/5xx response preserves the draft and disables resubmission until the operator checks History. This reduces accidental duplicates; true exactly-once delivery would require server idempotency keys.
5. Geo/campaign/scheduled mutations use an immediate ref lock to block double submits, retain validation/409 errors in the dialog, and refetch the list on success. No retry is automatic. Read fetches abort on unmount; mutation callbacks guard unmounted components.

## Verification

- `node scripts/verify-day20.mjs ../drigo.dev.node`: passed against an isolated ephemeral backend (`PERSIST=false`, `SIM_TICK_MS=0`). Covers fleet reads, zone create/update/read/delete, all five previews, broadcast/history/feed, campaign CRUD, scheduled create/delete, pagination and 401/404.
- Focused `npm test -- --maxWorkers=1 --testTimeout=30000 src/fleet`: 13 tests passed. Covers snapshot integrity, abort propagation, payload allowlists, geometry/date validation, preview invalidation, confirmation, audience changes, duplicate-submit lock, uncertain-send draft preservation, null detail fields, pagination, whole fuel percentages, 409/refresh and read-only access.
- Production build passed. Full regression suite: **261 tests passed in 31 files**.
- Browser validation uses read-only navigation and form opening/cancel, not live business mutations.

## Publication checklist

- Review the diff and explain the state transitions above.
- Day 19 merge status confirmed; PR base is `main`.
- Publication authorized October 1. Open the Day 20 PR for review; screenshots can be attached by the user.
- Day 21 remains Operations + Settings & Security and final polish; placeholder pages are not described as completed.
