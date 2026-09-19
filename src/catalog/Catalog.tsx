import { useCallback, useEffect, useRef, useState } from 'react';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { usePermissions } from '../permissions/PermissionsContext';
import { useVehicleResource } from '../cars/useVehicleResource';
import { createBrand, createColor, createModel, deleteBrand, getBrands, getColors, getModels, validHex } from './catalogApi';
import type { Brand, Model } from './catalogApi';
import './catalog.css';

type Action = { kind: 'brand' } | { kind: 'model' | 'color' | 'delete'; brand: Brand };

function BrandContents({ brand, revision, onAdd, onAddColor }: { brand: Brand; revision: number; onAdd?: () => void; onAddColor?: () => void }) {
  const loadModels = useCallback((signal: AbortSignal) => getModels(brand.id, signal), [brand.id, revision]);
  const loadColors = useCallback((signal: AbortSignal) => getColors(brand.id, signal), [brand.id, revision]);
  const models = useVehicleResource(loadModels);
  const colors = useVehicleResource(loadColors);
  const [colorSearch, setColorSearch] = useState('');
  const [colorPage, setColorPage] = useState(1);
  const filteredColors = (colors.data ?? []).filter(color => `${color.name} ${color.hexCode}`.toLowerCase().includes(colorSearch.trim().toLowerCase()));
  const colorPages = Math.max(1, Math.ceil(filteredColors.length / 6));
  const currentColorPage = Math.min(colorPage, colorPages);
  return <section className="catalog-details" aria-label={`${brand.name} details`}>
    <header><h2>{brand.name} models</h2>{onAdd && <button onClick={onAdd}>Add model</button>}</header>
    {models.loading ? <LoadingState /> : models.error ? <ErrorState message={models.error} onRetry={models.refresh} /> : models.data?.length ? <ul>{models.data.map(model => <li key={model.id}>{model.name}</li>)}</ul> : <EmptyState message="No models yet." />}
    <header><h3>Colors</h3>{onAddColor && <button onClick={onAddColor}>Add color</button>}</header>
    <label className="catalog-color-search">Search colors<input type="search" value={colorSearch} onChange={event => { setColorSearch(event.target.value); setColorPage(1); }} /></label>
    {colors.loading ? <LoadingState /> : colors.error ? <ErrorState message={colors.error} onRetry={colors.refresh} /> : filteredColors.length ? <ul className="catalog-colors">{filteredColors.slice((currentColorPage - 1) * 6, currentColorPage * 6).map(color => <li key={color.id}><span className="color-swatch" style={{ backgroundColor: color.hexCode }} aria-hidden="true" />{color.name} <small>{color.hexCode}</small></li>)}</ul> : <EmptyState message={colorSearch ? 'No matching colors.' : 'No colors for this brand.'} />}
    {!colors.loading && !colors.error && <div className="table-pagination"><span>{filteredColors.length} colors</span><div><button disabled={currentColorPage <= 1} onClick={() => setColorPage(currentColorPage - 1)}>Previous colors</button><span>{currentColorPage} / {colorPages}</span><button disabled={currentColorPage >= colorPages} onClick={() => setColorPage(currentColorPage + 1)}>Next colors</button></div></div>}
  </section>;
}

