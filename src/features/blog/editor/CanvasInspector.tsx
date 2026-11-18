import type { ArticleBlock } from '../types';
import { CANVAS_WIDTH, MAX_HEIGHT, MAX_Y, MIN_SIZE, clamp } from '../canvas-layout.mjs';
import type { CanvasBox } from '../canvas-layout.mjs';
import { BlockAlign, BlockFields } from './BlockEditor';

export function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void;
}) {
  return <label>{label}<input key={value} type="number" min={min} max={max} defaultValue={value} onBlur={event => {
    const number = event.target.valueAsNumber;
    const next = Number.isFinite(number) ? clamp(Math.round(number), min, max) : value;
    event.target.value = String(value);
    if (next !== value) onChange(next);
  }} onKeyDown={event => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
  }} /></label>;
}

export function CanvasInspector({ block, height, onBox, onChange, onBusy, inlineTarget, editingInline, onToggleInline }: {
  block: ArticleBlock & { box: CanvasBox };
  height: number;
  onBox: (update: Partial<CanvasBox>) => void;
  onChange: (patch: Partial<ArticleBlock>) => void;
  onBusy: (busy: boolean) => void;
  inlineTarget: HTMLElement | null;
  editingInline: boolean;
  onToggleInline: () => void;
}) {
  const { box } = block;
  const limits = block.layer?.limits || {};
  const limit = (patch: typeof limits) => onChange({ layer: { ...block.layer, limits: { ...limits, ...patch } } });
  const minWidth = limits.minWidth ?? MIN_SIZE;
  const maxWidth = limits.maxWidth ?? CANVAS_WIDTH;
  const minHeight = limits.minHeight ?? MIN_SIZE;
  const maxHeight = limits.maxHeight ?? MAX_HEIGHT;
  const fixedHeight = box.height ?? clamp(height, minHeight, maxHeight);
  return <fieldset className="cms-canvas-inspector" disabled={block.layer?.locked} key={block.id}>
    <legend>Propriedades</legend>
    <div className="cms-canvas-fields">
      <NumberField label="Posição X (px)" value={box.x} min={0} max={CANVAS_WIDTH - box.width} onChange={x => onBox({ x })} />
      <NumberField label="Posição Y (px)" value={box.y} min={0} max={MAX_Y} onChange={y => onBox({ y })} />
      <NumberField label="Largura (px)" value={box.width} min={minWidth} max={Math.min(maxWidth, CANVAS_WIDTH - box.x)} onChange={width => onBox({ width })} />
      <NumberField label="Altura (px)" value={box.height ?? height} min={minHeight} max={maxHeight} onChange={height => onBox({ height })} />
      <label className="cms-checkbox"><input type="checkbox" checked={box.height === null} onChange={event => onBox({ height: event.target.checked ? null : fixedHeight })} />Altura automática</label>
      <NumberField label="Preenchimento (px)" value={box.padding ?? 0} min={0} max={96} onChange={padding => onBox({ padding })} />
      <label>Fundo do bloco<input type="color" value={box.background || '#fffdfd'} onChange={event => onBox({ background: event.target.value })} /></label>
      {box.background && <button type="button" onClick={() => onBox({ background: undefined })}>Limpar fundo do bloco</button>}
      <BlockAlign block={block} onChange={onChange} />
      {block.type === 'image' && <label>Ajuste da imagem<select value={box.fit || 'cover'} onChange={event => onBox({ fit: event.target.value as CanvasBox['fit'] })}>
        <option value="cover">Preencher</option><option value="contain">Mostrar inteira</option><option value="crop">Recorte manual</option>
      </select></label>}
      {block.type === 'image' && box.fit === 'crop' && <>
        <NumberField label="Recorte X (%)" value={box.cropX ?? 50} min={0} max={100} onChange={cropX => onBox({ cropX })} />
        <NumberField label="Recorte Y (%)" value={box.cropY ?? 50} min={0} max={100} onChange={cropY => onBox({ cropY })} />
        <NumberField label="Zoom do recorte (%)" value={box.cropZoom ?? 100} min={100} max={300} onChange={cropZoom => onBox({ cropZoom })} />
      </>}
    </div>
    <details>
      <summary>Limites de redimensionamento</summary>
      <div className="cms-canvas-fields">
        <NumberField label="Largura mínima (px)" value={minWidth} min={MIN_SIZE} max={box.width} onChange={minWidth => limit({ minWidth })} />
        <NumberField label="Largura máxima (px)" value={maxWidth} min={box.width} max={CANVAS_WIDTH} onChange={maxWidth => limit({ maxWidth })} />
        <NumberField label="Altura mínima (px)" value={minHeight} min={MIN_SIZE} max={fixedHeight} onChange={minHeight => limit({ minHeight })} />
        <NumberField label="Altura máxima (px)" value={maxHeight} min={fixedHeight} max={MAX_HEIGHT} onChange={maxHeight => limit({ maxHeight })} />
      </div>
    </details>
    <details>
      <summary>Layout em tablet e celular</summary>
      <div className="cms-canvas-fields">
        <NumberField label="Largura no tablet (%)" value={box.tabletWidth ?? 100} min={25} max={100} onChange={tabletWidth => onBox({ tabletWidth })} />
        <NumberField label="Espaçamento no tablet (px)" value={box.tabletGap ?? 20} min={0} max={96} onChange={tabletGap => onBox({ tabletGap })} />
        <NumberField label="Largura no celular (%)" value={box.mobileWidth ?? 100} min={25} max={100} onChange={mobileWidth => onBox({ mobileWidth })} />
        <NumberField label="Espaçamento no celular (px)" value={box.mobileGap ?? 20} min={0} max={96} onChange={mobileGap => onBox({ mobileGap })} />
        <label>Posição em telas menores<select value={box.compactAlign || 'start'} onChange={event => onBox({ compactAlign: event.target.value as CanvasBox['compactAlign'] })}>
          <option value="start">Esquerda</option><option value="center">Centro</option><option value="end">Direita</option>
        </select></label>
      </div>
    </details>
    <div className="cms-canvas-content-properties">
      {block.type === 'text' && !block.layer?.hidden && <button type="button" aria-pressed={editingInline} onClick={onToggleInline}>Editar texto no canvas</button>}
      <BlockFields block={block} onChange={onChange} onBusy={onBusy} inlineTarget={inlineTarget} />
    </div>
  </fieldset>;
}

