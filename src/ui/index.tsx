import { Fragment, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Pessoa } from '../data/types';
import { inicial } from '../data/format';

type Kids = { children?: ReactNode };
/** Corta texto longo com reticências (precisa de largura limitada). */
export const reticencias: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export function Avatar({ pessoa, size = 36, font }: { pessoa: Pessoa; size?: number; font?: number }) {
  const fs = font ?? Math.round(size * 0.36);
  return (
    <span className="avatar" style={{ width: size, height: size, background: pessoa.cor, fontSize: fs }} aria-hidden>
      {pessoa.foto ? <img src={pessoa.foto} alt="" /> : inicial(pessoa)}
    </span>
  );
}

export function Lock({ large }: { large?: boolean }) {
  return (
    <span className={cx('lock', large && 'lock--lg')} aria-hidden>
      <span className="lock__shackle" />
      <span className="lock__body" />
    </span>
  );
}

export function Chip({
  ativo, tom = 'dark', tamanho, largo, onClick, children,
}: Kids & { ativo?: boolean; tom?: 'dark' | 'teal'; tamanho?: 'sm' | 'md' | 'xs'; largo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={cx('chip', tamanho && `chip--${tamanho}`, largo && 'chip--wide', ativo && (tom === 'dark' ? 'is-dark' : 'is-teal'))}
      aria-pressed={ativo}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({
  opcoes, valor, onChange, tom, tamanho, largo, gap6, separarAntes,
}: {
  opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void;
  tom?: 'dark' | 'teal'; tamanho?: 'sm' | 'md' | 'xs'; largo?: boolean; gap6?: boolean;
  /** Índice antes do qual entra um separador fino (pessoas | pets). */
  separarAntes?: number;
}) {
  return (
    <div className={cx('chips', gap6 && 'chips--6')} role="radiogroup">
      {opcoes.map((o, i) => (
        <Fragment key={o.id}>
          {i > 0 && i === separarAntes && <span className="chips__sep" aria-hidden />}
          <Chip ativo={valor === o.id} tom={tom} tamanho={tamanho} largo={largo} onClick={() => onChange(o.id)}>
            {o.nome}
          </Chip>
        </Fragment>
      ))}
    </div>
  );
}

/** Divisória de seção nas listas (ex.: "Pets" depois da família): rótulo mono em caixa alta + linha. */
export function SecaoLista({ rotulo, style }: { rotulo: string; style?: CSSProperties }) {
  return (
    <div className="secao-lista" style={style} role="separator" aria-label={rotulo}>
      <span>{rotulo}</span>
    </div>
  );
}

export function Toggle({ on, onChange, small, label }: { on: boolean; onChange: (v: boolean) => void; small?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cx('toggle', small && 'toggle--sm', on && 'is-on')}
      onClick={() => onChange(!on)}
    />
  );
}

export function Segmented<T extends string>({
  opcoes, valor, onChange, variante,
}: { opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void; variante?: 'sm' | 'desk' }) {
  return (
    <div className={cx('segmented', variante && `segmented--${variante}`)} role="tablist">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} className={cx(valor === o.id && 'is-on')} onClick={() => onChange(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Pill({ tom = 'teal', grande, pequeno, children, style }: Kids & { tom?: 'teal' | 'warn' | 'neutral'; grande?: boolean; pequeno?: boolean; style?: CSSProperties }) {
  return <span className={cx('pill', `pill--${tom}`, grande && 'pill--lg', pequeno && 'pill--sm')} style={style}>{children}</span>;
}

export function Bar({ pct, baixo, trilhoAlerta, grossa }: { pct: number; baixo?: boolean; trilhoAlerta?: boolean; grossa?: boolean }) {
  return (
    <div className={cx('bar', baixo && 'is-low', trilhoAlerta && 'bar--warn-track', grossa && 'bar--6')} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Label({ children, style, cor }: Kids & { style?: CSSProperties; cor?: string }) {
  return <span className="label" style={{ ...style, color: cor }}>{children}</span>;
}

export function Card({ children, pad, tom, style, className }: Kids & { pad?: boolean; tom?: 'warn' | 'dashed'; style?: CSSProperties; className?: string }) {
  return <div className={cx('card', pad && 'card--pad', tom && `card--${tom}`, className)} style={style}>{children}</div>;
}

/** Linha de lista "rótulo · valor". */
export function Row({
  label, valor, onClick, chevron, tight, compact, mutedLabel = true, valorStyle, style, children,
}: Kids & {
  label?: ReactNode; valor?: ReactNode; onClick?: () => void; chevron?: boolean; tight?: boolean; compact?: boolean;
  mutedLabel?: boolean; valorStyle?: CSSProperties; style?: CSSProperties;
}) {
  const content = children ?? (
    <>
      <span className={mutedLabel ? 'row__label' : undefined}>{label}</span>
      <span className="row__value" style={valorStyle}>
        {valor}
        {chevron && ' ›'}
      </span>
    </>
  );
  const cls = cx('row', tight && 'row--tight', compact && 'row--compact');
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} style={style}>{content}</button>
  ) : (
    <div className={cls} style={style}>{content}</div>
  );
}

export function Field({ label, children, gap = 6 }: Kids & { label: string; gap?: number }) {
  return (
    <label className="field" style={{ gap }}>
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export function FieldGroup({ label, children }: Kids & { label: string }) {
  return (
    <div className="field" style={{ gap: 8 }}>
      <span className="field__label">{label}</span>
      {children}
    </div>
  );
}

/** Barra de navegação de topo das telas internas: "‹ Voltar" · título · ação. */
export function TopNav({
  voltar, voltarPara, onVoltar, titulo, acao, onAcao, acaoDesativada, extra,
}: {
  /** `onVoltar` substitui a navegação padrão (`voltarPara` ou histórico). */
  voltar?: string; voltarPara?: string | number; onVoltar?: () => void; titulo?: string; acao?: string; onAcao?: () => void; acaoDesativada?: boolean; extra?: ReactNode;
}) {
  const nav = useNavigate();
  const back = onVoltar ?? (() => (typeof voltarPara === 'string' ? nav(voltarPara) : nav(-1)));
  const cancelar = voltar === 'Cancelar';
  return (
    <div className="hstack" style={{ justifyContent: 'space-between', fontSize: 15, minHeight: 22 }}>
      <button type="button" onClick={back} style={{ color: 'var(--teal)', fontWeight: 500, minHeight: 44, margin: '-11px 0' }}>
        {cancelar ? voltar : `‹ ${voltar}`}
      </button>
      {titulo && <span style={{ fontWeight: 600 }}>{titulo}</span>}
      {extra ??
        (acao ? (
          <button
            type="button"
            onClick={onAcao}
            disabled={acaoDesativada}
            style={{ color: acaoDesativada ? 'var(--text-3)' : 'var(--teal)', fontWeight: acaoDesativada ? 400 : 500, minHeight: 44, margin: '-11px 0' }}
          >
            {acao}
          </button>
        ) : (
          <span style={{ width: 52 }} />
        ))}
    </div>
  );
}

export function Thumb({ tipo, w = 44, h = 54 }: { tipo: string; w?: number; h?: number }) {
  return <span className="ph" style={{ width: w, height: h, borderRadius: 5, fontSize: 9, flex: 'none' }}>{tipo}</span>;
}

export function Check({ size = 26, font = 13 }: { size?: number; font?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: font, flex: 'none' }}>
      ✓
    </span>
  );
}
export function Circle({ size = 26 }: { size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', border: '1.5px solid var(--border-input)', flex: 'none' }} />;
}

/** Campo editável dentro de uma linha "rótulo · valor"; cresce com o conteúdo. */
export function InlineInput({ className, value, ...rest }: InputHTMLAttributes<HTMLInputElement> & { value: string | number }) {
  return <input {...rest} value={value} size={Math.max(2, String(value).length + 1)} className={cx('inline-input', className)} />;
}

export { cx };
