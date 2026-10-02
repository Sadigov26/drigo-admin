import { useState } from 'react';
import { Modal } from './Modal';
import './recordMedia.css';

export function RecordMedia({ value, title = 'Photo' }: { value: string; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  let safe = false;
  try { safe = ['https:', 'http:'].includes(new URL(value).protocol); } catch { /* Invalid media is not loaded. */ }
  if (!safe || failed) return <span className="record-media-missing">Image unavailable</span>;
  return <><button type="button" className="record-media" aria-label={`Enlarge ${title}`} onClick={() => setExpanded(true)}><img src={value} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /><span>Enlarge photo</span></button><Modal isOpen={expanded} title={title} onClose={() => setExpanded(false)}><img className="record-media-expanded" src={value} alt={title} referrerPolicy="no-referrer" /></Modal></>;
}

export function RecordLink({ value }: { value: string }) {
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol)) return <a href={url.href} target="_blank" rel="noopener noreferrer">Open attachment</a>; } catch { /* No unsafe links. */ }
  return <span>Attachment unavailable</span>;
}
