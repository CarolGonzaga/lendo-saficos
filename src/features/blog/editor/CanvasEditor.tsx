import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { CANVAS_WIDTH, MAX_HEIGHT, MAX_Y, MIN_SIZE, clamp, isCanvasBox, overlaps } from '../canvas-layout.mjs';
import type { CanvasBox } from '../canvas-layout.mjs';
import { canvasSection } from '../block-presentation.mjs';
import type { ArticleBlock } from '../types';
import { blockLabels, newBlock } from '../utils';
import { BlockSurface } from '../components/BlockRenderer';
import { CanvasInspector, NumberField } from './CanvasInspector';
import { defaultGrid, gridColumns, manipulate, provisionalBoxes } from './canvas-geometry';
import type { Direction, Guides, Rect } from './canvas-geometry';
import './canvas.css';

type Layer = ArticleBlock & { box: CanvasBox };
type Gesture = {
  id: string; pointer: number; start: Rect; direction: Direction; clientX: number; clientY: number;
  scale: number; siblings: Rect[]; scroll: number; group: { block: Layer; rect: Rect }[];
};
type Frame = { boxes: Map<string, CanvasBox>; guides: Guides; conflict: boolean };
const directions = { n: 'superior', ne: 'superior direito', e: 'direito', se: 'inferior direito',
  s: 'inferior', sw: 'inferior esquerdo', w: 'esquerdo', nw: 'superior esquerdo' } as const;
const keyboardOffsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const templateKey = 'lendo-saficos.editorial-templates.v1';
type Template = { name: string; blocks: Layer[] };

function loadTemplates(): Template[] {
  try {
    const templates = JSON.parse(window.localStorage.getItem(templateKey) || '[]') as Template[];
    return templates.filter(item => typeof item.name === 'string' && Array.isArray(item.blocks) &&
      item.blocks.every(block => block.type in blockLabels && isCanvasBox(block.box)));
  } catch {
    return [];
  }
}

