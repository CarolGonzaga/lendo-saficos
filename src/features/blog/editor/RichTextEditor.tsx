import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { safeUrl, sanitizeRichText } from '../utils';

function legacyHtml(value: string) {
  return sanitizeRichText(value.replace(/<font([^>]*)>/gi, (_, attributes: string) => {
    const color = attributes.match(/color=["']([^"']+)["']/i)?.[1];
    const size = attributes.match(/size=["']?(\d)/i)?.[1];
    return `<span style="${color ? `color:${color};` : ''}${size ? `font-size:${({ '2': 12, '3': 14, '4': 17, '5': 21 } as Record<string, number>)[size] || 14}px;` : ''}">`;
  }).replace(/<\/font>/gi, '</span>'));
}
export function RichTextEditor({ value = '', onChange }: { value?: string; onChange: (html: string) => void }) {
  const callbackRef = useRef(onChange);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { callbackRef.current = onChange; }, [onChange]);
  const editor = useEditor({ extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false,
    protocols: ['http', 'https'], isAllowedUri: url => !!safeUrl(url), HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit],
    content: legacyHtml(value), onUpdate: ({ editor: current }) => callbackRef.current(sanitizeRichText(current.getHTML())),
    editorProps: { attributes: { 'aria-label': 'Conteúdo do bloco de texto', class: 'cms-rich-content' } },
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(legacyHtml(value), { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return <p>Carregando editor…</p>;
  return <div className="cms-rich-editor"><div className="cms-rich-toolbar" role="toolbar" aria-label="Formatação de texto">
    <button type="button" aria-label="Negrito" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
    <button type="button" aria-label="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
    <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
    <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
    <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Marcadores</button>
    <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>Numerada</button>
    <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Citação</button>
    <label>Alinhar<select aria-label="Alinhar" onChange={event => editor.chain().focus().setTextAlign(event.target.value).run()} defaultValue="left"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
    <label>Cor<input type="color" defaultValue="#56132f" onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
    <label>Tamanho<select aria-label="Tamanho" defaultValue="14px" onChange={event => editor.chain().focus().setFontSize(event.target.value).run()}><option value="12px">Pequeno</option><option value="14px">Normal</option><option value="17px">Grande</option><option value="21px">Destaque</option></select></label>
  </div><EditorContent editor={editor} /><div className="cms-link-tools"><label>Link do texto<input type="url" placeholder="https://…" value={link} onChange={event => setLink(event.target.value)} /></label><button type="button" onClick={() => { if (!safeUrl(link)) { setMessage('Use um endereço http ou https.'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href: safeUrl(link) }).run(); setMessage('Link aplicado à seleção.'); }}>Aplicar link</button><button type="button" onClick={() => editor.chain().focus().unsetLink().run()}>Remover link</button></div><small role="status">{message}</small></div>;
}
