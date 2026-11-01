import { SANGUE } from '../data/formularios-puro';
import { cx } from './index';

/** Grade de tipo sanguíneo do celular (5 colunas, "Não sei" em 2). Tocar de novo desmarca. */
export function SangueGrid({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }} role="group" aria-label="Tipo sanguíneo">
      {[...SANGUE, 'nao-sei'].map((s) => {
        const on = valor === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? '' : s)}
            className={cx('chip', on && 'is-teal')}
            style={{
              height: 44, borderRadius: 6, padding: 0, fontSize: 14,
              gridColumn: s === 'nao-sei' ? 'span 2' : undefined,
              fontFamily: s === 'nao-sei' ? 'var(--font-sans)' : 'var(--font-mono)',
              fontWeight: s === 'nao-sei' ? 500 : 600,
            }}
          >
            {s === 'nao-sei' ? 'Não sei' : s}
          </button>
        );
      })}
    </div>
  );
}
