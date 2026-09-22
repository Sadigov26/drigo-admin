// Uses a fresh in-memory backend; never touches the running dataset.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day11.mjs <backend-directory>');
process.env.PERSIST = 'false';
process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, status = 200) {
  const response = await fetch(root + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, status, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/users', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const pending = await request('/users?approvalStatus=pending&pageSize=200');
  const id = pending.data[0].id;
  const url = `/users/${id}`;
  await request(`${url}/verify`, 'PUT', { approve: true });
  let detail = await request(url);
  assert.equal(detail.isApproved, true);
  for (const key of ['passportDetail', 'driverLicenseDetail', 'nationalIdentityDetail', 'faceVerifyDetail']) if (detail[key]) assert.equal(detail[key].status, 'Verified');
  assert.ok(!(await request('/users?approvalStatus=pending&pageSize=200')).data.some(row => row.id === id));
  assert.ok((await request('/users?approvalStatus=approved&pageSize=200')).data.some(row => row.id === id));
  await request(`${url}/verify`, 'PUT', { approve: false, rejectionReason: 'Test rejection' });
  detail = await request(url);
  assert.equal(detail.isApproved, false);
  assert.equal(detail.passportDetail.status, 'Rejected');
  assert.equal(detail.faceVerifyDetail.status, 'Pending');
  await request(`${url}/block`, 'PATCH', { blocked: true, reason: 'Test block' });
  assert.equal((await request(url)).isBlocked, true);
  assert.ok((await request('/users?approvalStatus=blocked&pageSize=200')).data.some(row => row.id === id));
  await request(`${url}/block`, 'PATCH', { blocked: false });
  assert.equal((await request(url)).isBlocked, false);
  await request(url, 'DELETE');
  assert.equal((await request(url)).isDeleted, true);
  assert.ok(!(await request('/users?approvalStatus=deleted&pageSize=200')).data.some(row => row.id === id));
  await request(`${url}/restore`, 'POST');
  detail = await request(url);
  assert.equal(detail.isDeleted, false);
  assert.equal(detail.deletedAt, null);
  assert.ok((await request('/users?pageSize=200')).data.some(row => row.id === id));
  console.log('Day 11: approve/reject, document/face states, block/unblock, delete/restore and list refresh contracts passed.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
