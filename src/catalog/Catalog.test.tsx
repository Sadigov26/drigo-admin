import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Catalog from './Catalog';
import { createColor, createModel, deleteBrand, getBrands, getColors, parseModels, validHex } from './catalogApi';

vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
it('validates colors before sending and uses the brand-scoped endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ id: 3, brandId: 1, name: 'Navy', hexCode: '#1E3A8A' }));
  vi.stubGlobal('fetch', fetcher);
  await expect(createColor(1, 'Navy', 'invalid')).rejects.toThrow('six-digit');
  expect(fetcher).not.toHaveBeenCalled();
  await createColor(1, ' Navy ', '#1e3a8a');
  expect(String(fetcher.mock.calls[0][0])).toContain('/brands/1/colors');
  expect(fetcher.mock.calls[0][1].body).toBe('{"name":"Navy","hexCode":"#1E3A8A"}');
});
it('creates a color, refreshes its swatch and never offers color deletion', async () => {
  let added = false;
  const color = { id: 3, brandId: 1, name: 'Navy Blue', hexCode: '#1E3A8A' };
  const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/colors') && options?.method === 'POST') { added = true; return json(color); }
    if (url.endsWith('/colors')) return json(added ? [color] : []);
    if (url.includes('/brands?')) return json({ data: [{ id: 1, name: 'Toyota' }], total: 1 });
    return json([]);
  });
  vi.stubGlobal('fetch', fetcher); render(<Catalog />);
  fireEvent.click(await screen.findByRole('button', { name: 'Toyota' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add color' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Navy Blue' } });
  expect(screen.getByRole('img', { name: 'Color preview #1E3A8A' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Navy Blue');
  expect(screen.queryByRole('button', { name: /Delete.*Navy/ })).toBeNull();
  expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith('/colors') && call[1]?.method !== 'POST').length).toBeGreaterThanOrEqual(2);
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('collects all pages before client-side search', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ data: [{ id: 1, name: 'A' }], total: 2 })).mockResolvedValueOnce(json({ data: [{ id: 2, name: 'B' }], total: 2 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await getBrands()).toHaveLength(2);
  expect(String(fetcher.mock.calls[1][0])).toContain('page=2');
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
});
it('paginates and searches brand colors without a standalone colors endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/brands?')) return json({ data: [{ id: 1, name: 'Toyota' }], total: 1 });
    if (url.endsWith('/brands/1/colors')) return json(Array.from({ length: 7 }, (_, index) => ({ id: index + 1, brandId: 1, name: `Shade ${index + 1}`, hexCode: '#123456' })));
    return json([]);
  }));
  render(<Catalog />);
  fireEvent.click(await screen.findByRole('button', { name: 'Toyota' }));
  await screen.findByText('Shade 1');
  expect(screen.queryByText('Shade 7')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next colors' }));
  expect(screen.getByText('Shade 7')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search colors' }), { target: { value: 'Shade 2' } });
  expect(screen.getByText('Shade 2')).toBeTruthy();
  expect(screen.queryByText('Shade 7')).toBeNull();
});
it('rejects incomplete pages and wrong-brand models', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [], total: 2 })));
  await expect(getBrands()).rejects.toThrow('Incomplete');
  expect(() => parseModels([{ id: 1, name: 'A', brandId: 2 }], 1)).toThrow('different brand');
});
it('validates color CSS values before rendering', async () => {
  expect(validHex('#1E3A8A')).toBe(true);
  expect(validHex('url(evil)')).toBe(false);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ id: 1, name: 'Navy', brandId: 1, hexCode: 'red' }])));
  await expect(getColors(1)).rejects.toThrow('Invalid color');
});
it('sends a model to its brand and preserves conflict messages', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ id: 2, brandId: 1, name: 'New' })).mockResolvedValueOnce(json({ message: 'Brand has cars and cannot be deleted' }, 409));
  vi.stubGlobal('fetch', fetcher);
  await createModel(1, ' New ');
  expect(fetcher.mock.calls[0][1].body).toBe('{"name":"New"}');
  await expect(deleteBrand(1)).rejects.toThrow('Brand has cars');
});
it('searches brands, expands models and refreshes after creation', async () => {
  let added = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (options?.method === 'POST') { added = true; return json({ id: 2, name: 'New', brandId: 1 }); }
    if (url.includes('/brands?')) return json({ data: [{ id: 1, name: 'Toyota' }], total: 1 });
    if (url.endsWith('/colors')) return json([]);
    return json(added ? [{ id: 2, brandId: 1, name: 'New' }] : []);
  });
  vi.stubGlobal('fetch', fetcher); render(<Catalog />);
  fireEvent.click(await screen.findByRole('button', { name: 'Toyota' }));
  await screen.findByText('No models yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('New');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search brands' }), { target: { value: 'missing' } });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Toyota' })).toBeNull());
});
