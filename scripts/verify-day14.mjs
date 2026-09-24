// Mutates only a separate, in-memory backend instance.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day14.mjs <backend-directory>');
process.env.PERSIST = 'false'; process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, status = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, status, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/manual-fines', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const user = (await request('/users?pageSize=1')).data[0];
  const car = (await request('/cars?pageSize=1')).data[0];
  const account = `/users/${user.id}/debt`;
  const before = await request(account);
  const fine = await request('/manual-fines', 'POST', { userId: user.id, carId: car.id, amount: 125, referenceNumber: 'DAY14-ISOLATED' }, 201);
  await request(`/manual-fines/${fine.id}/bill-customer`, 'POST');
  const after = await request(account);
  const added = after.debts.filter(row => !before.debts.some(old => old.id === row.id));
  assert.equal(added.length, 1); assert.equal(added[0].amount, 125); assert.equal(added[0].isPaid, false); assert.equal(added[0].type, 'Fine');
  const billed = (await request('/manual-fines?status=Billed&pageSize=200')).data.find(row => row.id === fine.id);
  assert.equal(billed.billedTo, 'Customer');
  for (const action of ['bill-company', 'dismiss']) {
    const row = await request('/manual-fines', 'POST', { userId: user.id, carId: car.id, amount: 25 }, 201);
    await request(`/manual-fines/${row.id}/${action}`, 'POST');
    assert.deepEqual(await request(account), after);
    const status = action === 'dismiss' ? 'Dismissed' : 'Billed';
    assert.ok((await request(`/manual-fines?status=${status}&pageSize=200`)).data.some(item => item.id === row.id));
  }
  assert.ok((await request('/manual-fines/review')).every(row => ['Pending', 'Review'].includes(row.status)));
  assert.ok((await request('/manual-fines/scraper?pageSize=200')).data.every(row => row.source !== 'Manual'));
  assert.ok((await request('/manual-fines/sync-status')).lastSyncAt);
  assert.ok(Array.isArray((await request('/car-fines')).data));
  const details = await request(`/car-fines/${car.id}`);
  assert.equal(details.totalAmount, details.fines.reduce((sum, row) => sum + row.amount, 0));
  const accident = await request('/accidents', 'POST', { carId: car.id, userId: user.id, description: 'Isolated accident check', estimatedCost: 45, location: 'Dubai', status: 'Reported' }, 201);
  for (const status of ['UnderReview', 'Resolved', 'Closed']) {
    await request(`/accidents/${accident.id}`, 'PUT', { status });
    assert.ok((await request(`/accidents?status=${status}&pageSize=200`)).data.some(row => row.id === accident.id));
  }
  await request(`/accidents/${accident.id}`, 'DELETE');
  await request(`/accidents/${accident.id}`, 'DELETE', undefined, 404);
  assert.ok(!(await request('/accidents?pageSize=200')).data.some(row => row.id === accident.id));
  console.log('Day 14 passed: billing creates one debt; company/dismiss do not; review/scraper/sync, car totals, accident CRUD and 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
