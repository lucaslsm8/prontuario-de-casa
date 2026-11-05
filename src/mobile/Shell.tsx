import type { CSSProperties, ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../data/store';
import { cx } from '../ui';
import { IcAgenda, IcExame, IcInicio, IcRemedio } from '../ui/Icones';
import { AbaPerfil, PerfilProvider } from './Perfil';

/** A quinta aba é a foto do perfil aberto (`AbaPerfil`): troca de perfil e abre a página da pessoa. */
const TABS = [
  { to: '/', nome: 'Início', end: true, Icone: IcInicio },
  { to: '/agenda', nome: 'Agenda', Icone: IcAgenda },
  { to: '/remedios', nome: 'Remédios', Icone: IcRemedio },
  { to: '/exames', nome: 'Exames', Icone: IcExame },
];

export function TabBar() {
  const { state } = useStore();
  const icones = !!state.config.menuIcones;
  return (
    <nav className={cx('tabbar', icones && 'tabbar--icones')} aria-label="Navegação principal">
      {TABS.map(({ to, nome, end, Icone }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(isActive && 'active')} aria-label={icones ? nome : undefined} title={icones ? nome : undefined}>
          {icones ? <Icone size={22} /> : nome}
        </NavLink>
      ))}
      <AbaPerfil />
    </nav>
  );
}

function StatusBar({ style, semHora }: { style?: CSSProperties; semHora?: boolean }) {
  return (
    <div className="statusbar" style={style}>
      <span>{semHora ? '' : '9:41'}</span>
      <span className="statusbar__icons">▪▪▪ ▮</span>
    </div>
  );
}

/**
 * Tela mobile. `tabs` adiciona a tab bar flutuante e reserva a área dela.
 * `pad` segue o mockup: telas com tab bar usam "14px 20px 0", formulários "14px 20px 34px".
 */
export function MScreen({
  children, gap = 16, tabs, pad, bg, statusStyle, semHora, style, scrollRef,
}: {
  children: ReactNode; gap?: number; tabs?: boolean; pad?: string; bg?: string; statusStyle?: CSSProperties; semHora?: boolean;
  style?: CSSProperties; scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const padding = pad ?? (tabs ? '14px 20px 120px' : '14px 20px 34px');
  return (
    <div className="screen" style={{ background: bg, ...(bg?.includes('gradient') ? { backgroundImage: bg } : {}) }}>
      <StatusBar style={statusStyle} semHora={semHora} />
      <div className="screen__scroll" ref={scrollRef}>
        <div className="screen__body" style={{ padding, gap, ...style }}>
          {children}
        </div>
      </div>
      {tabs && <TabBar />}
    </div>
  );
}

export function MobileShell({ frame }: { frame: boolean }) {
  const { toast, fecharToast } = useStore();
  const phone = (
    <div className={cx('phone', frame && 'is-frame')}>
      <PerfilProvider><Outlet /></PerfilProvider>
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.texto}</span>
          {toast.desfazer && (
            <button type="button" onClick={() => { toast.desfazer!(); fecharToast(); }}>
              Desfazer
            </button>
          )}
        </div>
      )}
    </div>
  );
  return frame ? <div className="canvas">{phone}</div> : phone;
}

/** Cabeçalho "Título + botão +" das abas. */
export function TabHeader({ titulo, onAdd, direita }: { titulo: string; onAdd?: () => void; direita?: ReactNode }) {
  return (
    <div className="hstack" style={{ justifyContent: 'space-between' }}>
      <h1 className="title" style={{ margin: 0 }}>{titulo}</h1>
      {direita ?? (onAdd && <button type="button" className="btn btn--plus" onClick={onAdd} aria-label={`Adicionar em ${titulo}`}>+</button>)}
    </div>
  );
}