export default function Catalog() {
  const { can } = usePermissions();
  const brands = useVehicleResource(getBrands);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Brand | null>(null);
  const [revision, setRevision] = useState(0);
  const [counts, setCounts] = useState<Record<number, number | null>>({});
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState('');
  const [hexCode, setHexCode] = useState('#1E3A8A');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const filtered = (brands.data ?? []).filter(brand => brand.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name) * (order === 'asc' ? 1 : -1));
  const visible = filtered.slice((page - 1) * 10, page * 10).map(brand => ({ ...brand, actions: '' }));
  const visibleIds = visible.map(brand => brand.id).join(',');
  useEffect(() => {
    const controller = new AbortController();
    setCounts({});
    void Promise.all(visibleIds.split(',').filter(Boolean).map(async key => {
      const brandId = Number(key);
      let models: Model[] | null = null;
      try { models = await getModels(brandId, controller.signal); } catch { /* A failed count must not become zero. */ }
      if (!controller.signal.aborted) setCounts(previous => ({ ...previous, [brandId]: models?.length ?? null }));
    }));
    return () => controller.abort();
  }, [visibleIds, revision, brands.updatedAt]);
  function open(next: Action) { setAction(next); setName(''); setHexCode('#1E3A8A'); setError(''); }
  function close() { if (!lock.current) { if (action) setAction(null); else setSelected(null); } }
  async function submit() {
    if (!action || lock.current || !can(action.kind === 'delete' ? 'cars.delete' : 'cars.create')) return;
    if (action.kind !== 'delete' && !name.trim()) { setError('Enter a name.'); return; }
    if (action.kind === 'color' && !validHex(hexCode.trim())) { setError('Enter a six-digit hex code, such as #1E3A8A.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      if (action.kind === 'brand') await createBrand(name);
      else if (action.kind === 'model') await createModel(action.brand.id, name);
      else if (action.kind === 'color') await createColor(action.brand.id, name, hexCode);
      else await deleteBrand(action.brand.id);
      if (alive.current) {
        if (action.kind === 'delete' && selected?.id === action.brand.id) setSelected(null);
        setAction(null); setNotice(action.kind === 'delete' ? 'Brand deleted.' : 'Saved successfully.');
        setRevision(value => value + 1); brands.refresh();
      }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to save changes.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="catalog-page">
    <header><div><h1>Brands & models</h1><p>Vehicle catalog</p></div><div className="catalog-actions"><button disabled={brands.loading} onClick={brands.refresh}>Refresh brands</button>{can('cars.create') && <button onClick={() => open({ kind: 'brand' })}>Add brand</button>}</div></header>
    {notice && <p role="status">{notice}</p>}
    <Table caption="Brands" columns={[
      { key: 'name', label: 'Brand', sortable: true, render: brand => <button className="catalog-link" aria-expanded={selected?.id === brand.id} onClick={() => setSelected(selected?.id === brand.id ? null : brand)}>{brand.name}</button> },
      { key: 'id', label: 'Models', render: brand => counts[brand.id] === undefined ? 'Loading…' : counts[brand.id] === null ? 'Unavailable' : counts[brand.id] },
      { key: 'actions', label: 'Actions', render: brand => can('cars.delete') ? <button onClick={() => open({ kind: 'delete', brand })} aria-label={`Delete ${brand.name}`}>Delete</button> : '—' },
    ]} data={visible} rowKey={brand => brand.id} total={filtered.length} page={page} pageSize={10} loading={brands.loading} error={brands.error || null} search={search} sortBy="name" sortOrder={order} onSearch={setSearch} onSort={(_, next) => setOrder(next)} onPageChange={setPage} onRetry={brands.refresh}
      filters={<label>Sort by<select value={order} onChange={event => { setOrder(event.target.value as 'asc' | 'desc'); setPage(1); }}><option value="asc">Brand name · A–Z</option><option value="desc">Brand name · Z–A</option></select></label>} />
    <Modal isOpen={action != null || selected != null} title={action?.kind === 'delete' ? 'Delete brand' : action?.kind === 'model' ? `Add model · ${action.brand.name}` : action?.kind === 'color' ? `Add color · ${action.brand.name}` : action?.kind === 'brand' ? 'Add brand' : `${selected?.name ?? ''} · Models & colors`} onClose={close}>
      {!action && selected ? <BrandContents key={selected.id} brand={selected} revision={revision} onAdd={can('cars.create') ? () => open({ kind: 'model', brand: selected }) : undefined} onAddColor={can('cars.create') ? () => open({ kind: 'color', brand: selected }) : undefined} /> : <form className="catalog-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        {action?.kind === 'delete' ? <p>Delete <strong>{action.brand.name}</strong>? This cannot be undone.</p> : <label>Name<input autoFocus required maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>}
        {action?.kind === 'color' && <div className="color-entry"><label>Hex code<input required maxLength={7} placeholder="#1E3A8A" value={hexCode} disabled={busy} onChange={event => setHexCode(event.target.value)} /></label>{validHex(hexCode.trim()) && <span className="color-swatch" role="img" aria-label={`Color preview ${hexCode.trim()}`} style={{ backgroundColor: hexCode.trim() }} />}</div>}
        {error && <p role="alert" className="error-message">{error}</p>}
        <div className="catalog-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : action?.kind === 'delete' ? 'Confirm delete' : 'Save'}</button></div>
      </form>}
    </Modal>
  </section>;
}
