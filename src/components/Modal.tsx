import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

type ModalProps = { isOpen: boolean; title: string; children: ReactNode; onClose: () => void };

export function Modal({ isOpen, title, children, onClose }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen || !dialog.current) return;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return createPortal(
    <dialog ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onPointerDown={event => { pressedBackdrop.current = event.target === event.currentTarget; }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (pressedBackdrop.current && event.target === event.currentTarget && outside) onClose();
        pressedBackdrop.current = false;
      }}>
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" />Close</button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>, document.body,
  );
}
