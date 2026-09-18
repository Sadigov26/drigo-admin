import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import CarsModule from './CarsModule';
vi.mock('./Cars', () => ({ default: () => <p>Car list content</p> }));
vi.mock('./Tracking', () => ({ default: () => <p>Tracking content</p> }));
vi.mock('./ProblematicCars', () => ({ default: () => <p>Problematic content</p> }));
afterEach(cleanup);
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="url">{location.search}</output><button onClick={() => navigate(-1)}>Go back</button></>;
}
function setup(url: string) { render(<MemoryRouter initialEntries={[url]}><CarsModule /><Location /></MemoryRouter>); }
it('opens the deep-linked tab and preserves other query parameters', async () => {
  setup('/cars?view=tracking&source=fleet');
  await screen.findByText('Tracking content');
  fireEvent.click(screen.getByRole('button', { name: 'Problematic' }));
  await screen.findByText('Problematic content');
  expect(screen.getByTestId('url').textContent).toBe('?view=problems&source=fleet');
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  await screen.findByText('Tracking content');
  fireEvent.click(screen.getByRole('button', { name: 'All cars' }));
  expect(screen.getByTestId('url').textContent).toBe('?source=fleet');
});
it('falls back safely for unknown view values', () => {
  setup('/cars?view=unknown');
  expect(screen.getByText('Car list content')).toBeTruthy();
});
