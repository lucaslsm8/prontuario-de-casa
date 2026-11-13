// Comprimido e cartela desenhados em SVG (esboço: docs/cartela-remedio.html).
import { useId, type CSSProperties } from 'react';
import { colunasCartela, estadosCartela, hexCor, type EstadoPilula } from '../data/cartela';
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
    <g fill="none" stroke="var(--text-3)" strokeWidth={1.6} strokeDasharray="3 2.6"><Forma forma={a.forma} /></g>
  );
  const sulco = a.forma !== 'capsula' && a.sulco ? SULCO[a.forma] : null;
  return (
    <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} className={cx('pilula', className)} style={style} aria-hidden overflow="visible">
      {estado !== 'contorno' && (
        <defs>
          <clipPath id={id}><Forma forma={a.forma} /></clipPath>
          {estado === 'metade' && <clipPath id={`${id}m`}><rect x="0" y="0" width="24" height="48" /></clipPath>}
        </defs>
      )}
      {estado !== 'cheio' && contorno}
      {estado !== 'contorno' && (
        <g className="pilula__corpo" clipPath={estado === 'metade' ? `url(#${id}m)` : undefined}>
          <g clipPath={`url(#${id})`}>
            {foto ? (
              <image href={foto} x="0" y="0" width="48" height="48" preserveAspectRatio="xMidYMid slice" />
            ) : a.forma === 'capsula' ? (
              <><rect width="24" height="48" fill={hexCor(a.cor)} /><rect x="24" width="24" height="48" fill={hexCor(a.cor2 ?? a.cor)} /></>
            ) : (
              <rect width="48" height="48" fill={hexCor(a.cor)} />
            )}
            {!foto && <ellipse cx="17" cy="17" rx="10" ry="5" fill="#fff" opacity={0.35} />}
          </g>
          <g fill="none" stroke="rgba(20,32,42,.28)" strokeWidth={1.1}><Forma forma={a.forma} /></g>
          {sulco && !foto && <line x1="24" y1={sulco[0]} x2="24" y2={sulco[1]} stroke="rgba(20,32,42,.25)" strokeWidth={1.2} />}
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
    <div className="cartela" style={{ gridTemplateColumns: `repeat(${colunasCartela(r.cartela)}, minmax(0, 1fr))` }} role="img" aria-label={`Cartela aberta: ${textoEstoque(r)} no total`}>
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
