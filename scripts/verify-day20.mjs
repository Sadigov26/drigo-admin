// Disposable integration checks: no live data or real notifications are changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day20.mjs <backend-directory>');
process.env.PERSIST = 'false'; process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, endpoint);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/fleetplan', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  assert.ok((await request('/fleetplan')).targets.length);
  for (const endpoint of ['fleet-moves', 'parkingZones', 'gasStations', 'fleet-utilization/distance', 'fleet-utilization/fuel']) assert.ok(Array.isArray(await request('/' + endpoint)));
  const summary = await request('/fleet-utilization/summary');
  assert.equal(summary.activeCars + summary.idleCars, summary.totalCars);
  const cars = await request('/fleet-utilization/by-car?page=1&pageSize=2');
  assert.equal(cars.data.length, 2); assert.equal(cars.total, summary.totalCars);
  const zone = await request('/geozones', 'POST', { name: 'Day20 test zone', type: 'Operating', color: '#315d88', polygon: [{ lat: 25, lng: 55 }, { lat: 25.1, lng: 55 }, { lat: 25.1, lng: 55.1 }] }, 201);
  await request(`/geozones/${zone.id}`, 'PUT', { name: 'Updated zone', isActive: false });
  assert.equal((await request(`/geozones/${zone.id}`)).isActive, false);
  await request(`/geozones/${zone.id}`, 'DELETE');
  await request(`/geozones/${zone.id}`, 'GET', undefined, 404);
  const historyBefore = await request('/notifications/history?pageSize=1');
  for (const targetAudience of ['All', 'Verified', 'Unverified', 'WithDebt', 'Inactive']) {
    const preview = await request('/notifications/preview-target', 'POST', { targetAudience });
    assert.equal(preview.audience, targetAudience); assert.ok(Number.isInteger(preview.estimatedRecipients));
  }
  const preview = await request('/notifications/preview-target', 'POST', { targetAudience: 'Verified' });
  const sent = await request('/notifications/broadcast', 'POST', { title: 'Isolated broadcast', body: 'Test only', targetAudience: 'Verified' });
  assert.equal(sent.recipientCount, preview.estimatedRecipients);
  const history = await request('/notifications/history?pageSize=1');
  assert.equal(history.total, historyBefore.total + 1); assert.equal(history.data[0].title, 'Isolated broadcast');
  assert.deepEqual(await request('/notifications/feed?pageSize=1'), history);
  const campaign = await request('/notifications/campaigns', 'POST', { title: 'Test campaign', body: 'Message', status: 'Draft', targetAudience: 'All' }, 201);
  await request(`/notifications/campaigns/${campaign.id}`, 'PUT', { title: 'Updated campaign', status: 'Cancelled' });
  assert.equal((await request(`/notifications/campaigns/${campaign.id}`)).status, 'Cancelled');
  await request(`/notifications/campaigns/${campaign.id}`, 'DELETE');
  await request(`/notifications/campaigns/${campaign.id}`, 'GET', undefined, 404);
  const scheduled = await request('/notifications/scheduled', 'POST', { title: 'Scheduled test', body: 'Message', targetAudience: 'All', scheduledAt: new Date(Date.now() + 86400000).toISOString() }, 201);
  assert.ok((await request('/notifications/scheduled')).some(row => row.id === scheduled.id));
  await request(`/notifications/scheduled/${scheduled.id}`, 'DELETE');
  assert.ok(!(await request('/notifications/scheduled')).some(row => row.id === scheduled.id));
  console.log('Day 20 passed: fleet/geo reads, zone CRUD, all audiences, broadcast/history/feed, campaign CRUD, scheduled create/delete, pagination and 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
