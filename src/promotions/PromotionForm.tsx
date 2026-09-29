import { useState } from 'react';
import { Icon } from '../components/Icon';
import { CustomerImage } from '../customers/CustomerDetails';
import { campaignStatuses, storyStatuses, type Section, type Values } from './promotionsApi';

function utcInput(value: unknown) { const time = Date.parse(String(value ?? '')); return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 16) : ''; }
export function PromotionForm({ section, initial, busy, blocked, onSave, onCancel }: { section: Section | 'referrals'; initial?: Values; busy: boolean; blocked: boolean; onSave: (values: Values) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Values>(() => ({ title: '', name: '', code: '', description: '', actionType: 'None', frequency: 'Once', imageUrl: '', isActive: true,
    startDate: new Date().toISOString(), endDate: null, expiresAt: null, type: 'Percentage', discountType: 'Percentage', value: '', status: section === 'stories' ? 'Draft' : 'Active',
    targetAudience: 'All', scope: 'Global', usageLimit: null, maxRedemptions: null, items: [], ...initial }));
  const update = (key: string, value: unknown) => setValues(old => ({ ...old, [key]: value }));
  function input(key: string, label: string, type = 'text', required = true, maxLength = 120) {
    return <label key={key}>{label}<input type={type} required={required} maxLength={maxLength} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} value={String(values[key] ?? '')} onChange={event => update(key, event.target.value)} /></label>;
  }
  function select(key: string, label: string, choices: string[]) {
    return <label key={key}>{label}<select value={String(values[key] ?? '')} onChange={event => update(key, event.target.value)}>{!choices.includes(String(values[key])) && <option value={String(values[key] ?? '')}>{String(values[key] ?? 'Choose')}</option>}{choices.map(option => <option key={option}>{option}</option>)}</select></label>;
  }
  function dateInput(key: string, label: string, required = false) {
    return <label key={key}>{label} · UTC<input type="datetime-local" required={required} value={utcInput(values[key])} onChange={event => update(key, event.target.value ? `${event.target.value}:00.000Z` : null)} /></label>;
  }
  const active = <label className="promotion-check"><input type="checkbox" checked={values.isActive === true} onChange={event => update('isActive', event.target.checked)} />Enabled</label>;
  const items = Array.isArray(values.items) ? values.items as Values[] : [];
  const updateItem = (index: number, key: string, value: unknown) => update('items', items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  return <form className="promotion-form" onSubmit={event => { event.preventDefault(); onSave(values); }}><fieldset disabled={busy}>
    {section === 'referrals' ? <>{input('referrerBonus', 'Referrer bonus', 'number')}{input('refereeBonus', 'New customer bonus', 'number')}{input('minRentalsToQualify', 'Minimum qualifying rentals', 'number')}{select('currency', 'Currency', ['AED'])}{active}</> : <>
      {input(section === 'discounts' ? 'name' : section === 'promo-codes' ? 'code' : 'title', section === 'discounts' ? 'Name' : section === 'promo-codes' ? 'Code' : 'Title')}
      {(section === 'promotions' || section === 'promo-codes') && active}
      {section === 'promotions' && <><label className="promotion-wide">Description<textarea rows={3} maxLength={2000} value={String(values.description ?? '')} onChange={event => update('description', event.target.value)} /></label>{select('actionType', 'Action', ['None', 'OpenCar', 'OpenTariff', 'OpenUrl'])}{select('frequency', 'Frequency', ['Once', 'Daily', 'Always'])}{input('imageUrl', 'Image URL', 'url', true, 2048)}<CustomerImage value={values.imageUrl} title="Promotion preview" /></>}
      {(section === 'promotions' || section === 'discounts') && <>{dateInput('startDate', 'Starts', true)}{dateInput('endDate', 'Ends (optional)')}</>}
      {(section === 'discounts' || section === 'promo-codes') && <>{select(section === 'discounts' ? 'type' : 'discountType', 'Discount type', section === 'discounts' ? ['Percentage', 'FixedAmount', 'FixedPrice'] : ['Percentage', 'FixedAmount'])}{input('value', 'Value · % or AED', 'number')}{input(section === 'discounts' ? 'usageLimit' : 'maxRedemptions', 'Usage limit (blank = unlimited)', 'number', false)}</>}
      {section === 'discounts' && <>{select('status', 'Status', campaignStatuses)}{select('targetAudience', 'Audience', ['All', 'NewUsers', 'Specific', 'WithDebt'])}{select('scope', 'Scope', ['Global', 'Brand', 'Car', 'TariffPackage'])}</>}
      {section === 'promo-codes' && dateInput('expiresAt', 'Expires (optional)')}
      {section === 'stories' && <>{select('status', 'Status', storyStatuses)}{select('targetAudience', 'Audience', ['All', 'Verified'])}<section className="promotion-wide promotion-media-editor"><h3>Story media</h3>{items.map((item, index) => <div className="promotion-media-item" key={String(item.id)}><div className="promotion-panel-heading"><strong>Item {index + 1}</strong><button type="button" className="btn-soft-danger" onClick={() => update('items', items.filter((_, i) => i !== index))}><Icon name="trash" />Remove item {index + 1}</button></div><div className="promotion-fields"><label>Media type<select value={String(item.mediaType)} onChange={event => updateItem(index, 'mediaType', event.target.value)}><option>Image</option><option>Video</option></select></label><label>Duration · seconds<input type="number" required min={1} step={1} value={String(item.durationSec ?? '')} onChange={event => updateItem(index, 'durationSec', event.target.value)} /></label><label className="promotion-wide">Media URL<input type="url" required value={String(item.mediaUrl ?? '')} onChange={event => updateItem(index, 'mediaUrl', event.target.value)} /></label></div>{item.mediaType === 'Image' && <CustomerImage value={item.mediaUrl} title={`Item ${index + 1} preview`} />}</div>)}<button type="button" onClick={() => update('items', [...items, { id: Math.max(0, ...items.map(item => Number(item.id))) + 1, mediaType: 'Image', mediaUrl: '', durationSec: 5 }])}><Icon name="plus" />Add media item</button></section></>}
    </>}
  </fieldset><div className="promotion-form-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={busy || blocked}><Icon name="check" />{busy ? 'Saving…' : 'Save'}</button></div></form>;
}
