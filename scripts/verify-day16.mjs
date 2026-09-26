// Contract checks mutate only an ephemeral, in-memory backend, never localhost:4000.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day16.mjs <backend-directory>');
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
  await request('/supports', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const user = (await request('/users?pageSize=1')).data[0];
  const ticket = await request('/supports', 'POST', { memberId: user.id }, 201);
  const endpoint = `/supports/${ticket.id}`;
  await request(endpoint + '/messages', 'POST', { text: 'Wrong contract' }, 400);
  const reply = await request(endpoint + '/messages', 'POST', { message: 'Isolated Day 16 reply' }, 201);
  assert.equal(reply.isOperator, true);
  assert.equal((await request(endpoint)).status, 'Pending');
  assert.ok((await request(endpoint + '/messages')).data.some(row => row.id === reply.id));
  assert.equal((await request('/supports?pageSize=200&sortBy=id&sortOrder=desc')).data.find(row => row.id === ticket.id).unreadCount, 0);
  for (const status of ['Open', 'Pending', 'Resolved', 'Closed']) {
    await request(endpoint + '/status', 'PUT', { status });
    assert.equal((await request(endpoint)).status, status);
    assert.ok((await request(`/supports?status=${status}&pageSize=200&sortBy=id&sortOrder=desc`)).data.some(row => row.id === ticket.id));
  }
  const operator = (await request('/auth?pageSize=200')).data.find(row => row.username === 'operator');
  await request(endpoint + '/assign', 'PUT', { operatorId: operator.id });
  assert.equal((await request(endpoint)).operatorId, operator.id);
  for (const isMuted of [true, false]) { await request(endpoint + '/mute', 'PUT', { isMuted }); assert.equal((await request(endpoint)).isMuted, isMuted); }
  const context = await request(endpoint + '/context');
  assert.equal(context.member.id, user.id); assert.ok(context.verification); assert.ok(context.outstandingDebt);
  assert.ok((await request('/support-templates')).every(row => typeof row.body === 'string'));
  assert.ok((await request(endpoint + '/ai-suggestions')).every(row => typeof row.text === 'string'));
  await request('/supports/999999999', 'GET', undefined, 404);
  console.log('Day 16 passed: auth, reply append/Open->Pending/unread, filters/status, assignment, mute, context, templates, suggestions, 400/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
