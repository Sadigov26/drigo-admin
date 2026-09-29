import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { CustomerImage, date } from '../customers/CustomerDetails';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Icon } from '../components/Icon';
import { getAnalytics, safeUrl, type Section, type Values } from './promotionsApi';
import { usePromotionData } from './usePromotionData';

const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase());
function valueView(key: string, value: unknown, row: Values): ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'imageUrl' || (key === 'mediaUrl' && row.mediaType !== 'Video')) return <CustomerImage value={value} title={key === 'imageUrl' ? 'Promotion image' : 'Story image'} />;
  if (key === 'mediaUrl' && row.mediaType === 'Video') return safeUrl(value) ? <div><video controls preload="none" src={safeUrl(value)!} aria-label="Story video" /><a href={safeUrl(value)!} target="_blank" rel="noreferrer">Open video source</a></div> : 'Invalid media URL';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (/At$|Date$/.test(key)) return date(value);
  if (typeof value === 'number' && (key === 'value' || /Bonus$|Discounted$/.test(key))) return row.type === 'Percentage' || row.discountType === 'Percentage' ? `${value}%` : `${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(row.currency ?? 'AED')}`;
  if (typeof value === 'number' && key === 'conversionRate') return `${Math.round(value * 100)}%`;
  if (typeof value === 'number' && key === 'completionRate') return `${value}%`;
  if (Array.isArray(value)) return value.length ? <div className="promotion-nested">{value.map((item, index) => <div key={index}>{item && typeof item === 'object' ? <PromotionFields row={item as Values} /> : String(item ?? '—')}</div>)}</div> : <EmptyState message="No items." />;
  if (typeof value === 'object') return <PromotionFields row={value as Values} />;
  return String(value);
}
export function PromotionFields({ row }: { row: Values }) {
  return <dl className="promotion-detail-fields">{Object.entries(row).map(([key, value]) => <div key={key} className={typeof value === 'object' && value !== null || /Url$/.test(key) ? 'promotion-wide' : undefined}><dt>{label(key)}</dt><dd>{valueView(key, value, row)}</dd></div>)}</dl>;
}
export function Analytics({ section, id }: { section: Extract<Section, 'discounts' | 'stories'>; id: number }) {
  const state = usePromotionData(useCallback((signal: AbortSignal) => getAnalytics(section, id, signal), [section, id]));
  return <section className="promotion-analytics"><div className="promotion-panel-heading"><h3>Analytics</h3><button onClick={state.refresh} disabled={state.loading}><Icon name="refresh" />Refresh analytics</button></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <PromotionFields row={state.data} />}</section>;
}
