const paths = {
  image: 'M3 3h18v18H3V3Z M3 16l5-5 4 4 3-3 6 6 M16 7h.01',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M18 17a7 7 0 0 1-12 1l-2-3',
  plus: 'M12 5v14 M5 12h14',
  edit: 'm15 5 4 4 M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  close: 'm6 6 12 12 M18 6 6 18',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  car: 'm5 7 2-4h10l2 4 M3 7h18v11H3V7Z M6 18v3 M18 18v3 M6 11h2 M16 11h2',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z M9 3v16 M15 5v16',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  power: 'M12 2v10 M6 5a9 9 0 1 0 12 0',
  lock: 'M6 10h12v11H6V10Z M8 10V6a4 4 0 0 1 8 0v4',
  unlock: 'M6 10h12v11H6V10Z M8 10V6a4 4 0 0 1 8 0',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  history: 'M3 3v6h6 M3 9a9 9 0 1 1 0 6 M12 7v5l3 2',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Z M8 7h8 M8 11h8 M8 15h4',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return <svg className="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
