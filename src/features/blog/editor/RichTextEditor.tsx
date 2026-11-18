import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import type { ContentAlign } from '../types';
import { safeUrl, sanitizeRichText } from '../utils';

const paragraphStyles = {
  lineHeight: 'line-height', marginTop: 'margin-top', marginBottom: 'margin-bottom', blockBackground: 'background-color',
} as const;

const EditorialStyles = Extension.create({
  name: 'editorialStyles',
  addGlobalAttributes() {
    const attribute = (name: string, property: string) => ({
      default: null,
      parseHTML: (element: HTMLElement) => element.style.getPropertyValue(property) || null,
      renderHTML: (attributes: Record<string, string | null>) => attributes[name] ? { style: `${property}:${attributes[name]}` } : {},
    });
    return [
      { types: ['textStyle'], attributes: { fontWeight: attribute('fontWeight', 'font-weight'), letterSpacing: attribute('letterSpacing', 'letter-spacing') } },
      { types: ['paragraph', 'heading'], attributes: Object.fromEntries(Object.entries(paragraphStyles).map(([name, property]) => [name, attribute(name, property)])) },
    ];
  },
});

function legacyHtml(value: string) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeRichText(value);
  const sizes: Record<string, string> = { '1': '10px', '2': '12px', '3': '14px', '4': '17px', '5': '21px', '6': '27px', '7': '36px' };
  for (const font of template.content.querySelectorAll('font')) {
    const span = document.createElement('span');
    span.style.color = font.getAttribute('color') || '';
    span.style.fontSize = sizes[font.getAttribute('size') || ''] || '';
    span.append(...font.childNodes);
    font.replaceWith(span);
  }
  return sanitizeRichText(template.innerHTML);
}

function hexColor(value?: string | null) {
  if (!value) return '';
  // Tiptap may return rgb() after reloading a document through the browser.
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return '';
  context.fillStyle = value;
  return /^#[\da-f]{6}$/i.test(context.fillStyle) ? context.fillStyle : '';
}

