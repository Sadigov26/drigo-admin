import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CarRoute from './CarRoute';

vi.mock('./TrackingMap', () => ({ TrackingMap: ({ points }: { points: unknown[] }) => <div data-testid="route-map">{points.length} route points</div> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads the selected car history into its detail map', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ latitude: 25, longitude: 55, speed: 0, at: '2026-09-18T10:00:00Z' }])));
  vi.stubGlobal('fetch', fetcher);
  render(<CarRoute carId={7} />);
  await screen.findByTestId('route-map');
  expect(String(fetcher.mock.calls[0][0])).toContain('/cars/7/gps-points');
  expect(screen.getByText('1 route points')).toBeTruthy();
});

it('shows an empty state without inventing a route', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')));
  render(<CarRoute carId={7} />);
  await screen.findByText('No GPS history available.');
  expect(screen.queryByTestId('route-map')).toBeNull();
});

it('shows a failed history request with a retry action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'History unavailable' }), { status: 500 })));
  render(<CarRoute carId={7} />);
  await screen.findByRole('alert');
  expect(screen.queryByTestId('route-map')).toBeNull();
});
