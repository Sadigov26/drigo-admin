import type { ReactNode } from 'react';
import { RecordMedia, RecordLink } from '../components/RecordMedia';
import { CustomerImage, date } from '../customers/CustomerDetails';
import { StatusBadge } from '../components/StatusBadge';

export const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'AED' }).format(value) : '—';
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase());
const imageField = (key: string) => /^(photo|profilePhoto|image|thumbnail|medium)Url$/.test(key);
function value(key: string, item: unknown): ReactNode {
  if (imageField(key)) return <CustomerImage value={item} title={label(key.replace(/Url$/, ''))} portrait={/photo/i.test(key)} />;
  if (typeof item === 'string' && /^https?:\/\//i.test(item)) return /photo|image|thumbnail|medium|media|^url$/i.test(key) ? <RecordMedia value={item} /> : <RecordLink value={item} />;
  if (item === null || item === undefined || item === '') return '—';
  if (/^fuel(Level|Percentage)$/i.test(key)) return typeof item === 'number' && Number.isFinite(item) ? `${Math.round(item)}%` : '—';
  if (/^(maxSpeed|speed)$/.test(key)) return typeof item === 'number' && Number.isFinite(item) ? `${Math.round(item)} km/h` : '—';
  if (key === 'colorHexCode' && typeof item === 'string' && /^#[\da-f]{6}$/i.test(item)) return <span className="incident-color"><span aria-hidden="true" style={{ backgroundColor: item }} />{item}</span>;
  if (key === 'status' || key === 'portalStatus') return <StatusBadge status={String(item)} />;
  if (/amount|cost|price/i.test(key)) return money(item);
  if (/At$|Date$/.test(key)) return date(item);
  if (typeof item === 'boolean') return item ? 'Yes' : 'No';
  if (Array.isArray(item)) return item.length ? <ul>{item.map((entry, i) => <li key={i}>{typeof entry === 'object' && entry ? <RecordDetails row={entry as Record<string, unknown>} /> : String(entry)}</li>)}</ul> : '—';
  if (typeof item === 'object') return <RecordDetails row={item as Record<string, unknown>} />;
  return String(item);
}
export function RecordDetails({ row }: { row: Record<string, unknown> }) {
  return <><dl className="incident-fields">{Object.entries(row).filter(([key]) => !['photos', 'attachments', 'fines', 'needsReview'].includes(key)).map(([key, item]) => <div key={key} className={imageField(key) ? 'incident-image-field' : undefined}><dt>{label(imageField(key) ? key.replace(/Url$/, '') : key)}</dt><dd>{value(key, item)}</dd></div>)}</dl>
    {['photos', 'attachments'].filter(key => key in row).map(key => <section key={key}><h3>{label(key)}</h3><div className="incident-photos">{Array.isArray(row[key]) && row[key].length ? (row[key] as unknown[]).map((url, i) => <CustomerImage key={i} title={`${label(key)} ${i + 1}`} value={url} />) : <p>No images available.</p>}</div></section>)}
  </>;
}
