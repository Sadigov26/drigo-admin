import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecordDetails } from './RecordDetails';
afterEach(cleanup);
it('formats fuel as a whole percentage without changing the source data', () => {
  const row = { fuelLevel: 19.960000000000004, fuelPercentage: 0, activeRentalId: null, maxSpeed: 225 };
  render(<RecordDetails row={row} />);
  expect(screen.getByText('20%')).toBeTruthy();
  expect(screen.getByText('0%')).toBeTruthy();
  expect(screen.getByText('225 km/h')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(row.fuelLevel).toBe(19.960000000000004);
});
it('renders a safe photo inline with enlarge and failed-image states', () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  render(<RecordDetails row={{ photoUrl: 'https://example.test/driver.jpg' }} />);
  const image = screen.getByAltText('Photo');
  expect(image.getAttribute('src')).toBe('https://example.test/driver.jpg');
  expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(screen.queryByText('https://example.test/driver.jpg')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Enlarge photo' }));
  expect(screen.getByAltText('Photo enlarged')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  fireEvent.error(image);
  expect(screen.getByText('Image could not be loaded.')).toBeTruthy();
});
it('preserves nested scalar, array and null field labels', () => {
  const { container } = render(<RecordDetails row={{ id: 1, user: { fullName: 'A Customer', email: null }, car: { plateNumber: 'ABC', fuelLevel: 40.2 }, driver: null, driverIds: [2, 3], createdAt: '2026-09-25T00:00:00Z' }} />);
  expect(Array.from(container.querySelectorAll('dt')).map(node => node.textContent)).toEqual(['Id', 'User', 'Full Name', 'Email', 'Car', 'Plate Number', 'Fuel Level', 'Driver', 'Driver Ids', 'Created At']);
  expect(screen.getByText('ABC')).toBeTruthy();
  expect(screen.getByText('40%')).toBeTruthy();
});