const marks = [
  { label: 'Negrito', text: <b>B</b>, mark: 'bold', toggle: (editor: Editor) => editor.chain().focus().toggleBold().run() },
  { label: 'Itálico', text: <i>I</i>, mark: 'italic', toggle: (editor: Editor) => editor.chain().focus().toggleItalic().run() },
  { label: 'Sublinhado', text: <u>U</u>, mark: 'underline', toggle: (editor: Editor) => editor.chain().focus().toggleUnderline().run() },
  { label: 'Lista numerada', text: '1.', mark: 'orderedList', toggle: (editor: Editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Lista com marcadores', text: '•', mark: 'bulletList', toggle: (editor: Editor) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Citação', text: '❞', mark: 'blockquote', toggle: (editor: Editor) => editor.chain().focus().toggleBlockquote().run() },
];
const alignments = { left: 'Esquerda', center: 'Centro', right: 'Direita', justify: 'Justificado' } as const;

function StyleSelect({ label, value, values, onChange }: {
  label: string; value?: string | null; values: Record<string, string>; onChange: (value: string) => void;
}) {
  return <label>{label}<select aria-label={label} value={value || ''} onChange={event => onChange(event.target.value)}>
    <option value="">Padrão</option>
    {value && !Object.hasOwn(values, value) && <option value={value}>{value}</option>}
    {Object.entries(values).map(([key, text]) => <option value={key} key={key}>{text}</option>)}
  </select></label>;
}

export function RichTextEditor({ value = '', align = 'left', onChange, inlineTarget }: {
  value?: string; align?: ContentAlign; onChange: (html: string) => void; inlineTarget?: HTMLElement | null;
}) {
  const callback = useRef(onChange);
  const lastHtml = useRef(value);
  const linkInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ['http', 'https'], isAllowedUri: url => !!safeUrl(url), HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyleKit.configure({ lineHeight: false }),
      EditorialStyles,
    ],
    content: legacyHtml(value),
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => {
      const html = sanitizeRichText(current.getHTML());
      lastHtml.current = html;
      callback.current(html);
    },
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Conteúdo do bloco de texto', class: 'cms-rich-content cms-rich-output' } },
  });
  useEffect(() => {
    if (!editor || lastHtml.current === value) return;
    lastHtml.current = value;
    editor.commands.setContent(legacyHtml(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (editor && inlineTarget) editor.commands.focus();
  }, [editor, inlineTarget]);
  if (!editor) return <p>Carregando editor…</p>;

  const style = editor.getAttributes('textStyle');
  const fontFamily = (style.fontFamily as string | undefined)?.replace(/^["'](DM Sans|Playfair Display)["']$/i, '$1');
  const node = editor.isActive('heading') ? 'heading' : 'paragraph';
  const attributes = editor.getAttributes(node);
  const href = (editor.getAttributes('link').href || '') as string;
  const setInline = (key: string, next: string) => editor.chain().focus().setMark('textStyle', { [key]: next || null }).removeEmptyTextStyle().run();
  function setParagraphStyle(key: keyof typeof paragraphStyles, next: string | null, focus = true) {
    if (!editor) return;
    const chain = editor.chain();
    if (focus) chain.focus();
    chain.updateAttributes('paragraph', { [key]: next }).updateAttributes('heading', { [key]: next }).run();
  }

  return <div className="cms-rich-editor">
    <div className="cms-rich-toolbar" role="group" aria-label="Formatação de texto">
      <label>Estilo do parágrafo<select value={attributes.level || 'normal'} onChange={event => {
        const value = event.target.value;
        if (value === 'normal') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
      }}><option value="normal">Normal</option><option value="1">Título 1</option><option value="2">Título 2</option><option value="3">Título 3</option></select></label>
      {marks.map(item => <button type="button" key={item.mark} aria-label={item.label} title={item.label} aria-pressed={editor.isActive(item.mark)}
        onMouseDown={event => event.preventDefault()} onClick={() => item.toggle(editor)}>{item.text}</button>)}
      <label>Alinhamento do texto<select value={attributes.textAlign || ''} onChange={event => {
        if (event.target.value) editor.chain().focus().setTextAlign(event.target.value).run();
        else editor.chain().focus().unsetTextAlign().run();
      }}><option value="">Padrão do bloco</option>{Object.entries(alignments).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      <StyleSelect label="Fonte" value={fontFamily} values={{ 'DM Sans': 'DM Sans', 'Playfair Display': 'Playfair Display' }} onChange={next => setInline('fontFamily', next)} />
      <StyleSelect label="Tamanho do texto" value={style.fontSize} values={{ '12px': '12 px', '14px': '14 px', '17px': '17 px', '21px': '21 px', '28px': '28 px', '36px': '36 px', '48px': '48 px' }} onChange={next => setInline('fontSize', next)} />
      <StyleSelect label="Peso" value={style.fontWeight} values={{ '400': 'Regular', '500': 'Médio', '600': 'Seminegrito', '700': 'Negrito', '800': 'Extranegrito' }} onChange={next => setInline('fontWeight', next)} />
      <label>Cor do texto<input type="color" value={hexColor(style.color) || '#54263e'} onChange={event => editor.chain().setColor(event.target.value).run()} /></label>
      <label>Fundo do parágrafo<input type="color" value={hexColor(attributes.blockBackground) || '#fffdfd'}
        onChange={event => setParagraphStyle('blockBackground', event.target.value, false)} /></label>
      <StyleSelect label="Altura de linha" value={attributes.lineHeight} values={{ '1': '1', '1.2': '1,2', '1.5': '1,5', '1.75': '1,75', '2': '2' }} onChange={next => setParagraphStyle('lineHeight', next || null)} />
      <StyleSelect label="Espaço entre letras" value={style.letterSpacing} values={{ '-1px': '−1 px', '0px': '0 px', '0.5px': '0,5 px', '1px': '1 px', '2px': '2 px' }} onChange={next => setInline('letterSpacing', next)} />
      <StyleSelect label="Antes do parágrafo" value={attributes.marginTop} values={{ '0px': '0 px', '8px': '8 px', '16px': '16 px', '24px': '24 px' }} onChange={next => setParagraphStyle('marginTop', next || null)} />
      <StyleSelect label="Depois do parágrafo" value={attributes.marginBottom} values={{ '0px': '0 px', '8px': '8 px', '16px': '16 px', '24px': '24 px' }} onChange={next => setParagraphStyle('marginBottom', next || null)} />
      <button type="button" aria-label="Limpar formatação" title="Limpar formatação" onMouseDown={event => event.preventDefault()} onClick={() => {
        const reset = [...Object.keys(paragraphStyles), 'textAlign'];
        editor.chain().focus().clearNodes().unsetAllMarks().resetAttributes('heading', reset).resetAttributes('paragraph', reset).run();
      }}>Limpar formatação</button>
    </div>
    {inlineTarget ? createPortal(<EditorContent editor={editor} />, inlineTarget) :
      <div className="cms-rich-edit-area cms-blocks" style={{ textAlign: align }}><EditorContent editor={editor} /></div>}
    <div className="cms-link-tools">
      <label>Link do texto<input key={href} type="url" placeholder="https://…" defaultValue={href} ref={linkInput} /></label>
      <button type="button" onClick={() => {
        const link = safeUrl(linkInput.current?.value);
        if (!link) { setMessage('Use um endereço http ou https.'); return; }
        editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run();
        setMessage('Link aplicado à seleção.');
      }}>Aplicar link</button>
      <button type="button" disabled={!href} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>Remover link</button>
    </div>
    {message && <small role="status">{message}</small>}
  </div>;
}
