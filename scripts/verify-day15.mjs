// Disposable in-memory backend only: never connects to the user's running server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-day15.mjs <backend-directory>');
process.env.PERSIST = 'false';
process.env.SIM_TICK_MS = '0';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
require('./src/db').init();
const { db } = require('./src/db/store');
const server = require('./src/app').createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let cookie = '';
async function request(endpoint, method = 'GET', body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, expected, `${method} ${endpoint}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return response.json();
}
try {
  await request('/reservations', 'GET', undefined, 401);
  await request('/deliveryDrivers', 'GET', undefined, 401);
  await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  await request('/auth/verify', 'POST', { username: 'admin', code: '123456' });
  const zone = await request('/deliveryZones', 'POST', { name: 'Isolated zone', centerLat: 25.2, centerLng: 55.3, radiusKm: 4, isActive: true }, 201);
  assert.equal(zone.centerLat, 25.2);
  await request(`/deliveryZones/${zone.id}`, 'PUT', { name: 'Updated zone', radiusKm: 6 });
  assert.equal((await request('/deliveryZones?pageSize=200')).data.find(row => row.id === zone.id).radiusKm, 6);
  const driver = await request('/deliveryDrivers', 'POST', { fullName: 'Isolated driver', phoneNumber: '+971500000000', zoneId: zone.id }, 201);
  assert.equal(driver.status, 'Offline');
  await request(`/deliveryDrivers/${driver.id}`, 'PUT', { status: 'Online' });
  // No reservation create endpoint exists: fixtures are inserted only in this disposable instance.
  const source = db.reservations[0];
  assert.ok(source);
  const id = Math.max(...db.reservations.map(row => row.id)) + 1;
  const pipeline = ['Pending', 'Confirmed', 'DriverAssigned', 'PickingUp', 'InDelivery', 'Delivered', 'Completed', 'Cancelled', 'Expired'];
  pipeline.forEach((status, index) => db.reservations.push({ ...source, id: id + index, status, driverId: null, driverName: null }));
  for (const status of pipeline) assert.ok((await request(`/reservations?status=${status}&pageSize=200`)).data.every(row => row.status === status));
  const assigned = await request(`/reservations/${id}/assign-driver`, 'POST', { driverId: driver.id });
  assert.equal(assigned.status, 'DriverAssigned');
  const freshDriver = await request(`/deliveryDrivers/${driver.id}`);
  assert.equal(freshDriver.status, 'Busy'); assert.equal(freshDriver.activeDeliveries, 1);
  assert.equal((await request(`/reservations/${id}`)).driver.id, driver.id);
  assert.ok((await request('/reservations/active-deliveries')).some(row => row.id === id && row.driverId === driver.id));
  await request(`/reservations/${id}/cancel`, 'POST', { reason: 'Isolated check' });
  assert.equal((await request(`/reservations/${id}`)).status, 'Cancelled');
  assert.equal(db.reservations.find(row => row.id === id).cancelReason, 'Isolated check');
  assert.equal((await request(`/deliveryDrivers/${driver.id}`)).status, 'Online');
  assert.ok(!(await request('/reservations/active-deliveries')).some(row => row.id === id));
  await request(`/reservations/${id}/cancel`, 'POST', {}, 409);
  await request(`/deliveryDrivers/${driver.id}`, 'DELETE');
  await request(`/deliveryDrivers/${driver.id}`, 'GET', undefined, 404);
  await request(`/deliveryZones/${zone.id}`, 'DELETE');
  assert.ok(!(await request('/deliveryZones?pageSize=200')).data.some(row => row.id === zone.id));
  await request(`/deliveryZones/${zone.id}`, 'DELETE', undefined, 404);
  console.log('Day 15 passed: pipeline filters, assignment -> Busy/map, cancel -> Online/409, drivers/zones CRUD, 401/404.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
