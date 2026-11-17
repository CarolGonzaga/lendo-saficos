import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Article } from '../types';
import './OverviewPanel.css';

type Totals = { posts: number; published: number; drafts: number; views: number; categories: number; tags: number; media: number };
type ViewDay = { date: string; views: number };
type TopPost = Article & { views: number };
type Overview = { totals: Totals; viewsSeries: ViewDay[]; topPosts: TopPost[] };

export type OverviewPanelProps = {
  onNewArticle: () => void;
  onEditArticle: (article: Article) => void;
};

/** Admin-only, bounded lookup for the current Posts page; articles without events have zero views. */
// eslint-disable-next-line react-refresh/only-export-components -- this is the only owned module for the Posts lookup.
export async function getArticleViewCounts(articleIds: number[]): Promise<Record<number, number>> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const ids = [...new Set(articleIds)];
  if (ids.length > 100) throw new Error('Consulte no máximo 100 matérias por vez.');
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('blog_article_view_counts', { article_ids: ids });
  if (error) throw new Error(`Não foi possível carregar leituras: ${error.message}`);
  return Object.fromEntries((data as { article_id: number; views: number }[]).map(row => [row.article_id, Number(row.views)]));
}

const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function ViewsChart({ days }: { days: ViewDay[] }) {
  const width = 640;
  const height = 210;
  const left = 34;
  const right = 12;
  const top = 12;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(1, ...days.map(day => day.views));
  const points = days.map((day, index) => ({
    x: left + (index * plotWidth) / Math.max(1, days.length - 1),
    y: top + plotHeight * (1 - day.views / maximum),
    ...day,
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x ?? left} ${top + plotHeight} L ${left} ${top + plotHeight} Z`;
  const hasViews = days.some(day => day.views > 0);
  return <>
    {hasViews ? <div className="overview-chart-wrap">
      <svg className="overview-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Leituras diárias nos últimos 30 dias">
        <defs><linearGradient id="overview-views-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a72966" stopOpacity=".26" /><stop offset="100%" stopColor="#a72966" stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={width-right} y1={top+plotHeight*fraction} y2={top+plotHeight*fraction} stroke="#ead2dd" /><text x={left-7} y={top+plotHeight*fraction+4} textAnchor="end">{number(Math.round(maximum*(1-fraction)))}</text></g>)}
        <path d={area} fill="url(#overview-views-fill)" /><path d={line} fill="none" stroke="#a72966" strokeWidth="2" />
        {points.map((point, index) => <g key={point.date}><circle cx={point.x} cy={point.y} r="3" fill="#a72966"><title>{`${dateLabel(point.date)}: ${number(point.views)} leituras`}</title></circle>{(index === 0 || index === Math.floor((points.length-1)/2) || index === points.length-1) && <text x={point.x} y={height-6} textAnchor={index === 0 ? 'start' : index === points.length-1 ? 'end' : 'middle'}>{dateLabel(point.date)}</text>}</g>)}
      </svg>
      <table className="overview-sr-only"><caption>Leituras por dia</caption><thead><tr><th>Dia</th><th>Leituras</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{dateLabel(day.date)}</td><td>{day.views}</td></tr>)}</tbody></table>
    </div> : <p className="overview-empty">Nenhuma leitura registrada ainda.</p>}
  </>;
}

export function OverviewPanel({ onNewArticle, onEditArticle }: OverviewPanelProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return; }
    void (async () => {
      try {
        const { data, error: requestError } = await supabase.rpc('blog_dashboard_overview');
        if (!active) return;
        if (requestError || !data) { setOverview(null); setError(`Não foi possível carregar o painel: ${requestError?.message || 'resposta vazia do banco'}`); }
        else setOverview(data as Overview);
      } catch (reason) {
        if (active) { setOverview(null); setError(reason instanceof Error ? reason.message : 'Falha ao carregar o painel.'); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [revision]);

  return <section className="overview-panel" aria-labelledby="overview-title">
    <div className="overview-heading"><div><p className="overview-eyebrow">Painel</p><h1 id="overview-title">Visão geral</h1><p>O pulso do blog: publicação, audiência e o que está performando.</p></div><div className="overview-actions"><button type="button" onClick={refresh} disabled={loading}>Atualizar</button><button type="button" className="overview-primary" onClick={onNewArticle}>+ Novo artigo</button></div></div>
    {loading && <p role="status">Carregando indicadores…</p>}
    {error && <div className="overview-error" role="alert"><p>{error}</p><button type="button" onClick={refresh}>Tentar novamente</button></div>}
    {!loading && overview && <>
      <div className="overview-cards">
        <div className="overview-card"><span>Publicados</span><strong>{number(overview.totals.published)}</strong><small>{number(overview.totals.posts)} no acervo</small></div>
        <div className="overview-card"><span>Rascunhos</span><strong>{number(overview.totals.drafts)}</strong><small>em andamento</small></div>
        <div className="overview-card"><span>Visualizações</span><strong>{number(overview.totals.views)}</strong><small>total acumulado</small></div>
        <div className="overview-card"><span>Taxonomia</span><strong>{number(overview.totals.categories)}</strong><small>{number(overview.totals.tags)} tags · {number(overview.totals.media)} imagens</small></div>
      </div>
      <div className="overview-content">
        <section className="overview-box" aria-labelledby="overview-chart-title"><div className="overview-box-heading"><h2 id="overview-chart-title">Leituras por dia</h2><span>Últimos 30 dias</span></div><ViewsChart days={overview.viewsSeries} /></section>
        <section className="overview-box" aria-labelledby="overview-top-title"><h2 id="overview-top-title">Mais lidos</h2>{overview.topPosts.length ? <ol className="overview-top-list">{overview.topPosts.map((post, index) => <li key={post.id}><span>{String(index+1).padStart(2, '0')}</span><div><button type="button" onClick={() => onEditArticle(post)}>{post.title}</button><small>{number(post.views)} leituras</small></div></li>)}</ol> : <p className="overview-empty">Publique o primeiro artigo para ver números.</p>}</section>
      </div>
    </>}
  </section>;
}
