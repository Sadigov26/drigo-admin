import type { ReactNode } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { date } from '../customers/CustomerDetails';
import type { TariffRow } from './tariffsApi';

export const fieldLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
export function tariffValue(key: string, value: unknown, currency: unknown = 'AED'): ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'status') return <StatusBadge status={String(value)} />;
  if (/At$|Date$/.test(key)) return date(value);
  if (typeof value === 'number' && /price|deductible/i.test(key)) {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(currency) }).format(value); }
    catch { return `${value.toFixed(2)} ${String(currency)}`; }
  }
  if (typeof value === 'number' && key === 'includedKm') return `${value.toLocaleString('en-GB')} km`;
  if (Array.isArray(value)) return value.length ? <div className="tariff-nested">{value.map((entry, index) => <div key={index}>{entry && typeof entry === 'object' ? <TariffFields row={entry as TariffRow} /> : String(entry ?? '—')}</div>)}</div> : 'None';
  if (typeof value === 'object') return <TariffFields row={value as TariffRow} />;
  return String(value);
}
export function TariffFields({ row }: { row: TariffRow }) {
  return <dl className="tariff-fields">{Object.entries(row).map(([key, value]) => <div key={key} className={value && typeof value === 'object' ? 'tariff-wide' : undefined}><dt>{fieldLabel(key)}</dt><dd>{tariffValue(key, value, row.currency)}</dd></div>)}</dl>;
}
