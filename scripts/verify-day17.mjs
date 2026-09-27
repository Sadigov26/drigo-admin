// Mutates only an ephemeral in-memory instance, never the running development database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day17.mjs <backend-directory>');
process.env.PERSIST = 'false'; process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}
try {
  await request('/tariff-packages', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  for (const resource of ['tariff-packages', 'tariff-plans', 'tariff-templates', 'tariff-distances', 'insurances', 'subscription-plans']) assert.ok(Array.isArray(await request('/' + resource)));
  const bookings = await request('/subscription-bookings?page=1&pageSize=2');
  assert.equal(bookings.data.length, 2); assert.ok(bookings.total > 2);
  for (const resource of ['tariff-packages', 'tariff-plans', 'tariff-templates']) {
    const endpoint = resource === 'tariff-packages' ? '/tariff-package' : '/' + resource;
    const data = resource === 'tariff-packages' ? { unitCount: 2, timeUnit: 'Day', price: 99, currency: 'AED', isActive: true } : { name: 'Day 17 isolated check', description: 'Test record', isActive: true };
    const created = await request(endpoint, 'POST', data, 201);
    assert.ok((await request('/' + resource)).some(row => row.id === created.id));
    await request(`/${resource}/${created.id}`, 'PUT', { ...data, isActive: false });
    assert.equal((await request('/' + resource)).find(row => row.id === created.id).isActive, false);
    await request(`/${resource}/${created.id}`, 'DELETE');
    assert.ok(!(await request('/' + resource)).some(row => row.id === created.id));
    await request(`/${resource}/${created.id}`, 'DELETE', undefined, 404);
  }
  await request('/tariff-packages', 'POST', {}, 404);
  await request('/tariff-distances', 'POST', { includedKm: 20 }, 404);
  await request('/tariff-distances/1', 'PUT', { includedKm: 20 }, 404);
  await request('/tariff-distances/1', 'DELETE', undefined, 404);
  console.log('Day 17 passed: seven lists, booking pagination, package/plan/template CRUD, singular create contract, missing distance mutations, 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
