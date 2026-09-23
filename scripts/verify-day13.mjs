// Only an isolated, non-persistent test instance is mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day13.mjs <backend-directory>');
process.env.PERSIST = 'false'; process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, status = 200) {
  const response = await fetch(root + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, status, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/debts', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const { data: users } = await request('/users?pageSize=200');
  const id = users[0].id, base = `/users/${id}/debt`;
  const otherBefore = await request(`/users/${users[1].id}/debt`);
  const first = await request(base, 'POST', { amount: 12, type: 'Manual', description: 'Isolated split check' }, 201);
  const split = await request(`${base}/${first.id}/split`, 'POST', { parts: 3 });
  assert.equal(split.parts, 3);
  let account = await request(base);
  const parts = account.debts.filter(row => row.description.startsWith('Isolated split check'));
  assert.equal(parts.length, 3); assert.equal(parts.reduce((sum, row) => sum + row.amount, 0), 12);
  assert.equal((await request(`${base}/pay-selected`, 'POST', { debtIds: parts.slice(0, 2).map(row => row.id) })).paidCount, 2);
  await request(`${base}/${parts[2].id}/pay`, 'POST');
  account = await request(base); assert.ok(account.debts.filter(row => parts.some(part => part.id === row.id)).every(row => row.isPaid));
  const toDelete = await request(base, 'POST', { amount: 5, description: 'Delete test' }, 201);
  await request(`${base}/${toDelete.id}`, 'DELETE');
  await request(`${base}/${toDelete.id}`, 'DELETE', undefined, 404);
  await request(`${base}/pay`, 'POST');
  assert.equal((await request(base)).totalDebt, 0);
  assert.ok(!(await request('/users/with-debt?pageSize=200')).data.some(row => row.id === id));
  const paid = await request('/debts?isPaid=true&pageSize=200'); assert.ok(paid.data.every(row => row.isPaid));
  const unpaid = await request('/debts?isPaid=false&pageSize=200'); assert.ok(unpaid.data.every(row => !row.isPaid));
  assert.deepEqual(await request(`/users/${users[1].id}/debt`), otherBefore);
  const report = await fetch(root + '/users/with-debt/report', { headers: { Cookie: cookie } });
  assert.equal(report.status, 200); assert.match(report.headers.get('content-type'), /text\/csv/); assert.match(report.headers.get('content-disposition'), /attachment/);
  assert.ok((await report.text()).startsWith('Name,Phone,Email,Debt(AED)'));
  console.log('Day 13 passed: list/filter, add, split, selected/single/all payment, delete/404, debtor removal, CSV and isolation.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
