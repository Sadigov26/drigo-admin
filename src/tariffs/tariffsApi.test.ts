import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { deleteTariff, listTariffs, payload, saveTariff } from './tariffsApi';
import type { TariffDraft } from './tariffsApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const draft: TariffDraft = { name: 'Plan', description: 'Description', price: '35', unitCount: '1', timeUnit: 'Hour', currency: 'AED', isActive: true };
beforeEach(() => vi.resetAllMocks());
it('uses singular package creation and plural update/delete endpoints', async () => {
  await saveTariff('tariff-packages', draft);
  expect(request.mock.calls[0][0]).toBe('/api/admin/tariff-package');
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ unitCount: 1, timeUnit: 'Hour', price: 35, currency: 'AED', isActive: true });
  await saveTariff('tariff-packages', draft, 1);
  expect(request.mock.calls[1][0]).toBe('/api/admin/tariff-packages/1');
  await deleteTariff('tariff-packages', 1);
  expect(request.mock.calls[2][1]?.method).toBe('DELETE');
});
it('only sends supported plan/template fields, preserving nested data on edit', () => {
  expect(payload('tariff-templates', draft)).toEqual({ name: 'Plan', description: 'Description', isActive: true });
  expect(payload('tariff-plans', draft)).not.toHaveProperty('price');
});
it('does not invent distance CRUD or subscription writes', async () => {
  for (const resource of ['tariff-distances', 'insurances', 'subscription-plans', 'subscription-bookings'] as const) {
    await expect(saveTariff(resource, draft)).rejects.toThrow('read-only');
    await expect(deleteTariff(resource, 1)).rejects.toThrow('read-only');
  }
  expect(request).not.toHaveBeenCalled();
});
it('rejects blank, negative, fractional durations and invalid prices', () => {
  for (const unitCount of ['', '-1', '1.2', 'Infinity']) expect(() => payload('tariff-packages', { ...draft, unitCount })).toThrow();
  for (const price of ['', '-1', '1.234', 'Infinity']) expect(() => payload('tariff-packages', { ...draft, price })).toThrow();
  expect(() => payload('tariff-plans', { ...draft, name: ' ' })).toThrow();
});
it('loads array endpoints and every booking page', async () => {
  request.mockResolvedValueOnce([{ id: 1 }]);
  expect(await listTariffs('insurances')).toHaveLength(1);
  request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 2 });
  expect(await listTariffs('subscription-bookings')).toHaveLength(2);
  expect(request.mock.calls[2][0]).toContain('page=2');
});
it('rejects duplicates, changing totals and malformed rows', async () => {
  request.mockResolvedValueOnce([{ id: 1 }, { id: 1 }]);
  await expect(listTariffs('tariff-plans')).rejects.toThrow('changed');
  request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 3 });
  await expect(listTariffs('subscription-bookings')).rejects.toThrow('changed');
  request.mockResolvedValueOnce([{ name: 'Missing ID' }]);
  await expect(listTariffs('insurances')).rejects.toThrow('Invalid');
});
