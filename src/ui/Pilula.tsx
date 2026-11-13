// Comprimido e cartela desenhados em SVG (esboço: docs/cartela-remedio.html).
import { useId, type CSSProperties } from 'react';
import { CARTELAS_COMUNS, FRASCOS_COMUNS_ML, GOTAS_POR_ML, colunasCartela, ehLiquido, emMl, estadosCartela, hexCor, nivelFrasco, type EstadoPilula } from '../data/cartela';
import { anexosDe } from '../data/anexos';
import { textoEstoque } from '../data/format';
import { useStore } from '../data/store';
import type { Aparencia, FormaPilula, Remedio } from '../data/types';
import { cx } from '.';

const PADRAO: Aparencia = { forma: 'redondo', cor: 'branco', sulco: false };

function Forma({ forma }: { forma: FormaPilula }) {
  switch (forma) {
    case 'oval': return <ellipse cx="24" cy="24" rx="19" ry="13" />;
    case 'oblongo': return <rect x="5" y="15" width="38" height="18" rx="9" />;
    case 'capsula': return <rect x="4" y="15.5" width="40" height="17" rx="8.5" />;
    default: return <circle cx="24" cy="24" r="16" />;
  }
}
const SULCO: Record<FormaPilula, [number, number] | null> = { redondo: [9, 39], oval: [12, 36], oblongo: [16, 32], capsula: null };

/**
 * Um comprimido. `estado`: inteiro, metade (só a esquerda, com o contorno da outra) ou só o contorno tracejado (tomado).
 * `foto`: a foto recortada do comprimido no lugar do desenho, na forma escolhida.
 */
export function Pilula({ aparencia, estado = 'cheio', foto, tamanho, className, style }: {
  aparencia?: Aparencia; estado?: EstadoPilula; foto?: string; tamanho?: number; className?: string; style?: CSSProperties;
}) {
  const a = aparencia ?? PADRAO;
  const id = `p${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const contorno = (
    <g fill="none" stroke="rgba(20,32,42,.42)" strokeWidth={1.6} strokeDasharray="2.6 2.2"><Forma forma={a.forma} /></g>
  );
  const sulco = a.forma !== 'capsula' && a.sulco ? SULCO[a.forma] : null;
  return (
    <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} className={cx('pilula', className)} style={style} aria-hidden overflow="visible">
      {estado !== 'contorno' && (
        <defs>
          <clipPath id={id}><Forma forma={a.forma} /></clipPath>
          {estado === 'metade' && <clipPath id={`${id}m`}><rect x="0" y="0" width="24" height="48" /></clipPath>}
          {/* Volume: luz por cima, sombra por baixo (vale para qualquer cor e para a foto). */}
          <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.45} />
            <stop offset=".45" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#14202A" stopOpacity={0.22} />
          </linearGradient>
        </defs>
      )}
      {estado !== 'cheio' && contorno}
      {estado !== 'contorno' && (
        <g className="pilula__corpo" clipPath={estado === 'metade' ? `url(#${id}m)` : undefined}>
          {/* Sombra no fundo da bolha. */}
          <g transform="translate(0 2.2)" opacity={0.16}><Forma forma={a.forma} /></g>
          <g clipPath={`url(#${id})`}>
            {foto ? (
              <image href={foto} x="0" y="0" width="48" height="48" preserveAspectRatio="xMidYMid slice" />
            ) : a.forma === 'capsula' ? (
              <><rect width="24" height="48" fill={hexCor(a.cor)} /><rect x="24" width="24" height="48" fill={hexCor(a.cor2 ?? a.cor)} /></>
            ) : (
              <rect width="48" height="48" fill={hexCor(a.cor)} />
            )}
            <rect width="48" height="48" fill={`url(#${id}l)`} />
            {!foto && <ellipse cx="18" cy="18.5" rx="7" ry="2.6" fill="#fff" opacity={0.55} transform="rotate(-12 18 18.5)" />}
          </g>
          <g fill="none" stroke="rgba(20,32,42,.18)" strokeWidth={0.9}><Forma forma={a.forma} /></g>
          {sulco && !foto && <line x1="24" y1={sulco[0] + 1} x2="24" y2={sulco[1] - 1} stroke="rgba(20,32,42,.22)" strokeWidth={1} strokeLinecap="round" />}
        </g>
      )}
    </svg>
  );
}

/** A foto do comprimido (a mais recente), se houver. */
export function useFotoComprimido(remedioId: string) {
  const { state } = useStore();
  return anexosDe(state.anexos, remedioId, 'comprimido').sort((a, b) => b.em.localeCompare(a.em))[0]?.dados;
}

/** O comprimido do remédio, com a foto quando houver; nada se o remédio não tem aparência nem foto. */
export function PilulaDoRemedio({ r, tamanho, estado, className }: { r: Remedio; tamanho?: number; estado?: EstadoPilula; className?: string }) {
  const foto = useFotoComprimido(r.id);
  if (!r.aparencia && !foto) return null;
  return <Pilula aparencia={r.aparencia} foto={foto} tamanho={tamanho} estado={estado} className={className} />;
}

