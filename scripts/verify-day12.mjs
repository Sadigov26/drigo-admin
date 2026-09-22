// Isolated in-memory backend: no changes to the running application's dataset.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day12.mjs <backend-directory>');
process.env.PERSIST = 'false';
process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body) {
  const response = await fetch(root + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, 200, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const users = await request('/users?pageSize=200');
  let target;
  for (const user of users.data) {
    const debts = await request(`/users/${user.id}/debt`);
    if (debts.debts.some(row => !row.isPaid)) { target = user; break; }
  }
  assert.ok(target, 'Seed contains a debtor');
  const url = `/users/${target.id}`;
  for (const endpoint of ['payments', 'login-history', 'reservations']) {
    const page = await request(`${url}/${endpoint}?page=1&pageSize=10`);
    assert.ok(Array.isArray(page.data)); assert.equal(page.page, 1); assert.equal(page.pageSize, 10);
  }
  assert.ok(Array.isArray(await request(`${url}/devices`)));
  assert.ok(Array.isArray((await request(`${url}/bonus`)).history));
  assert.equal(typeof (await request(`${url}/revenue`)).totalRevenue, 'number');
  const before = await request(`${url}/debt`);
  const count = before.debts.filter(row => !row.isPaid).length;
  const other = users.data.find(user => user.id !== target.id);
  const otherBefore = await request(`/users/${other.id}/debt`);
  const result = await request(`${url}/debt/pay`, 'POST');
  assert.equal(result.paidCount, count);
  const after = await request(`${url}/debt`);
  assert.equal(after.totalDebt, 0); assert.ok(after.debts.every(row => row.isPaid));
  assert.deepEqual(await request(`/users/${other.id}/debt`), otherBefore);
  assert.equal((await request(`${url}/debt/pay`, 'POST')).paidCount, 0);
  console.log('Day 12: seven tab contracts and pay-all transition passed; other customers unchanged.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
