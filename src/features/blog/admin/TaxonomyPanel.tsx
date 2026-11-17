import { useCallback, useEffect, useState } from 'react';
import { createCategory, createTag, deleteCategory, deleteTag, getTaxonomy, renameCategory } from '../services';
import type { Category, Tag } from '../types';
import { slugify } from '../utils';
import './folio-panels.css';

export function TaxonomyPanel() {
  const [tab, setTab] = useState<'categories' | 'tags'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [tagName, setTagName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const taxonomy = await getTaxonomy();
    setCategories(taxonomy.categories);
    setTags(taxonomy.tags);
  }, []);
  useEffect(() => {
    let active = true;
    getTaxonomy().then(data => {
      if (active) { setCategories(data.categories); setTags(data.tags); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as taxonomias.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setFeedback(''); setError('');
    try { await operation(); await reload(); setFeedback(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'A operação falhou.'); }
    finally { setBusy(false); }
  };
  const clearCategory = () => { setName(''); setSlug(''); setDescription(''); setSlugEdited(false); setEditing(null); };
  const saveCategory = async () => {
    await run(async () => {
      if (editing) await renameCategory(editing.id, name);
      else await createCategory(name, slug, description);
      clearCategory();
    }, editing ? 'Categoria renomeada.' : 'Categoria criada.');
  };
  return <section className="folio-panel cms-admin" aria-label="Categorias e tags">
    <header className="folio-panel-heading"><div><p className="eyebrow">Organização</p><h1>Categorias e tags</h1><p>A estrutura que organiza o acervo e alimenta a navegação do blog.</p></div></header>
    <div className="folio-tabs" role="tablist" aria-label="Taxonomias">
      <button type="button" role="tab" id="folio-categories-tab" aria-controls="folio-categories-panel" aria-selected={tab === 'categories'} onClick={() => setTab('categories')}>Categorias ({categories.length})</button>
      <button type="button" role="tab" id="folio-tags-tab" aria-controls="folio-tags-panel" aria-selected={tab === 'tags'} onClick={() => setTab('tags')}>Tags ({tags.length})</button>
    </div>
    {loading && <p role="status">Carregando taxonomias…</p>}
    {error && <p className="folio-error" role="alert">{error} {loading ? null : <button type="button" onClick={() => void run(reload, 'Lista atualizada.')}>Tentar novamente</button>}</p>}
    {feedback && <p className="folio-success" role="status">{feedback}</p>}
    {!loading && <div id="folio-categories-panel" role="tabpanel" aria-labelledby="folio-categories-tab" hidden={tab !== 'categories'} className="folio-panel-grid">
      <form className="folio-panel-card" onSubmit={event => { event.preventDefault(); void saveCategory(); }}>
        <h2>{editing ? 'Renomear categoria' : 'Nova categoria'}</h2>
        <label>Nome<input required value={name} onChange={event => { setName(event.target.value); if (!slugEdited && !editing) setSlug(slugify(event.target.value)); }} placeholder="Romance" /></label>
        {!editing && <label>Slug<input required value={slug} onChange={event => { setSlug(slugify(event.target.value)); setSlugEdited(true); }} placeholder="romance" /><small>Usado no endereço da categoria.</small></label>}
        {!editing && <label>Descrição<textarea value={description} maxLength={500} onChange={event => setDescription(event.target.value)} placeholder="Opcional" /></label>}
        <div className="folio-form-actions"><button type="submit" className="button-primary" disabled={busy}>{editing ? 'Salvar nome' : '+ Criar categoria'}</button>{editing && <button type="button" disabled={busy} onClick={clearCategory}>Cancelar</button>}</div>
      </form>
      <div className="folio-panel-card folio-list" aria-label="Categorias cadastradas">
        {categories.length ? categories.map(category => <div className="folio-list-row" key={category.id}><div><strong>{category.name}</strong><small>/{category.slug}</small>{category.description && <p>{category.description}</p>}</div><div className="folio-row-actions"><button type="button" disabled={busy} onClick={() => { setEditing(category); setName(category.name); setSlug(category.slug); setDescription(category.description || ''); }}>Renomear</button><button type="button" disabled={busy} aria-label={`Excluir categoria ${category.name}`} onClick={() => { if (window.confirm(`Excluir a categoria “${category.name}”? Só é possível se não estiver em uso.`)) void run(() => deleteCategory(category), 'Categoria removida.'); }}>Excluir</button></div></div>) : <p>Nenhuma categoria criada ainda.</p>}
      </div>
    </div>}
    {!loading && <div id="folio-tags-panel" role="tabpanel" aria-labelledby="folio-tags-tab" hidden={tab !== 'tags'} className="folio-panel-grid">
      <form className="folio-panel-card" onSubmit={event => { event.preventDefault(); void run(async () => { await createTag(tagName); setTagName(''); }, 'Tag criada.'); }}>
        <h2>Nova tag</h2><label>Nome<input required value={tagName} onChange={event => setTagName(event.target.value)} placeholder="fantasia" /></label><button type="submit" className="button-primary" disabled={busy}>+ Criar tag</button>
      </form>
      <div className="folio-panel-card" aria-label="Tags cadastradas">{tags.length ? <div className="folio-tag-list">{tags.map(tag => <span className="folio-tag" key={tag.slug}>{tag.name}<button type="button" disabled={busy} aria-label={`Excluir tag ${tag.name}`} onClick={() => { if (window.confirm(`Excluir a tag “${tag.name}”? Só é possível se não estiver em uso.`)) void run(() => deleteTag(tag), 'Tag removida.'); }}>×</button></span>)}</div> : <p>Nenhuma tag criada ainda.</p>}</div>
    </div>}
  </section>;
}
