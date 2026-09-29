// All writes go to an isolated in-memory backend, never the running development database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day18.mjs <backend-directory>');
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
  await request('/promotions', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const payloads = {
    promotions: { title: 'Isolated promotion', description: 'Test', imageUrl: 'https://example.com/a.png', actionType: 'None', frequency: 'Once', isActive: true, startDate: '2026-09-01T00:00:00Z', endDate: null },
    discounts: { name: 'Isolated discount', type: 'Percentage', value: 15, status: 'Active', targetAudience: 'All', scope: 'Global', usageLimit: 100, startDate: '2026-09-01T00:00:00Z', endDate: null },
    'promo-codes': { code: 'ISOLATED18', discountType: 'FixedAmount', value: 25, maxRedemptions: 10, isActive: true, expiresAt: null },
    stories: { title: 'Isolated story', status: 'Active', targetAudience: 'All', items: [{ id: 1, mediaType: 'Image', mediaUrl: 'https://example.com/a.png', durationSec: 5 }] },
  };
  for (const [resource, payload] of Object.entries(payloads)) {
    const endpoint = '/' + resource;
    const listing = await request(endpoint + '?page=1&pageSize=2');
    assert.ok(Array.isArray(resource === 'stories' ? listing : listing.data));
    const created = await request(endpoint, 'POST', payload, 201);
    assert.ok(created.id);
    assert.equal((await request(`${endpoint}/${created.id}`)).id, created.id);
    const updates = resource === 'stories' || resource === 'discounts' ? { status: resource === 'stories' ? 'Draft' : 'Paused' } : { isActive: false };
    await request(`${endpoint}/${created.id}`, 'PUT', updates);
    const edited = await request(`${endpoint}/${created.id}`);
    for (const [key, value] of Object.entries(updates)) assert.equal(edited[key], value);
    if (resource !== 'promo-codes') {
      const active = resource === 'promotions' ? { isActive: true } : { status: 'Active' };
      await request(`${endpoint}/${created.id}/status`, 'PATCH', active);
      const refreshed = await request(`${endpoint}/${created.id}`);
      for (const [key, value] of Object.entries(active)) assert.equal(refreshed[key], value);
    }
    if (resource === 'discounts' || resource === 'stories') assert.ok(await request(`${endpoint}/${created.id}/analytics`));
    await request(`${endpoint}/${created.id}`, 'DELETE');
    await request(`${endpoint}/${created.id}`, 'GET', undefined, 404);
  }
  const referral = await request('/referrals/settings');
  await request('/referrals/settings', 'PUT', { ...referral, referrerBonus: 75, refereeBonus: 35, minRentalsToQualify: 2, isActive: false });
  const updated = await request('/referrals/settings');
  assert.equal(updated.referrerBonus, 75); assert.equal(updated.refereeBonus, 35); assert.equal(updated.minRentalsToQualify, 2); assert.equal(updated.isActive, false);
  console.log('Day 18 passed: four list/detail/CRUD flows, explicit status changes, two analytics endpoints, referral updates, 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
