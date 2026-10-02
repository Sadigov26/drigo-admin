import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CarJourneys from './CarJourneys';
import { getHistoryRoutes, getHistoryPoints } from './telematicsApi';
vi.mock('./TrackingMap', () => ({ TrackingMap: ({ points }: { points: unknown[] }) => <div>Map points: {points.length}</div> }));
const json = (data: unknown) => new Response(JSON.stringify(data));
const journey = { routeId: 100, date: '2026-10-01T00:00:00Z', distanceKm: 12, durationMin: 20, startAddress: 'Dubai', endAddress: 'Marina' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('loads journey history then selected points without mutations', async () => {
  const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(json(url.includes('history-routes') ? { carId: 1, routes: [journey] } : { routeId: 100, points: [{ latitude: 25, longitude: 55, speed: 10, at: journey.date }] })));
  vi.stubGlobal('fetch', fetcher);
  render(<CarJourneys carId={1} />);
  fireEvent.click(await screen.findByRole('button', { name: '#100' }));
  expect(await screen.findByText('Map points: 1')).toBeTruthy();
  expect(fetcher.mock.calls[1][0]).toContain('/cars/routes/100/points');
  expect(fetcher.mock.calls.every(call => !call[1].method)).toBe(true);
});
it('rejects history or points from another record', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ carId: 2, routes: [] })).mockResolvedValueOnce(json({ routeId: 200, points: [] })));
  await expect(getHistoryRoutes(1, new AbortController().signal)).rejects.toThrow('match');
  await expect(getHistoryPoints(100, new AbortController().signal)).rejects.toThrow('match');
});
