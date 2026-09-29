import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { buildPayload, changeStatus, displayStatus, listRecords, safeUrl, saveRecord } from './promotionsApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const discount = { name: 'Offer', startDate: '2026-09-01T00:00:00Z', endDate: null, type: 'Percentage', value: 10, status: 'Active', targetAudience: 'All', scope: 'Global', usageLimit: null };
it('derives campaign availability without overriding backend discount status', () => {
  const now = Date.parse('2026-09-28T00:00:00Z');
  expect(displayStatus('promotions', { isActive: false }, now)).toBe('Paused');
  expect(displayStatus('promotions', { isActive: true, startDate: '2026-10-01' }, now)).toBe('Scheduled');
  expect(displayStatus('promo-codes', { isActive: true, expiresAt: '2026-01-01' }, now)).toBe('Expired');
  expect(displayStatus('discounts', { ...discount, endDate: '2026-01-01' }, now)).toBe('Active');
});
it('collects complete paginated snapshots', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 2 });
  expect(await listRecords('promotions')).toHaveLength(2);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/promotions?page=2&pageSize=200', { signal: undefined });
});
it('rejects changing totals, duplicate IDs and incomplete lists', async () => {
  for (const second of [{ data: [{ id: 2 }], total: 3 }, { data: [{ id: 1 }], total: 2 }, { data: [], total: 2 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce(second);
    await expect(listRecords('discounts')).rejects.toThrow();
  }
});
it('accepts story array and passes cancellation', async () => {
  const signal = new AbortController().signal;
  vi.mocked(apiRequest).mockResolvedValue([{ id: 4 }]);
  expect(await listRecords('stories', signal)).toEqual([{ id: 4 }]);
  expect(apiRequest).toHaveBeenCalledWith('/api/admin/stories', { signal });
});
it('validates values, date ranges and whole-number limits before mutation', () => {
  for (const changes of [{ value: 0 }, { value: 101 }, { value: 1.234 }, { usageLimit: 1.5 }, { endDate: '2025-01-01' }, { name: '' }]) expect(() => buildPayload('discounts', { ...discount, ...changes })).toThrow();
  expect(buildPayload('discounts', { ...discount, id: 3, usedCount: 9 })).not.toHaveProperty('usedCount');
});
it('preserves media metadata and rejects unsafe media or empty published stories', () => {
  const story = { title: 'Story', status: 'Active', targetAudience: 'All', items: [{ id: 1, mediaType: 'Image', mediaUrl: 'https://example.com/a.png', durationSec: 5, viewCount: 8 }] };
  expect(buildPayload('stories', story)).toMatchObject({ items: [{ viewCount: 8 }] });
  expect(() => buildPayload('stories', { ...story, items: [] })).toThrow();
  expect(safeUrl('javascript:alert(1)')).toBeNull();
  expect(safeUrl('data:text/html,hello')).toBeNull();
});
it('sends explicit promo-code availability, never the blind toggle endpoint', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 1, isActive: true }).mockResolvedValueOnce({});
  await changeStatus('promo-codes', { id: 1, isActive: true });
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/promo-codes/1', { method: 'PUT', body: '{"isActive":false}' });
});
it('rejects stale status before sending a mutation', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ id: 1, status: 'Paused' });
  await expect(changeStatus('discounts', { id: 1, status: 'Active' })).rejects.toThrow('Status changed');
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it('validates referral amounts and only sends editable fields', () => {
  const referral = { referrerBonus: 0, refereeBonus: 30, currency: 'AED', minRentalsToQualify: 1, isActive: true, updatedAt: 'yesterday' };
  expect(buildPayload('referrals', referral)).not.toHaveProperty('updatedAt');
  expect(() => buildPayload('referrals', { ...referral, referrerBonus: -1 })).toThrow();
});
it('uses correct create and update verbs', async () => {
  await saveRecord('discounts', discount);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/discounts', expect.objectContaining({ method: 'POST' }));
  await saveRecord('discounts', discount, 9);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/discounts/9', expect.objectContaining({ method: 'PUT' }));
});
