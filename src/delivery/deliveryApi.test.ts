import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { available, canAssign, canCancel, list, remove, reservationAction, save, validate } from './deliveryApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
beforeEach(() => request.mockReset());
describe('delivery contracts', () => {
  it('loads complete snapshots and rejects duplicate/incomplete pages', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 2 });
    expect(await list('reservations')).toHaveLength(2);
    request.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 1 }], total: 2 });
    await expect(list('deliveryZones')).rejects.toThrow('Incomplete');
  });
  it('does not mistake busy/offline or assigned records for available ones', () => {
    expect(available({ id: 1, status: 'Online', isActive: true, activeDeliveries: 0 })).toBe(true);
    expect(available({ id: 1, status: 'Busy', isActive: true, activeDeliveries: 1 })).toBe(false);
    expect(canAssign({ id: 1, status: 'Confirmed', driver: null })).toBe(true);
    expect(canAssign({ id: 1, status: 'Confirmed', driver: { id: 1 } })).toBe(false);
    expect(canCancel({ id: 1, status: 'Completed' })).toBe(false);
    expect(canCancel({ id: 1, status: 'Delivered' })).toBe(true);
  });
  it('preflights assignment and sends the exact body', async () => {
    const row = { id: 1, status: 'Pending', driver: null };
    request.mockResolvedValueOnce(row).mockResolvedValueOnce({ id: 2, status: 'Online', isActive: true, activeDeliveries: 0 }).mockResolvedValueOnce([]).mockResolvedValueOnce({ success: true });
    await reservationAction(row, 'assign-driver', 2);
    expect(request).toHaveBeenLastCalledWith('/api/admin/reservations/1/assign-driver', { method: 'POST', body: '{"driverId":2}' });
  });
  it('blocks stale reservation actions before POST', async () => {
    request.mockResolvedValueOnce({ id: 1, status: 'Completed' });
    await expect(reservationAction({ id: 1, status: 'Pending' }, 'cancel', 'reason')).rejects.toThrow('changed');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('blocks a driver already in the active deliveries feed', async () => {
    const row = { id: 1, status: 'Confirmed' };
    request.mockResolvedValueOnce(row).mockResolvedValueOnce({ id: 2, status: 'Online', isActive: true, activeDeliveries: 0 }).mockResolvedValueOnce([{ id: 99, driverId: 2 }]);
    await expect(reservationAction(row, 'assign-driver', 2)).rejects.toThrow('no longer available');
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('validates coordinates and excludes generated fields from create', async () => {
    expect(() => validate('deliveryZones', { name: 'Marina', centerLat: 200, centerLng: 55, radiusKm: 4 })).toThrow('latitude');
    expect(() => validate('deliveryZones', { name: 'Marina', centerLat: '', centerLng: 55, radiusKm: 4 })).toThrow('latitude');
    request.mockResolvedValueOnce({ id: 4 });
    await save('deliveryDrivers', { fullName: 'Test Driver', phoneNumber: '+971500000000', email: '', status: 'Offline', zoneId: null, isActive: true, rating: 100 });
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body).toEqual({ fullName: 'Test Driver', phoneNumber: '+971500000000', email: '', zoneId: null });
  });
  it('blocks deleting drivers with active deliveries', async () => {
    request.mockResolvedValueOnce({ id: 1, activeDeliveries: 1 });
    await expect(remove('deliveryDrivers', { id: 1 })).rejects.toThrow('active deliveries');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('blocks deleting zones referenced by drivers', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 1, driverIds: [] }], total: 1 }).mockResolvedValueOnce({ data: [{ id: 2, zoneId: 1 }], total: 1 });
    await expect(remove('deliveryZones', { id: 1 })).rejects.toThrow('assigned drivers');
  });
});
