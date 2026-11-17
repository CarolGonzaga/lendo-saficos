import { useState } from 'react';
import { uploadMedia } from '../services';
import { safeImage } from '../utils';

export function MediaUploader({ value, onChange, onBusy, label = 'Imagem' }: { value: string; onChange: (url: string) => void; onBusy: (busy: boolean) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="cms-media-upload"><label>{label}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setBusy(true); onBusy(true); setMessage('Preparando e enviando imagem…');
    try { const media = await uploadMedia(file); onChange(media.url); setMessage('Imagem enviada. Salve a matéria para associá-la.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao enviar imagem.'); }
    finally { setBusy(false); onBusy(false); }
  }} /></label>{safeImage(value) && <img src={safeImage(value)} alt={`Prévia: ${label}`} />}
    {busy && <progress aria-label="Enviando imagem" />}<label>Ou endereço da imagem<input value={value} onChange={event => onChange(event.target.value)} placeholder="https://… ou /images/…" /></label>
    {value && <button type="button" disabled={busy} onClick={() => onChange('')}>Remover da matéria</button>}<small role="status">{message || 'JPG, PNG, WebP ou GIF. Até 10 MB; imagens grandes são otimizadas.'}</small></div>;
}
