import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className={`cms-modal ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); closeRef.current(); }}>
    <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}
  </dialog>;
}
