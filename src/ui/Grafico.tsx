// Gráfico de linha do tempo (SVG próprio, sem biblioteca: o app é offline).
// Uma ou duas séries, faixa de referência opcional e o valor do ponto sob o cursor.

import { useLayoutEffect, useRef, useState } from 'react';
import type { Ponto } from '../data/medicoes';
import { parseISO } from '../data/format';

export interface Serie { nome: string; cor: string; pontos: Ponto[] }
export interface Faixa { de: number; ate: number }

const dia = (iso: string) => parseISO(iso).getTime() / 86_400_000;
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const curtaAno = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/** Ticks "redondos" entre min e max (3 a 5). */
function ticks(min: number, max: number) {
  const bruto = (max - min) / 3 || 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const out: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function Grafico({
  series, faixas = [], altura = 168, casas = 0, rotulo, vazio = 'Sem registros ainda.', yMin, yMax,
}: {
  series: Serie[]; faixas?: Faixa[]; altura?: number; casas?: number; rotulo: string; vazio?: string; yMin?: number; yMax?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [foco, setFoco] = useState<{ s: number; i: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const todos = series.flatMap((s) => s.pontos);
  if (todos.length === 0) return <div ref={ref} className="grafico grafico--vazio" style={{ height: altura }}>{vazio}</div>;

  const esq = 36, dir = 14, topo = 12, base = 22;
  const w = Math.max(largura, 120);
  const h = altura;
  const xs = todos.map((p) => dia(p.data));
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 1) { x0 -= 15; x1 += 15; }
  const ys = [...todos.map((p) => p.valor), ...faixas.flatMap((f) => [f.de, f.ate])];
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  const folga = (y1 - y0) * 0.12 || Math.max(1, Math.abs(y1) * 0.05);
  if (yMin == null) y0 -= folga;
  if (yMax == null) y1 += folga;
  const X = (d: number) => esq + ((d - x0) / (x1 - x0)) * (w - esq - dir);
  const Y = (v: number) => topo + (1 - (v - y0) / (y1 - y0)) * (h - topo - base);
  const anos = new Date(x1 * 86_400_000).getFullYear() !== new Date(x0 * 86_400_000).getFullYear() || x1 - x0 > 200;
  const fmtX = anos ? curtaAno : curta;
  const fmtY = (v: number) => (casas ? v.toFixed(casas).replace('.', ',') : String(Math.round(v)));

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let melhor: { s: number; i: number; d: number } | null = null;
    series.forEach((s, si) => s.pontos.forEach((p, i) => {
      const d = Math.hypot(X(dia(p.data)) - mx, (Y(p.valor) - my) * 0.35);
      if (!melhor || d < melhor.d) melhor = { s: si, i, d };
    }));
    setFoco(melhor && { s: (melhor as { s: number }).s, i: (melhor as { i: number }).i });
  };

  const p = foco && series[foco.s]?.pontos[foco.i];
  const ultimo = series[0].pontos[series[0].pontos.length - 1];

  return (
    <div ref={ref} className="grafico">
      {largura > 0 && (
        <svg width={w} height={h} role="img" aria-label={rotulo} onPointerMove={mover} onPointerLeave={() => setFoco(null)}>
          {faixas.map((f, i) => (
            <rect key={i} className="grafico__faixa" x={esq} width={w - esq - dir} y={Y(Math.min(f.ate, y1))} height={Math.max(0, Y(Math.max(f.de, y0)) - Y(Math.min(f.ate, y1)))} />
          ))}
          {ticks(y0, y1).map((t) => (
            <g key={t}>
              <line className="grafico__grade" x1={esq} x2={w - dir} y1={Y(t)} y2={Y(t)} />
              <text className="grafico__eixo" x={esq - 6} y={Y(t) + 3} textAnchor="end">{fmtY(t)}</text>
            </g>
          ))}
          <text className="grafico__eixo" x={X(x0)} y={h - 6} textAnchor="start">{fmtX(todos.reduce((a, b) => (a.data < b.data ? a : b)).data)}</text>
          <text className="grafico__eixo" x={X(x1)} y={h - 6} textAnchor="end">{fmtX(todos.reduce((a, b) => (a.data > b.data ? a : b)).data)}</text>
          {series.map((s) => (
            <g key={s.nome} style={{ color: s.cor }}>
              {s.pontos.length > 1 && <polyline className="grafico__linha" points={s.pontos.map((q) => `${X(dia(q.data))},${Y(q.valor)}`).join(' ')} />}
              {s.pontos.map((q, i) => (
                <circle key={i} className="grafico__ponto" cx={X(dia(q.data))} cy={Y(q.valor)} r={i === s.pontos.length - 1 ? 4.5 : 3} />
              ))}
            </g>
          ))}
          {p && (
            <g className="grafico__foco">
              <line x1={X(dia(p.data))} x2={X(dia(p.data))} y1={topo} y2={h - base} />
              <circle cx={X(dia(p.data))} cy={Y(p.valor)} r={6} style={{ color: series[foco!.s].cor }} />
            </g>
          )}
        </svg>
      )}
      {p ? (
        <span className="grafico__dica" style={{ left: Math.min(Math.max(X(dia(p.data)), 60), w - 60) }}>
          {p.rotulo ?? fmtY(p.valor)} · {curta(p.data)}/{p.data.slice(0, 4)}
        </span>
      ) : (
        series[0].pontos.length === 1 && ultimo && <span className="grafico__nota">Registre mais uma medição para ver a evolução.</span>
      )}
    </div>
  );
}
