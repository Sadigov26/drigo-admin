// Separate in-memory backend: no writes to the running backend or its database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day10.mjs <backend-directory>');
process.env.PERSIST = 'false';
process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, expected = 200) {
  const response = await fetch(root + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/rentals', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const { data } = await request('/rentals?status=Active&pageSize=10');
  assert.ok(data.length);
  const rental = await request(`/rentals/${data[0].id}`);
  const base = `/rentals/${rental.id}`;
  const cars = await request('/cars?pageSize=200');
  const target = cars.data.find(car => car.isActive && car.activeRentalId == null && car.id !== rental.car.id);
  assert.ok(target);
  await request(`${base}/switch-car?carId=${target.id}`);
  assert.equal((await request(base)).car.id, target.id);
  assert.equal((await request(`/cars/${target.id}/status`)).activeRentalId, rental.id);
  assert.equal((await request(`/cars/${rental.car.id}/status`)).activeRentalId, null);
  await request(`${base}/comp-km`, 'POST', { km: 12, reason: 'Isolated verification' });
  assert.equal((await request(base)).compensationDistanceTotal, (rental.compensationDistanceTotal || 0) + 12);
  const [option] = await request(`${base}/km-package-options`);
  await request(`${base}/add-km-package`, 'POST', { km: option.km, price: option.price });
  assert.equal((await request(base)).purchasedDistanceTotal, (rental.purchasedDistanceTotal || 0) + option.km);
  assert.ok((await request(`${base}/payments`)).some(payment => payment.transactionType === 'KmPackage' && payment.amount === option.price));
  await request(`${base}/status?status=Started`);
  assert.equal((await request(base)).status, 'Started');
  await request(`${base}/end`);
  assert.equal((await request(base)).status, 'Completed');
  assert.equal((await request(`/cars/${target.id}/status`)).activeRentalId, null);
  await request(`${base}/end`, 'GET', undefined, 409);
  await request('/auth/logout', 'POST');
  console.log('PASS: isolated auth, switch-car, car allocation, comp-km, package/payment, GET status, end/free-car and 409. No persisted data changed.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