/** A cartela aberta, a partir do estoque. */
export function Cartela({ r }: { r: Remedio }) {
  const foto = useFotoComprimido(r.id);
  if (!r.cartela || r.estoque == null) return null;
  const { estados } = estadosCartela(r.estoque, r.cartela.porCartela);
  const rotulo = { cheio: 'na cartela', metade: 'meio comprimido', contorno: 'tomado' } as const;
  return (
    <div className="cartela" style={{ gridTemplateColumns: `repeat(${colunasCartela(r.cartela)}, minmax(0, 1fr))`, maxWidth: colunasCartela(r.cartela) * 72 + 28 }} role="img" aria-label={`Cartela aberta: ${textoEstoque(r)} no total`}>
      {estados.map((e, i) => (
        <span key={i} className={cx('cartela__bolha', e === 'contorno' && 'is-vazia')} title={rotulo[e]}>
          <Pilula aparencia={r.aparencia} foto={foto} estado={e} />
        </span>
      ))}
    </div>
  );
}

/** "6½ de 14 · +1 cartela fechada". */
export function contaCartela(r: Remedio) {
  if (!r.cartela || r.estoque == null) return '';
  const { resto, fechadas } = estadosCartela(r.estoque, r.cartela.porCartela);
  const n = Number.isInteger(resto) ? String(resto) : `${Math.floor(resto) || ''}½`;
  return `${n} de ${r.cartela.porCartela}${fechadas ? ` · +${fechadas} ${fechadas === 1 ? 'cartela fechada' : 'cartelas fechadas'}` : ''}`;
}

/** "≈ 12 mL" com vírgula. */
const ml = (n: number) => `${Number.isInteger(n) ? n : String(Math.round(n * 10) / 10).replace('.', ',')} mL`;

/** Frasco de gotas ou xarope com o nível baixando (esboço: docs/cartela-remedio.html, seção 6). */
export function Frasco({ r }: { r: Remedio }) {
  const id = `f${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!r.frasco || r.estoque == null || !ehLiquido(r)) return null;
  const { resto, pct, fechados } = nivelFrasco(r.estoque, r.frasco);
  const corpo = 'M22 40 h46 a8 8 0 0 1 8 8 v86 a10 10 0 0 1 -10 10 h-42 a10 10 0 0 1 -10 -10 v-86 a8 8 0 0 1 8 -8z';
  const topo = 40 + 104 * (1 - pct);
  return (
    <div className="frasco" role="img" aria-label={`Frasco aberto com cerca de ${ml(emMl(r, resto))}`}>
      <svg viewBox="0 0 90 150" className="frasco__svg" aria-hidden>
        <defs><clipPath id={id}><path d={corpo} /></clipPath></defs>
        <rect x="32" y="6" width="26" height="16" rx="3" fill="var(--text-3)" />
        <rect x="36" y="22" width="18" height="18" fill="var(--text-3)" opacity={0.6} />
        <g clipPath={`url(#${id})`}>
          <rect x="0" y="40" width="90" height="110" fill="#fff" />
          <rect className="frasco__liquido" x="0" y={topo} width="90" height="110" fill="var(--sol)" opacity={0.78} />
        </g>
        <path d={corpo} fill="none" stroke="var(--text-3)" strokeWidth={1.6} />
        {[0.25, 0.5, 0.75].map((p) => <line key={p} x1="66" x2="76" y1={144 - 104 * p} y2={144 - 104 * p} stroke="var(--text-3)" strokeWidth={1} />)}
      </svg>
      <span className="stack" style={{ gap: 2 }}>
        <b style={{ fontSize: 22 }}>≈ {ml(emMl(r, resto))}</b>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>de {ml(emMl(r, r.frasco))}{r.unidade === 'gotas' ? ` · ${Math.round(resto)} gotas` : ''}</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{r.doseLonga ?? r.dose} por dose</span>
        {fechados > 0 && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>+{fechados} {fechados === 1 ? 'frasco fechado' : 'frascos fechados'}</span>}
      </span>
    </div>
  );
}

/** Atalho na tela do remédio: o tamanho da cartela ou do frasco, para o desenho aparecer. */
export function DefinirTamanho({ r }: { r: Remedio }) {
  const { api } = useStore();
  const comprimido = r.unidade === 'comprimidos' || r.unidade === 'cápsulas';
  if (r.estoque == null || !r.ativo) return null;
  if (comprimido && !r.cartela) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Quantos {r.unidade} vêm em cada cartela? A cartela aparece desenhada aqui.</span>
        <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
          {CARTELAS_COMUNS.map((n) => (
            <button key={n} type="button" className="chip chip--sm" onClick={() => api.editar('remedios', r.id, { cartela: { porCartela: n, fileiras: n >= 10 ? 2 : 1 } }, `Cartela de ${n}`)}>{n}</button>
          ))}
        </div>
      </div>
    );
  }
  if (ehLiquido(r) && !r.frasco) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Qual o tamanho do frasco? O nível aparece desenhado aqui.</span>
        <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
          {FRASCOS_COMUNS_ML.map((n) => (
            <button key={n} type="button" className="chip chip--sm" onClick={() => api.editar('remedios', r.id, { frasco: r.unidade === 'gotas' ? n * GOTAS_POR_ML : n }, `Frasco de ${n} mL`)}>{n} mL</button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