export function CanvasEditor({ blocks, onChange, onBusy, onPreview }: {
  blocks: ArticleBlock[];
  onChange: (blocks: ArticleBlock[]) => void;
  onBusy: (busy: boolean) => void;
  onPreview: (blocks: ArticleBlock[]) => void;
}) {
  const layers = provisionalBoxes(blocks);
  const conversion = blocks.some(block => !isCanvasBox(block.box) && (block.type !== 'text' || !!block.content || block.id !== 'new-article-text'));
  const [selected, setSelected] = useState<string | null>(null);
  const [inlineLayer, setInlineLayer] = useState<string | null>(null);
  const [inlineTarget, setInlineTarget] = useState<HTMLDivElement | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(defaultGrid);
  const [notice, setNotice] = useState('');
  const [layoutOverlap, setLayoutOverlap] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [history, setHistory] = useState({ past: [] as ArticleBlock[][], future: [] as ArticleBlock[][] });
  const [templates, setTemplates] = useState(loadTemplates);
  const [templateName, setTemplateName] = useState('');
  const latestBlocks = useRef(blocks);
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastFrame = useRef<Frame | null>(null);
  const lastEdit = useRef({ id: '', at: 0 });
  const active = layers.find(block => block.id === selected);
  const editingInline = active?.id === inlineLayer && !active?.layer?.locked && !active?.layer?.hidden && !conversion;

  useEffect(() => {
    if (!stage.current) return;
    const surfaces = Array.from(stage.current.querySelectorAll<HTMLElement>('[data-canvas-layer]'));
    const observer = new ResizeObserver(() => {
      if (gesture.current) return;
      const boxes = surfaces.map(surface => ({
        x: surface.offsetLeft, y: surface.offsetTop, width: surface.offsetWidth, height: surface.offsetHeight,
      }));
      setLayoutOverlap(boxes.some((box, index) => boxes.slice(index + 1).some(other => overlaps(box, other))));
    });
    surfaces.forEach(surface => observer.observe(surface));
    if (!surfaces.length) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [blocks]);

  function selectLayer(id: string | null) {
    setSelected(id);
    if (id !== selected) setInlineLayer(null);
  }

  // Async media uploads must merge into the latest draft, even after layer selection changes.
  latestBlocks.current = blocks;
  function commit(next: ArticleBlock[], mergeId = '') {
    const previous = latestBlocks.current;
    if (JSON.stringify(next) === JSON.stringify(previous)) return;
    const now = Date.now();
    const merge = mergeId && mergeId === lastEdit.current.id && now - lastEdit.current.at < 800;
    lastEdit.current = { id: mergeId, at: now };
    setHistory(current => ({ past: merge ? current.past : [...current.past.slice(-59), previous], future: [] }));
    latestBlocks.current = next;
    onChange(next);
  }

  function undoOrRedo(redo: boolean) {
    const stack = redo ? history.future : history.past;
    const next = stack.at(-1);
    if (!next) return;
    const current = latestBlocks.current;
    lastEdit.current = { id: '', at: 0 };
    setHistory(redo ? { past: [...history.past, current], future: stack.slice(0, -1) }
      : { past: stack.slice(0, -1), future: [...history.future, current] });
    latestBlocks.current = next;
    onChange(next);
    setNotice(redo ? 'Alteração refeita.' : 'Alteração desfeita.');
  }

  function rectOf(block: Layer): Rect {
    const node = stage.current?.querySelector<HTMLElement>(`[data-canvas-layer="${CSS.escape(block.id)}"]`);
    return { ...block.box, height: Math.max(MIN_SIZE, Math.round(node?.offsetHeight || block.box.height || MIN_SIZE)) };
  }

  function updateLayer(id: string, patch: Partial<ArticleBlock>, merge = false) {
    commit(provisionalBoxes(latestBlocks.current).map(block => block.id === id ? { ...block, ...patch } as Layer : block), merge ? id : '');
  }

  function collision(block: Layer, box: CanvasBox, height: number, others: Rect[]) {
    const rect = { ...box, height: box.height ?? height };
    // A pre-existing overlap may be reduced or removed, but can't be introduced during a gesture.
    const previous = { ...block.box, height };
    const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
      * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return others.some(other => overlaps(rect, other) && area(rect, other) > area(previous, other));
  }

  function updateBox(block: Layer, patch: Partial<CanvasBox>) {
    const box = { ...block.box, ...patch };
    const height = rectOf(block).height;
    if (!isCanvasBox(box) || collision(block, box, height, layers.filter(item => item.id !== block.id).map(rectOf))) {
      setNotice('A posição ou dimensão invade outra camada.');
      return;
    }
    setNotice('');
    updateLayer(block.id, { box });
  }

  function start(event: PointerEvent<HTMLButtonElement>, block: Layer, direction: Direction) {
    if (event.button !== 0 || gesture.current) return;
    selectLayer(block.id);
    if (block.layer?.locked || conversion || !stage.current) return;
    const members = direction === 'move' && block.layer?.group?.trim()
      ? layers.filter(item => item.id !== block.id && item.layer?.group === block.layer?.group)
      : [];
    if (members.some(item => item.layer?.locked)) {
      setNotice('Desbloqueie as camadas do grupo antes de movê-lo.');
      return;
    }
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    setNotice('');
    gesture.current = {
      id: block.id, pointer: event.pointerId, start: rectOf(block), direction,
      clientX: event.clientX, clientY: event.clientY,
      scale: stage.current.getBoundingClientRect().width / CANVAS_WIDTH,
      scroll: scroller.current?.scrollLeft ?? 0,
      siblings: layers.filter(item => item.id !== block.id && !members.includes(item)).map(rectOf),
      group: members.map(item => ({ block: item, rect: rectOf(item) })),
    };
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>, block: Layer) {
    const current = gesture.current;
    if (current?.id !== block.id || current.pointer !== event.pointerId) return;
    const dx = (event.clientX - current.clientX + (scroller.current?.scrollLeft ?? 0) - current.scroll) / current.scale;
    const dy = (event.clientY - current.clientY) / current.scale;
    if (!lastFrame.current && Math.hypot(dx, dy) < 3) return;
    const { rect, guides } = manipulate(current.start, current.direction, dx, dy, grid, current.siblings, snap && !event.altKey, event.shiftKey, block.layer?.limits);
    const box = { ...block.box, ...rect, height: current.direction === 'move' || !/[ns]/.test(current.direction) ? block.box.height : rect.height };
    const boxes = new Map([[block.id, box]]);
    let conflict = !isCanvasBox(box) || collision(block, box, current.start.height, current.siblings);
    for (const member of current.group) {
      const otherBox = { ...member.block.box, x: member.rect.x + rect.x - current.start.x, y: member.rect.y + rect.y - current.start.y };
      boxes.set(member.block.id, otherBox);
      conflict ||= !isCanvasBox(otherBox) || collision(member.block, otherBox, member.rect.height, current.siblings);
    }
    const next = { boxes, guides, conflict };
    lastFrame.current = next;
    setFrame(next);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    if (gesture.current?.pointer !== event.pointerId) return;
    const next = lastFrame.current;
    gesture.current = null;
    lastFrame.current = null;
    setFrame(null);
    if (cancelled || !next) return;
    if (next.conflict) setNotice('A alteração foi cancelada porque ultrapassava o canvas ou invadia outra camada.');
    else commit(provisionalBoxes(latestBlocks.current).map(block => next.boxes.has(block.id) ? { ...block, box: next.boxes.get(block.id) } : block));
  }

  function add(types: ArticleBlock['type'][], position?: { x: number; y: number }) {
    const width = types.length > 1 ? 264 : 280;
    const bottom = Math.max(0, ...layers.map(block => { const rect = rectOf(block); return rect.y + rect.height + 24; }));
    if (bottom > MAX_Y) { setNotice('O canvas atingiu a altura máxima.'); return; }
    const x = clamp(position?.x ?? grid.margin, 0, CANVAS_WIDTH - (width + grid.gutter) * types.length + grid.gutter);
    const y = clamp(position?.y ?? bottom, 0, MAX_Y);
    const group = types.length > 1 ? `Colunas ${layers.length + 1}` : undefined;
    const items = types.map((type, index) => ({
      ...newBlock(type),
      box: { version: 1, x: x + index * (width + grid.gutter), y, width, height: type === 'image' ? 200 : type === 'spacer' ? 40 : null },
      layer: group ? { group } : undefined,
    } satisfies Layer));
    for (const item of items) {
      if (layers.some(block => overlaps({ ...item.box, height: item.box.height ?? 100 }, rectOf(block)))) item.box.y = bottom;
    }
    if (items.length > 1 && items.some(item => item.box.y === bottom)) items.forEach(item => { item.box.y = bottom; });
    commit([...layers, ...items]);
    setSelected(items[0].id);
    setNotice('');
  }

  function remove(block: Layer) {
    if (block.layer?.locked || !window.confirm(`Remover “${block.layer?.name || blockLabels[block.type]}”?`)) return;
    commit(blocks.filter(item => item.id !== block.id));
    setSelected(null);
  }

  function layerKeys(event: KeyboardEvent<HTMLButtonElement>, block: Layer) {
    if (conversion || block.layer?.locked) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(block); return; }
    const offset = keyboardOffsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const step = event.shiftKey ? grid.row : 1;
    updateBox(block, { x: clamp(block.box.x + offset[0] * step, 0, CANVAS_WIDTH - block.box.width), y: clamp(block.box.y + offset[1] * step, 0, MAX_Y) });
  }

  function saveTemplate() {
    const name = templateName.trim();
    if (!name || !layers.length) return;
    if (templates.some(item => item.name === name) && !window.confirm('Substituir o modelo com este nome?')) return;
    try {
      const next = [...templates.filter(item => item.name !== name), { name, blocks: layers }];
      window.localStorage.setItem(templateKey, JSON.stringify(next));
      setTemplates(next);
      setTemplateName('');
      setNotice('Modelo salvo neste navegador.');
    } catch {
      setNotice('Não foi possível armazenar o modelo neste navegador.');
    }
  }

  const selectedHeight = active ? clamp(rectOf(active).height, MIN_SIZE, MAX_HEIGHT) : MIN_SIZE;
  return <section className="cms-visual-editor" aria-label="Editor Visual" onKeyDown={event => {
    if (event.key === 'Escape' && editingInline) {
      event.preventDefault();
      setInlineLayer(null);
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase())) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    undoOrRedo(event.shiftKey || event.key.toLowerCase() === 'y');
  }}>
    {conversion && <div className="cms-canvas-conversion">
      <p>Confira a disposição proposta antes de aplicar o layout visual. O conteúdo e as larguras do modo básico ficam disponíveis; use Desfazer para voltar ao fluxo anterior.</p>
      <button type="button" onClick={() => onPreview(layers)}>Prévia da conversão</button>
      <button type="button" onClick={() => commit(layers)}>Aplicar layout visual</button>
    </div>}
    <div className="cms-canvas-toolbar">
      <button type="button" onClick={() => undoOrRedo(false)} disabled={!history.past.length}>Desfazer</button>
      <button type="button" onClick={() => undoOrRedo(true)} disabled={!history.future.length}>Refazer</button>
      <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)}>Grade</button>
      <button type="button" aria-pressed={snap} onClick={() => setSnap(!snap)}>Encaixe</button>
      <button type="button" onClick={() => onPreview(conversion ? layers : blocks)}>Prévia do layout</button>
      {editingInline && <button type="button" onClick={() => setInlineLayer(null)}>Concluir edição no canvas</button>}
      <details className="cms-canvas-grid-settings">
        <summary>Configurar grade</summary>
        <div className="cms-canvas-fields">
          <NumberField label="Colunas" value={grid.columns} min={2} max={12} onChange={columns => setGrid({ ...grid, columns })} />
          <NumberField label="Vão entre colunas (px)" value={grid.gutter} min={0} max={48} onChange={gutter => setGrid({ ...grid, gutter })} />
          <NumberField label="Margem da página (px)" value={grid.margin} min={0} max={120} onChange={margin => setGrid({ ...grid, margin })} />
          <NumberField label="Passo vertical (px)" value={grid.row} min={4} max={96} onChange={row => setGrid({ ...grid, row })} />
        </div>
      </details>
    </div>
    <p className="cms-canvas-help">Arraste um elemento ou suas alças. Alt suspende o encaixe. Shift mantém a proporção nos cantos. Use as setas para ajustes precisos e Delete para remover.</p>
    <fieldset className="cms-canvas-palette" disabled={conversion}>
      <legend>Inserir no canvas</legend>
      <label>Adicionar elemento<select value="" onChange={event => { if (event.target.value) add([event.target.value as ArticleBlock['type']]); }}>
        <option value="">Escolha o tipo…</option>{Object.entries(blockLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
      </select></label>
      <details><summary>Componentes para arrastar</summary><div className="cms-canvas-toolbar">
        {Object.entries(blockLabels).map(([type, label]) => <button key={type} type="button" draggable onDragStart={event => {
          event.dataTransfer.setData('application/x-lendo-block', type);
          event.dataTransfer.effectAllowed = 'copy';
        }} onClick={() => add([type as ArticleBlock['type']])}>{label}</button>)}
      </div></details>
      <button type="button" draggable onDragStart={event => {
        event.dataTransfer.setData('application/x-lendo-block', 'columns');
        event.dataTransfer.effectAllowed = 'copy';
      }} onClick={() => add(['text', 'text'])}>Grupo de colunas</button>
    </fieldset>
    <div className="cms-canvas-scroll" ref={scroller} tabIndex={0} aria-label="Área de composição de 900 pixels">
      <div className="cms-content-frame cms-editorial-stage">
        <div className={`${canvasSection} cms-editing-stage`} ref={stage}
          onDragOver={event => {
            if (conversion || !event.dataTransfer.types.includes('application/x-lendo-block')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={event => {
            const type = event.dataTransfer.getData('application/x-lendo-block');
            if (conversion || (type !== 'columns' && !Object.hasOwn(blockLabels, type))) return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            add(type === 'columns' ? ['text', 'text'] : [type as ArticleBlock['type']],
              { x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) });
          }} onPointerDown={event => { if (event.target === event.currentTarget) selectLayer(null); }}>
          {showGrid && <div className="cms-canvas-grid" aria-hidden="true" style={{ '--canvas-grid-row': `${grid.row}px` } as CSSProperties}>
            {gridColumns(grid).map(column => <span key={column.x} style={{ left: column.x, width: column.width }} />)}
          </div>}
          {layers.map(block => {
            if (block.layer?.hidden) return <BlockSurface key={block.id} block={block} box={block.box} editorHidden />;
            const isSelected = block.id === selected;
            const inline = isSelected && editingInline;
            const candidate = frame?.boxes.get(block.id);
            const box = isCanvasBox(candidate) ? candidate : block.box;
            const name = block.layer?.name || blockLabels[block.type];
            const pointers = (direction: Direction) => ({
              onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, block, direction),
              onPointerMove: (event: PointerEvent<HTMLButtonElement>) => pointerMove(event, block),
              onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
              onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
              onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
            });
            const empty = block.type === 'text' ? !block.content : block.type === 'image' ? !block.image : false;
            return <BlockSurface key={block.id} block={block} box={box}
              surface={inline ? <div className="cms-inline-target" ref={setInlineTarget} /> : undefined}>
              {!inline && <button type="button" className="cms-canvas-hit" aria-label={`Selecionar ${name} no canvas`} aria-pressed={isSelected}
                data-conflict={isSelected && !!frame?.conflict} onFocus={() => selectLayer(block.id)} onKeyDown={event => layerKeys(event, block)}
                onDoubleClick={() => {
                  if (block.type === 'text' && !block.layer?.locked && !conversion) setInlineLayer(block.id);
                  else document.getElementById('cms-canvas-properties')?.scrollIntoView({ block: 'start' });
                }} {...pointers('move')}>
                {empty && name}
              </button>}
              {isSelected && !block.layer?.locked && !conversion && Object.entries(directions).map(([direction, title]) =>
                <button type="button" className={`cms-resize-point cms-resize-${direction}`} key={direction} tabIndex={-1}
                  aria-label={`Redimensionar ${name}, ${title}`} {...pointers(direction as Direction)} />)}
            </BlockSurface>;
          })}
          {frame?.guides.x !== undefined && <i className="cms-canvas-guide cms-canvas-guide-x" style={{ left: frame.guides.x }} />}
          {frame?.guides.y !== undefined && <i className="cms-canvas-guide cms-canvas-guide-y" style={{ top: frame.guides.y }} />}
        </div>
      </div>
    </div>
    <p className="cms-canvas-status" role="status">{notice}</p>
    {layoutOverlap && <p className="cms-canvas-overlap" role="status">Há camadas sobrepostas. Revise a posição ou a altura antes de publicar.</p>}
    <div className="cms-canvas-panels">
      <fieldset className="cms-canvas-layers" disabled={conversion}>
        <legend>Camadas · ordem de leitura</legend>
        {layers.map((block, index) => <button type="button" key={block.id} aria-pressed={block.id === selected} onClick={() => selectLayer(block.id)}>
          {index + 1}. {block.layer?.group ? `${block.layer.group} / ` : ''}{block.layer?.name || blockLabels[block.type]}
          {block.layer?.locked ? ' · bloqueada' : ''}{block.layer?.hidden ? ' · oculta no canvas' : ''}
        </button>)}
        {active && <div className="cms-layer-controls">
          <label>Nome da camada<input value={active.layer?.name ?? ''} maxLength={80} onChange={event => updateLayer(active.id, { layer: { ...active.layer, name: event.target.value } }, true)} /></label>
          <label>Grupo da camada<input value={active.layer?.group ?? ''} maxLength={80} onChange={event => updateLayer(active.id, { layer: { ...active.layer, group: event.target.value } }, true)} /></label>
          <button type="button" onClick={() => updateLayer(active.id, { layer: { ...active.layer, locked: !active.layer?.locked } })}>{active.layer?.locked ? 'Desbloquear' : 'Bloquear'}</button>
          <button type="button" onClick={() => updateLayer(active.id, { layer: { ...active.layer, hidden: !active.layer?.hidden } })}>{active.layer?.hidden ? 'Mostrar no canvas' : 'Ocultar no canvas'}</button>
          <button type="button" disabled={active.layer?.locked} onClick={() => {
            const id = crypto.randomUUID();
            const height = Math.max(...layers.map(block => { const rect = rectOf(block); return rect.y + rect.height; })) + 24;
            if (height > MAX_Y) { setNotice('O canvas atingiu a altura máxima.'); return; }
            commit([...layers, { ...structuredClone(active), id, box: { ...active.box, y: height } }]);
            setSelected(id);
          }}>Duplicar camada</button>
          <button type="button" disabled={active.layer?.locked} onClick={() => remove(active)}>Excluir camada</button>
          {([-1, 1] as const).map(step => {
            const index = layers.findIndex(block => block.id === active.id);
            return <button key={step} type="button" disabled={active.layer?.locked || !layers[index + step]} onClick={() => {
              const next = [...layers];
              [next[index], next[index + step]] = [next[index + step], next[index]];
              commit(next);
            }}>{step < 0 ? 'Antecipar leitura' : 'Adiar leitura'}</button>;
          })}
        </div>}
      </fieldset>
      <div id="cms-canvas-properties">
        {active && !conversion ? <CanvasInspector block={active} height={selectedHeight} onChange={patch => updateLayer(active.id, patch, true)}
          onBox={patch => updateBox(active, patch)} onBusy={onBusy} inlineTarget={editingInline ? inlineTarget : null}
          editingInline={editingInline} onToggleInline={() => setInlineLayer(editingInline ? null : active.id)} /> : <p>Selecione um elemento para editar conteúdo, posição e dimensões.</p>}
      </div>
    </div>
    <details className="cms-canvas-templates">
      <summary>Modelos editoriais neste navegador</summary>
      <label>Nome do modelo<input value={templateName} maxLength={80} onChange={event => setTemplateName(event.target.value)} /></label>
      <button type="button" disabled={!templateName.trim() || !layers.length || conversion} onClick={saveTemplate}>Salvar como modelo</button>
      {templates.length > 0 && <label>Inserir modelo<select value="" disabled={conversion} onChange={event => {
        const model = templates.find(item => item.name === event.target.value);
        if (!model || (layers.length && !window.confirm('Substituir a composição atual pelo modelo? Você pode desfazer.'))) return;
        commit(structuredClone(model.blocks).map(block => ({ ...block, id: crypto.randomUUID() })));
        setSelected(null);
      }}><option value="">Escolha um modelo…</option>{templates.map(item => <option key={item.name}>{item.name}</option>)}</select></label>}
    </details>
    {!conversion && blocks.some(block => block.box) && <button type="button" onClick={() => {
      if (window.confirm('Voltar ao fluxo básico? O conteúdo será preservado e esta ação pode ser desfeita.')) {
        commit(blocks.map(block => ({ ...block, box: undefined })));
        setSelected(null);
      }
    }}>Voltar ao fluxo básico</button>}
  </section>;
}

