import { apiRequest } from '../api/client';

export type Brand = { id: number; name: string };
export type Model = Brand & { brandId: number };
export type Color = Model & { hexCode: string };
export const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid catalog response.');
  return value as Record<string, unknown>;
}
function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Invalid catalog ID.');
  return value;
}
export function parseBrand(value: unknown): Brand {
  const row = record(value);
  if (typeof row.name !== 'string' || !row.name.trim()) throw new Error('Invalid catalog name.');
  return { id: id(row.id), name: row.name };
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid catalog list.');
  return value;
}
export function parseModels(value: unknown, brandId: number): Model[] {
  return rows(value).map(value => {
    const row = record(value);
    if (row.brandId !== brandId) throw new Error('Model belongs to a different brand.');
    return { ...parseBrand(row), brandId };
  });
}
export async function getBrands(signal?: AbortSignal): Promise<Brand[]> {
  const result: Brand[] = [];
  const seen = new Set<number>();
  // Search is not supported by this endpoint. Collect complete pages before filtering.
  for (let page = 1; page <= 100; page++) {
    const response = record(await apiRequest<unknown>(`/api/admin/brands?page=${page}&pageSize=100`, { signal }));
    if (typeof response.total !== 'number' || !Number.isSafeInteger(response.total) || response.total < 0) throw new Error('Invalid brand total.');
    const batch = rows(response.data).map(parseBrand);
    for (const brand of batch) {
      if (seen.has(brand.id)) throw new Error('Brand list changed. Please refresh.');
      seen.add(brand.id); result.push(brand);
    }
    if (result.length >= response.total) return result;
    if (!batch.length) throw new Error('Incomplete brand list. Please refresh.');
  }
  throw new Error('Brand list is too large to search locally.');
}
export async function getModels(brandId: number, signal?: AbortSignal) {
  return parseModels(await apiRequest<unknown>(`/api/admin/brands/${brandId}/models`, { signal }), brandId);
}
function parseColor(value: unknown, brandId: number): Color {
    const row = record(value);
    if (row.brandId !== brandId || typeof row.hexCode !== 'string' || !validHex(row.hexCode)) throw new Error('Invalid color response.');
    return { ...parseBrand(row), brandId, hexCode: row.hexCode };
}
export async function getColors(brandId: number, signal?: AbortSignal): Promise<Color[]> {
  return rows(await apiRequest<unknown>(`/api/admin/brands/${brandId}/colors`, { signal })).map(value => parseColor(value, brandId));
}
export async function createColor(brandId: number, name: string, hexCode: string) {
  if (!name.trim() || !validHex(hexCode.trim())) throw new Error('Enter a name and a six-digit hex code, such as #1E3A8A.');
  return parseColor(await apiRequest<unknown>(`/api/admin/brands/${brandId}/colors`, {
    method: 'POST', body: JSON.stringify({ name: name.trim(), hexCode: hexCode.trim().toUpperCase() }),
  }), brandId);
}
export async function createBrand(name: string) {
  return parseBrand(await apiRequest<unknown>('/api/admin/brands', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }));
}
export async function createModel(brandId: number, name: string) {
  const value = await apiRequest<unknown>(`/api/admin/brands/${brandId}/models`, { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
  return parseModels([value], brandId)[0];
}
export async function deleteBrand(brandId: number) {
  const response = record(await apiRequest<unknown>(`/api/admin/brands/${brandId}`, { method: 'DELETE' }));
  if (response.success !== true) throw new Error('Deletion was not confirmed. Refresh before retrying.');
}
