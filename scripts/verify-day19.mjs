// Read-only endpoint checks against a disposable, frozen backend.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day19.mjs <backend-directory>');
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
  await request('/reports/statistics', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  for (const resource of ['revenue', 'debt', 'utilization']) assert.equal((await request(`/analytics/${resource}-daily?days=7`)).points.length, 7);
  assert.equal((await request('/analytics/customer-funnel')).steps.length, 4);
  const demographics = await request('/analytics/demographics');
  for (const field of ['platform', 'age', 'gender']) assert.ok(Array.isArray(demographics[field]));
  assert.equal((await request('/analytics/fleet-health')).conditions.length, 4);
  const report = await request('/reports/monthly?months=6');
  assert.equal(report.months.length, 6);
  for (const row of report.months) {
    assert.deepEqual(await request(`/reports/monthly/${row.month}`), row);
    assert.ok(Math.abs(row.netRevenue - (row.revenue.total - row.operatingCost)) < 0.02);
  }
  assert.ok(Math.abs(report.totals.revenue - report.months.reduce((s, r) => s + r.revenue.total, 0)) < 0.02);
  assert.ok((await request('/reports/statistics')).revenue.total >= 0);
  assert.equal((await request('/dashboard/monthly-financials?months=6')).months.length, 6);
  await request('/dashboard/monthlyfinancials', 'GET', undefined, 404);
  for (const kind of ['salik', 'enoc']) {
    assert.ok((await request(`/${kind}/summary`)).totalAmount >= 0);
    const list = await request(`/${kind}/${kind === 'salik' ? 'trips' : 'transactions'}?page=1&pageSize=2`);
    assert.equal(list.data.length, 2); assert.ok(list.total > 2);
  }
  console.log('Day 19 passed: six analytics endpoints, monthly table/totals/drill-down, statistics, financials, Salik/ENOC pagination and 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
