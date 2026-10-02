// All writes run only inside this disposable, frozen mock server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day21.mjs <backend-directory>');
process.env.PERSIST = 'false'; process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
const db = require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, endpoint);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}
try {
  await request('/trip-fee', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  // Both retry outcomes are deterministic only inside this disposable process.
  const payment = db.rentalPayments.find(row => row.status === 'Failed');
  assert.ok(payment);
  const rental = db.rentals.find(row => row.id === payment.rentalId);
  const rentalBefore = rental?.status, debtsBefore = JSON.stringify(db.debts);
  const otherPayment = db.rentalPayments.find(row => row.id !== payment.id);
  const otherBefore = JSON.stringify(otherPayment);
  const originalRandom = Math.random;
  try {
    for (const [random, expected] of [[0.1, 'Succeeded'], [0.9, 'Failed']]) {
      payment.status = 'Failed';
      Math.random = () => random;
      const result = await request(`/users/${payment.userId}/payments/${payment.id}/retry`, 'POST');
      assert.deepEqual(result, { success: true, status: expected });
      const stored = (await request(`/rentals/${payment.rentalId}/payments`)).find(row => row.id === payment.id);
      assert.equal(stored.status, expected);
      assert.equal(stored.failureReason, expected === 'Failed' ? 'Card declined' : null);
      assert.equal(rental?.status, rentalBefore);
      assert.equal(JSON.stringify(db.debts), debtsBefore);
      assert.equal(JSON.stringify(otherPayment), otherBefore);
    }
  } finally { Math.random = originalRandom; }
  await request(`/users/not-the-owner/payments/${payment.id}/retry`, 'POST', undefined, 404);
  const problem = (await request('/problemreports?pageSize=1')).data[0];
  assert.ok(problem.plateNumber && problem.category);
  await request(`/problemreports/${problem.id}/status`, 'PUT', { status: 'Resolved' });
  assert.equal((await request(`/problemreports/${problem.id}`)).status, 'Resolved');
  const parking = await request('/parking');
  assert.ok(parking.summary.totalZones > 0 && parking.cards.length > 0);
  assert.equal((await request('/parking/sync', 'POST')).success, true);
  const history = await request('/cars/1/history-routes');
  assert.equal(history.carId, 1); assert.equal(history.routes.length, 8);
  const points = await request(`/cars/routes/${history.routes[0].routeId}/points`);
  assert.equal(points.routeId, history.routes[0].routeId); assert.equal(points.points.length, 30);
  assert.ok(points.points.every(p => Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180));
  const cleanings = await request('/cleanings?pageSize=100');
  const cleaning = cleanings.data.find(row => ['Scheduled', 'InProgress'].includes(row.status));
  assert.ok(cleaning);
  const beforeStats = await request('/cleanings/stats');
  await request(`/cleanings/${cleaning.id}/cancel`, 'PUT', {});
  assert.equal((await request(`/cleanings/${cleaning.id}`)).status, 'Cancelled');
  assert.equal((await request('/cleanings/stats')).byStatus.Cancelled, (beforeStats.byStatus.Cancelled ?? 0) + 1);
  for (const endpoint of ['car-reports', 'car-services', 'businessinquiries', 'cars/connected-devices', 'exit-surveys']) {
    const list = await request(`/${endpoint}?page=1&pageSize=2`); assert.equal(list.data.length, 2); assert.ok(list.total > 2);
  }
  assert.ok(Array.isArray(await request('/employees')));
  const inquiry = (await request('/businessinquiries')).data[0];
  await request(`/businessinquiries/${inquiry.id}/status`, 'PUT', { status: 'Contacted' });
  assert.equal((await request('/businessinquiries')).data.find(row => row.id === inquiry.id).status, 'Contacted');
  const source = (await request('/scraper/status')).sources[0].source;
  const run = await request(`/scraper/trigger/${encodeURIComponent(source)}`);
  assert.equal(run.run.source, source); assert.equal(run.run.status, 'Success');
  await request('/scraper/trigger', 'POST', {}, 404);
  for (const endpoint of ['overview', 'database', 'redis', 'docker', 'teltonika']) assert.ok(await request(`/monitoring/${endpoint}`));
  await request('/monitoring/api', 'GET', undefined, 404);
  for (const [endpoint, body] of [['trip-fee', { amount: 7.25, isActive: false }], ['excess-km-charge', { pricePerKm: 1.25, isActive: true }]]) {
    await request('/' + endpoint, 'PUT', body);
    const saved = await request('/' + endpoint);
    for (const [key, value] of Object.entries(body)) assert.equal(saved[key], value);
  }
  for (const endpoint of ['service-fees', 'penalty-configs']) {
    const row = (await request('/' + endpoint))[0];
    await request(`/${endpoint}/${row.id}`, 'PUT', { amount: 12.25, name: 'Test fee', isActive: false });
    assert.equal((await request('/' + endpoint)).find(item => item.id === row.id).amount, 12.25);
  }
  // Documentation-only IP ranges and a disposable two-letter country entry.
  await request('/security/block-ip', 'POST', { entry: '192.0.2.0/24', reason: 'Isolated test' }, 201);
  assert.ok((await request('/security/blocked-ips')).some(row => row.entry === '192.0.2.0/24'));
  await request('/security/block-ip/' + encodeURIComponent('192.0.2.0/24'), 'DELETE');
  assert.ok(!(await request('/security/blocked-ips')).some(row => row.entry === '192.0.2.0/24'));
  await request('/security/block-country-code', 'POST', { countryCode: 'ZZ', reason: 'Isolated test' }, 201);
  assert.ok((await request('/security/blocked-country-codes')).some(row => row.countryCode === 'ZZ'));
  await request('/security/block-country-code/ZZ', 'DELETE');
  assert.ok(!(await request('/security/blocked-country-codes')).some(row => row.countryCode === 'ZZ'));
  await request('/security/sms-country-mode', 'POST', { mode: 'Whitelist', countries: ['AE'] });
  assert.deepEqual((await request('/security/sms-country-mode')).countries, ['AE']);
  await request('/security/blocked-countries', 'GET', undefined, 404);
  await request('/security/sms-mode', 'GET', undefined, 404);
  const admins = await request('/auth');
  assert.ok(admins.data.every(row => !('password' in row)));
  const target = admins.data.find(row => !row.isSuperAdmin);
  const catalogue = await request('/permissions?pageSize=100'); assert.ok(catalogue.data.some(row => row.code === 'cars.view'));
  await request(`/permissions/admins/${target.id}`, 'PUT', { permissionCodes: ['cars.view'] });
  assert.deepEqual((await request(`/permissions/admins/${target.id}`)).permissionCodes, ['cars.view']);
  console.log('Day 21 passed: operations reads/cancel/status/trigger, monitoring, fee edits, IP/country blocks, SMS configuration, admin permissions, pagination and 401/404. No live data modified.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
