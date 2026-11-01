// Faixa de números no topo das páginas do desktop (mesmo visual da coluna direita do Início).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './index';

export interface Numero { rotulo: string; valor: ReactNode; det?: ReactNode; icone: ReactNode; tom?: 'teal' | 'neutro' | 'warn' | 'sol'; alerta?: boolean; para?: string; onClick?: () => void }

export function FaixaNumeros({ itens }: { itens: Numero[] }) {
  return (
    <div className="faixa-numeros" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map((n) => {
        const corpo = (
          <>
            <span className={cx('numero__ic', n.tom === 'neutro' && 'numero__ic--neutro', n.tom === 'warn' && 'numero__ic--warn', n.tom === 'sol' && 'numero__ic--sol')}>{n.icone}</span>
            <span className="stack" style={{ flex: 1, minWidth: 0 }}>
              <span className="numero__rot">{n.rotulo}</span>
              {n.det && <span className={cx('numero__det', n.alerta && (n.tom === 'warn' ? 'numero__det--warn' : 'numero__det--alerta'))}>{n.det}</span>}
            </span>
            <span className="numero__valor numero__valor--sm">{n.valor}</span>
          </>
        );
        if (n.para) return <Link key={n.rotulo} to={n.para} className="card numero">{corpo}</Link>;
        if (n.onClick) return <button key={n.rotulo} type="button" className="card numero" onClick={n.onClick}>{corpo}</button>;
        return <div key={n.rotulo} className="card numero">{corpo}</div>;
      })}
    </div>
  );
}
