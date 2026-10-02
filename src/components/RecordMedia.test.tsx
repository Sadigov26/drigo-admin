import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Fields } from '../fleet/FleetShared';
import { RecordMedia, RecordLink } from './RecordMedia';
afterEach(cleanup);
it('shows separate labelled record cards without printing photo addresses', () => {
  const url = 'https://example.com/photo.jpg';
  const { container } = render(<Fields row={{ devices: [{ id: 1, plateNumber: 'A123', online: true }, { id: 2, plateNumber: 'B456', online: false }], media: [{ url }] }} />);
  expect(container.querySelectorAll('.fleet-record-card')).toHaveLength(3);
  expect(screen.getByText('#1')).toBeTruthy();
  expect(screen.getByText('#2')).toBeTruthy();
  expect(screen.getByText('Online', { selector: '.status-badge' })).toBeTruthy();
  expect(screen.getByText('Offline')).toBeTruthy();
  expect(screen.queryByText(url)).toBeNull();
  expect(screen.getByRole('img').getAttribute('src')).toBe(url);
});
it('handles failed media and rejects unsafe links', () => {
  render(<><RecordMedia value="https://example.com/missing.jpg" /><RecordLink value="javascript:alert(1)" /></>);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Image unavailable')).toBeTruthy();
  expect(screen.getByText('Attachment unavailable')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});
