import { useEffect, useState } from 'react';
import { defaultSettings, getBlogSettings, getCurrentTeamRole, saveBlogSettings } from './adminSettingsServices';
import type { BlogSettings } from './adminSettingsServices';
import './settingsUsers.css';

export function SettingsPanel() {
  const [settings, setSettings] = useState<BlogSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<'admin' | 'author' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getCurrentTeamRole().then(async access => {
      if (active) setRole(access);
      if (access === 'admin') {
        const saved = await getBlogSettings();
        if (active) setSettings(saved);
      }
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as configurações.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = <K extends keyof BlogSettings>(key: K, value: BlogSettings[K]) =>
    setSettings(current => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try { const saved = await saveBlogSettings(settings); setSettings(saved); setMessage('Configurações salvas.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  return <section className="folio-admin-panel" aria-labelledby="blog-settings-title">
    <header className="folio-panel-heading"><div><p className="folio-eyebrow">Blog</p><h2 id="blog-settings-title">Configurações</h2><p>Identidade e preferências editoriais do blog.</p></div></header>
    {loading ? <p role="status">Carregando configurações…</p> : role !== 'admin' ? <div className="folio-card" role="status"><h3>Acesso restrito</h3><p>Somente administradores podem alterar as configurações do blog.</p></div> :
      <form onSubmit={event => void save(event)}>
        <div className="folio-panel-grid">
          <div className="folio-card"><h3>Identidade</h3>
            <label htmlFor="folio-blog-name">Nome do blog</label><input id="folio-blog-name" required maxLength={120} value={settings.blog_name} onChange={event => update('blog_name', event.target.value)} />
            <label htmlFor="folio-tagline">Assinatura</label><input id="folio-tagline" maxLength={240} placeholder="Uma linha sobre o blog" value={settings.tagline} onChange={event => update('tagline', event.target.value)} />
            <label htmlFor="folio-description">Descrição</label><textarea id="folio-description" rows={4} maxLength={2000} value={settings.description} onChange={event => update('description', event.target.value)} />
          </div>
          <div className="folio-card"><h3>Publicação</h3>
            <label htmlFor="folio-contact-email">E-mail de contato</label><input id="folio-contact-email" type="email" value={settings.contact_email} onChange={event => update('contact_email', event.target.value)} />
            <label htmlFor="folio-posts-per-page">Matérias por página</label><input id="folio-posts-per-page" type="number" min={3} max={40} step={1} value={settings.posts_per_page} onChange={event => update('posts_per_page', Number(event.target.value))} />
            <p className="folio-note">Nome, assinatura, descrição e quantidade de matérias por página são aplicados à listagem pública. O e-mail de contato fica restrito ao painel.</p>
          </div>
        </div>
        <div className="folio-panel-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</button></div>
      </form>}
    {message && <p role="status" className="folio-feedback">{message}</p>}
  </section>;
}
