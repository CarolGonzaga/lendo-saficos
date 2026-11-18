import { useState } from 'react';
import type { ArticleBlock } from '../types';
import { blockLabels, newBlock } from '../utils';
import { RichTextEditor } from './RichTextEditor';
import { MediaUploader } from './MediaUploader';

type FieldsProps = {
  block: ArticleBlock;
  onChange: (patch: Partial<ArticleBlock>) => void;
  onBusy: (busy: boolean) => void;
  inlineTarget?: HTMLElement | null;
};

export function BlockFields({ block, onChange, onBusy, inlineTarget }: FieldsProps) {
  return <>
    {block.type === 'text' && <RichTextEditor value={block.content} align={block.align} inlineTarget={inlineTarget} onChange={content => onChange({ content })} />}
    {(block.type === 'h1' || block.type === 'h2' || block.type === 'h3' || block.type === 'quote' || block.type === 'card' || block.type === 'callout') &&
      <label>Texto<textarea value={block.content || ''} onChange={event => onChange({ content: event.target.value })} /></label>}
    {(block.type === 'bullets' || block.type === 'numbered') && <label>Um item por linha<textarea value={block.entries?.join('\n') || ''} onChange={event => onChange({ entries: event.target.value.split('\n') })} /></label>}
    {(block.type === 'product' || block.type === 'button' || block.type === 'linklist' || block.type === 'card' || block.type === 'callout') &&
      <label>{block.type === 'button' ? 'Texto do botão' : 'Título do bloco'}<input value={block.title || ''} onChange={event => onChange({ title: event.target.value })} /></label>}
    {(block.type === 'product' || block.type === 'button' || block.type === 'card' || block.type === 'callout') &&
      <label>Endereço do link<input type="url" value={block.url || ''} onChange={event => onChange({ url: event.target.value })} placeholder="https://…" /></label>}
    {block.type === 'product' && <label>Preço ou chamada<input value={block.price || ''} onChange={event => onChange({ price: event.target.value })} /></label>}
    {(block.type === 'product' || block.type === 'image') && <MediaUploader value={block.image || ''} onChange={image => onChange({ image })} onBusy={onBusy} />}
    {block.type === 'image' && <>
      <label>Texto alternativo (descreva a imagem)<input value={block.alt || ''} onChange={event => onChange({ alt: event.target.value })} /></label>
      <label>Legenda<input value={block.caption || ''} onChange={event => onChange({ caption: event.target.value })} /></label>
      <label>Crédito<input value={block.credit || ''} onChange={event => onChange({ credit: event.target.value })} /></label>
    </>}
    {block.type === 'linklist' && <div className="cms-link-list-editor">
      {block.items?.map((item, index) => <div key={index}>
        <label>Nome {index + 1}<input value={item.title} onChange={event => onChange({ items: block.items?.map((entry, i) => i === index ? { ...entry, title: event.target.value } : entry) })} /></label>
        <label>Link {index + 1}<input type="url" value={item.url} onChange={event => onChange({ items: block.items?.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry) })} /></label>
        <button type="button" onClick={() => onChange({ items: block.items?.filter((_, i) => i !== index) })}>Remover item</button>
      </div>)}
      <button type="button" onClick={() => onChange({ items: [...(block.items || []), { title: '', url: '' }] })}>+ Adicionar link</button>
    </div>}
  </>;
}

export function BlockAlign({ block, onChange }: Pick<FieldsProps, 'block' | 'onChange'>) {
  return <label>Alinhamento do bloco<select value={block.align || 'left'} onChange={event => onChange({ align: event.target.value as ArticleBlock['align'] })}>
    <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option>
  </select></label>;
}

export function BlockEditor({ blocks, onChange, onBusy }: {
  blocks: ArticleBlock[];
  onChange: (blocks: ArticleBlock[]) => void;
  onBusy: FieldsProps['onBusy'];
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [block] = next.splice(from, 1);
    next.splice(to, 0, block);
    onChange(next);
  };
  return <section className="cms-content-editor">
    <h2>Conteúdo</h2>
    <p>Use as setas ou a alça para alterar a ordem de leitura.</p>
    {blocks.map((block, index) => {
      const update = (patch: Partial<ArticleBlock>) => onChange(blocks.map(item => item.id === block.id ? { ...item, ...patch } as ArticleBlock : item));
      return <fieldset className="cms-editor-block" key={block.id} onDragOver={event => { if (dragging) event.preventDefault(); }} onDrop={event => {
        if (!dragging) return;
        event.preventDefault();
        move(blocks.findIndex(item => item.id === dragging), index);
        setDragging(null);
      }}>
        <legend>{blockLabels[block.type]} {index + 1}</legend>
        <div className="cms-block-actions">
          <button type="button" draggable onDragStart={() => setDragging(block.id)} onDragEnd={() => setDragging(null)} aria-label={`Arrastar bloco ${index + 1}`}>⠿</button>
          <button type="button" disabled={!index} onClick={() => move(index, index - 1)} aria-label={`Mover bloco ${index + 1} para cima`}>↑</button>
          <button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)} aria-label={`Mover bloco ${index + 1} para baixo`}>↓</button>
          <button type="button" onClick={() => {
            const next = [...blocks];
            next.splice(block.box ? next.length : index + 1, 0, { ...structuredClone(block), id: crypto.randomUUID(), box: undefined, layer: undefined });
            onChange(next);
          }}>Duplicar</button>
          <button type="button" onClick={() => {
            if (window.confirm('Remover este bloco e seu conteúdo?')) onChange(blocks.filter(item => item.id !== block.id));
          }}>Excluir</button>
        </div>
        <BlockFields block={block} onChange={update} onBusy={onBusy} />
        <div className="cms-block-settings">
          {block.box ? <small>Ajuste as dimensões no Editor Visual.</small> : <label>Largura<select value={block.span} onChange={event => update({ span: Number(event.target.value) })}>
            <option value={3}>1/4</option><option value={4}>1/3</option><option value={6}>1/2</option><option value={8}>2/3</option><option value={9}>3/4</option><option value={12}>Inteira</option>
          </select></label>}
          <BlockAlign block={block} onChange={update} />
        </div>
      </fieldset>;
    })}
    <label>Adicionar bloco<select value="" onChange={event => {
      if (event.target.value) onChange([...blocks, newBlock(event.target.value as ArticleBlock['type'])]);
    }}><option value="">Escolha o tipo…</option>{Object.entries(blockLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
  </section>;
}
