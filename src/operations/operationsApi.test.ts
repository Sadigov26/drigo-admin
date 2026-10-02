import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { buildBody, execute, feeFields, savePermissions, validIp, type Action } from './operationsApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const fee: Action = { title: 'Edit', path: 'service-fees/1', method: 'PUT', kind: 'fee', fields: feeFields('service-fees'), initial: {} };
it('validates fee values and sends only editable fields', () => {
  expect(buildBody(fee, { name: ' Fee ', amount: '2.50', isActive: true, isPercentage: false, id: 1, currency: 'USD' })).toEqual({ name: 'Fee', amount: 2.5, isActive: true, isPercentage: false });
  for (const amount of ['', '-1', 'Infinity', '1.999']) expect(() => buildBody(fee, { name: 'Fee', amount })).toThrow();
  expect(() => buildBody(fee, { name: 'Fee', amount: 101, isPercentage: true })).toThrow();
});
it('validates IPv4 IPv6 and CIDR without accepting hostnames or injection', () => {
  for (const ip of ['192.0.2.1', '192.0.2.0/24', '2001:db8::1', '2001:db8::/32', '::1']) expect(validIp(ip)).toBe(true);
  for (const ip of ['999.1.1.1', 'example.com', '1.2.3.4/33', '::1/129', '1.2.3.4/24/7', 'javascript:alert(1)', '1.2.3.04']) expect(validIp(ip)).toBe(false);
});
it('normalizes country lists but does not invent a boolean SMS setting', () => {
  const action: Action = { title: 'SMS', path: 'security/sms-country-mode', method: 'POST', kind: 'sms', fields: [{ key: 'mode', label: 'Mode', type: 'text', required: true }, { key: 'countries', label: 'Countries', type: 'text' }], initial: {} };
  expect(buildBody(action, { mode: 'Whitelist', countries: 'ae, az, AE' })).toEqual({ mode: 'Whitelist', countries: ['AE', 'AZ'] });
  expect(() => buildBody(action, { mode: 'Whitelist', countries: 'XYZ' })).toThrow();
});
it('rechecks cleaning status before cancellation', async () => {
  const action: Action = { title: 'Cancel', path: 'cleanings/1/cancel', method: 'PUT', fields: [], initial: {}, kind: 'cleaning' };
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 1, status: 'Completed' });
  await expect(execute(action, {})).rejects.toThrow('no longer cancellable');
  expect(apiRequest).toHaveBeenCalledTimes(1);
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 1, status: 'Scheduled' }).mockResolvedValueOnce({ success: true });
  await execute(action, {});
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/cleanings/1/cancel', expect.objectContaining({ method: 'PUT', body: '{}' }));
});
it('does not duplicate an existing blocked IP', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([{ entry: '192.0.2.1' }]);
  await expect(execute({ title: 'Block', path: 'security/block-ip', method: 'POST', fields: [], initial: {}, kind: 'ip' }, { entry: '192.0.2.1' })).rejects.toThrow('already blocked');
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it('validates permission catalogue and never changes the super-admin flag', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([{ id: 1, code: 'cars.view' }]).mockResolvedValueOnce({ adminId: 'other', isSuperAdmin: false, permissionCodes: [] }).mockResolvedValueOnce({ success: true });
  await savePermissions('other', ['cars.view', 'cars.view']);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/permissions/admins/other', { method: 'PUT', body: '{"permissionCodes":["cars.view"]}' });
  vi.mocked(apiRequest).mockResolvedValueOnce([{ id: 1, code: 'cars.view' }]).mockResolvedValueOnce({ adminId: 'root', isSuperAdmin: true, permissionCodes: [] });
  await expect(savePermissions('root', [])).rejects.toThrow('Super admins');
});
