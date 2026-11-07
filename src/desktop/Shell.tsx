import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { eu, useStore } from '../data/store';
import { Avatar, SecaoLista, cx } from '../ui';
import { IcAgenda, IcConsulta, IcCadeado, IcEmergencia, IcExame, IcInicio, IcMarcaCheia, IcPlano, IcRemedio } from '../ui/Icones';
import { quando } from '../data/format';
import { useVoltar } from './useVoltar';
import { DEditarMedicao, DEditarPerfil, DEditarRegistroPet, DEditarVacina, DFichaEmergencia, DNovaConsulta, DNovaPessoa, DNovoExame, DNovaMedicao, DNovoPet, DNovoPlano, DNovoRemedio, DRegistroPet, REGISTROS_PET, type RegistroPet } from './Formularios';
import { familia, pets } from '../data/pets';
import type { TipoMedicao } from '../data/types';
import { BuscaDesktop } from '../ui/Busca';
import { saudacao } from '../data/inicio';
import { dataLonga } from '../data/format';
import { iso } from '../data/tempo';
import { dispensarAviso, instalarAtualizacao, useInfoAtualizacao, verificarAtualizacao } from '../data/atualizacao';

const NAV = [
  { to: '/', nome: 'Início', end: true, Icone: IcInicio },
  { to: '/agenda', nome: 'Agenda', Icone: IcAgenda },
  { to: '/consultas', nome: 'Consultas', Icone: IcConsulta },
  { to: '/remedios', nome: 'Remédios', Icone: IcRemedio },
  { to: '/exames', nome: 'Exames', Icone: IcExame },
  { to: '/planos', nome: 'Planos de saúde', Icone: IcPlano },
];

/**
 * Abre um formulário num diálogo largo: ?abrir=consulta|remedio|exame|pessoa|pet|plano[:<id>]|emergencia:<id>|perfil:<id>
 * e, para um pet, vacina|prevencao|sintoma|procedimento|pesagem:<petId> (vacina e procedimento também de pessoa);
 * editar-<remedio|consulta|exame|plano|vacina|prevencao|sintoma|procedimento|pesagem|medicao>:<id>.
 */
export function useAbrir() {
  const [params, setParams] = useSearchParams();
  return (o: string) => {
    const p = new URLSearchParams(params);
    p.set('abrir', o);
    setParams(p);
  };
}

function Dialogo() {
  const [params, setParams] = useSearchParams();
  const { state } = useStore();
  // Sem entrada anterior no histórico (aba aberta direto em ?abrir=…), tira o parâmetro da URL.
  const fechar = useVoltar(() => {
    const p = new URLSearchParams(params);
    p.delete('abrir');
    setParams(p, { replace: true });
  });
  const abrir = params.get('abrir');
  if (!abrir) return null;
  const [tipo, arg, arg2] = abrir.split(':');
  // `key` remonta o formulário (estado limpo) quando se troca de um para outro.
  if (tipo === 'consulta') return <DNovaConsulta key={abrir} onClose={fechar} />;
  if (tipo === 'remedio') return <DNovoRemedio key={abrir} onClose={fechar} />;
  if (tipo === 'exame') return <DNovoExame key={abrir} onClose={fechar} />;
  if (tipo === 'pessoa') return <DNovaPessoa key={abrir} onClose={fechar} />;
  if (tipo === 'pet') return <DNovoPet key={abrir} onClose={fechar} />;
  if (tipo === 'medicao' && arg) return <DNovaMedicao key={abrir} pessoaId={arg} tipo={arg2 as TipoMedicao | undefined} onClose={fechar} />;
  // Edição: ?abrir=editar-remedio:<id> (e consulta, exame, plano).
  if (tipo === 'editar-remedio') { const r = state.remedios.find((x) => x.id === arg); return r ? <DNovoRemedio key={abrir} remedio={r} onClose={fechar} /> : null; }
  if (tipo === 'editar-consulta') { const c = state.consultas.find((x) => x.id === arg); return c ? <DNovaConsulta key={abrir} consulta={c} onClose={fechar} /> : null; }
  if (tipo === 'editar-exame') { const e = state.exames.find((x) => x.id === arg); return e ? <DNovoExame key={abrir} exame={e} onClose={fechar} /> : null; }
  if (tipo === 'editar-vacina') return <DEditarVacina key={abrir} id={arg} onClose={fechar} />;
  if (tipo === 'editar-medicao') return <DEditarMedicao key={abrir} id={arg} onClose={fechar} />;
  // editar-prevencao|sintoma|procedimento|pesagem:<id>
  if (tipo.startsWith('editar-') && (REGISTROS_PET as string[]).includes(tipo.slice(7)) && tipo !== 'editar-vacina') {
    return <DEditarRegistroPet key={abrir} registro={tipo.slice(7) as Exclude<RegistroPet, 'vacina'>} id={arg} onClose={fechar} />;
  }
  if (tipo === 'editar-plano') { const pl = state.planos.find((x) => x.id === arg); return pl ? <DNovoPlano key={abrir} plano={pl} onClose={fechar} /> : null; }
  if (tipo === 'plano') return <DNovoPlano key={abrir} pessoaId={arg} onClose={fechar} />;
  if (tipo === 'emergencia') return <DFichaEmergencia key={abrir} pessoaId={arg} onClose={fechar} />;
  if (tipo === 'perfil') return <DEditarPerfil key={abrir} pessoaId={arg} onClose={fechar} />;
  if ((REGISTROS_PET as string[]).includes(tipo)) return <DRegistroPet key={abrir} registro={tipo as RegistroPet} petId={arg} onClose={fechar} />;
  return null;
}

export function Sidebar() {
  const { state } = useStore();
  const loc = useLocation();
  const abrir = useAbrir();
  const me = eu(state);
  const ultimo = state.config.backup.ultimo;
  return (
    <aside className="sidebar">
      <span className="sidebar__brand">
        <span className="sidebar__selo"><IcMarcaCheia size={44} /></span>
        <span className="stack" style={{ lineHeight: 1.15 }}>
          <span style={{ fontWeight: 700 }}>Prontuário</span>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>de Casa</span>
        </span>
      </span>
      <button type="button" className="sidebar__busca" onClick={() => window.dispatchEvent(new Event('abrir-busca'))}>Buscar…<kbd>Ctrl K</kbd></button>
      <nav aria-label="Navegação principal">
        {NAV.map(({ to, nome, end, Icone }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(isActive && 'active')}><Icone />{nome}</NavLink>
        ))}
      </nav>
      <div className="sidebar__people">
        <span className="mono" style={{ padding: '0 12px 8px', fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)' }}>PESSOAS</span>
        {familia(state).map((p) => (
          <NavLink key={p.id} to={`/pessoa/${p.id}`} className={() => cx('sidebar__person', loc.pathname === `/pessoa/${p.id}` && 'active')}>
            <Avatar pessoa={p} size={26} font={11} />
            {p.souEu ? `${p.curto} (você)` : p.curto}
          </NavLink>
        ))}
        <button type="button" className="sidebar__add" onClick={() => abrir('pessoa')}>+ Adicionar pessoa</button>
        <SecaoLista rotulo="Pets" style={{ padding: '14px 12px 8px' }} />
        {pets(state).map((p) => (
          <NavLink key={p.id} to={`/pessoa/${p.id}`} className={() => cx('sidebar__person', loc.pathname === `/pessoa/${p.id}` && 'active')}>
            <Avatar pessoa={p} size={26} font={11} />
            {p.curto}
          </NavLink>
        ))}
        <button type="button" className="sidebar__add" onClick={() => abrir('pet')}>+ Adicionar pet</button>
      </div>
      <div className="sidebar__pe">
        <button type="button" className="sidebar__emergencia" onClick={() => abrir(`emergencia:${me.id}`)}><IcEmergencia />Ficha de emergência</button>
        <NavLink to="/privacidade" className={({ isActive }) => cx('sidebar__eu', isActive && 'active')}>
          <Avatar pessoa={me} size={34} font={13} />
          <span className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{me.curto}</span>
            <span className="sidebar__backup">{ultimo ? `Backup ${quando(ultimo)}` : 'Sem backup ainda'}</span>
          </span>
          <span className="sidebar__cadeado" aria-label="Privacidade e backup"><IcCadeado size={16} /></span>
        </NavLink>
      </div>
    </aside>
  );
}

/** D08 — Atualização disponível (tauri-plugin-updater; no navegador, a versão fictícia do seed). */
function ModalAtualizacao() {
  const { state, api } = useStore();
  const u = state.config.update;
  const at = useInfoAtualizacao();
  const d = at.disponivel;
  if (!d) return null;
  const baixando = at.estado === 'baixando';
  return (
    <div className="overlay overlay--fixed">
      <div className="dialog" role="dialog" aria-label="Nova versão disponível">
        <div className="stack" style={{ padding: '26px 28px 18px', gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '.1em', color: 'var(--text-2)' }}>{u.instalada} → {d.versao}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>Nova versão disponível</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{d.publicadaData ? `Publicada em ${d.publicadaData} no GitHub Releases` : 'Publicada no GitHub Releases'} · assinatura conferida</span>
        </div>
        <div className="stack" style={{ margin: '0 28px', padding: 16, borderRadius: 8, background: 'var(--bg)', gap: 8, fontSize: 14, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600 }}>O que mudou</span>
          {d.notas.length ? d.notas.map((n) => <span key={n}>• {n}</span>) : <span className="muted">Correções e melhorias.</span>}
        </div>
        <button
          type="button"
          className="hstack"
          style={{ padding: '16px 28px', gap: 10, fontSize: 14 }}
          onClick={() => api.setConfig({ update: { ...u, backupAntes: !u.backupAntes } })}
          role="checkbox"
          aria-checked={u.backupAntes}
        >
          <span style={{ width: 20, height: 20, borderRadius: 6, background: u.backupAntes ? 'var(--teal)' : '#fff', border: u.backupAntes ? undefined : '1.5px solid var(--border-input)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>
            {u.backupAntes ? '✓' : ''}
          </span>
          Fazer backup antes de instalar{!state.config.backup.temSenha && <span className="muted">(crie a senha do backup em Privacidade)</span>}
        </button>
        {at.estado === 'erro' && <span style={{ padding: '0 28px 12px', fontSize: 13, color: 'var(--danger)' }}>A atualização não foi instalada. Seus dados não foram alterados.</span>}
        <div className="hstack" style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--divider)', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {baixando ? (at.progresso != null ? `Baixando… ${at.progresso}%` : 'Baixando…') : 'O app reinicia sozinho depois de instalar.'}
          </span>
          <div className="hstack" style={{ gap: 8 }}>
            <button type="button" className="btn btn--outline btn--h40d" onClick={dispensarAviso} disabled={baixando}>Agora não</button>
            <button type="button" className="btn btn--teal btn--h40d" onClick={() => void instalarAtualizacao({ state, api })} disabled={baixando}>{baixando ? 'Instalando…' : 'Instalar e reiniciar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bloqueio por senha no desktop (não desenhado; segue o visual da M11). Também antes do "Quem é você?" (App.tsx). */
export function BloqueioDesktop() {
  const { state, api } = useStore();
  const [senha, setSenha] = useState('');
  const [errou, setErrou] = useState(false);
  const [ver, setVer] = useState(false);
  const me = state.pessoas.find((p) => p.souEu);
  const agora = new Date();
  const ola = saudacao(agora.getHours() * 60 + agora.getMinutes());
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha) return;
    const ok = await api.desbloquear(senha);
    setSenha('');
    setErrou(!ok);
  };
  return (
    <div className="bloqueio">
      <span className="bloqueio__anel bloqueio__anel--1" aria-hidden />
      <span className="bloqueio__anel bloqueio__anel--2" aria-hidden />
      <form className={cx('bloqueio__cartao', errou && 'is-erro')} onSubmit={entrar}>
        <span className="bloqueio__marca"><IcMarcaCheia size={72} /></span>
        <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
          <span className="bloqueio__data">{dataLonga(iso(agora))} · {String(agora.getHours()).padStart(2, '0')}:{String(agora.getMinutes()).padStart(2, '0')}</span>
          <h1 className="bloqueio__titulo">{ola}{me ? `, ${me.curto}` : ''}</h1>
          <span className="bloqueio__sub" role={errou ? 'alert' : undefined}>{errou ? 'Senha incorreta. Tente de novo.' : 'Digite sua senha para abrir o prontuário.'}</span>
        </div>
        <div className="bloqueio__campo">
          <input className="input" type={ver ? 'text' : 'password'} autoFocus value={senha} onChange={(e) => { setSenha(e.target.value); setErrou(false); }} aria-label="Senha" placeholder="Senha" />
          <button type="button" className="bloqueio__ver" onClick={() => setVer((v) => !v)} aria-pressed={ver}>{ver ? 'Ocultar' : 'Mostrar'}</button>
        </div>
        <button type="submit" className="btn btn--teal btn--h48" style={{ width: '100%' }} disabled={!senha}>Abrir</button>
        <span className="bloqueio__rodape"><IcCadeado size={14} />Dados cifrados neste computador. Nada sai daqui.</span>
      </form>
    </div>
  );
}

export function DesktopShell() {
  const store = useStore();
  const { state, toast, fecharToast } = store;
  const [params] = useSearchParams();
  const nav = useNavigate();
  const at = useInfoAtualizacao();
  // O aviso abre quando a verificação (ao abrir ou pelo botão) acha versão nova. ?update=1 força uma verificação (barra "Telas").
  useEffect(() => {
    if (params.get('update') !== '1') return;
    void verificarAtualizacao(store, { manual: true });
    const p = new URLSearchParams(params);
    p.delete('update');
    nav({ search: p.toString() }, { replace: true });
  }, [params, nav, store]);
  return (
    <div className="desk">
      <Sidebar />
      <main className="desk__main">
        <Outlet />
      </main>
      <Dialogo />
      <BuscaDesktop />
      {at.aviso && !params.get('abrir') && !state.bloqueado && <ModalAtualizacao />}
      {state.bloqueado && <BloqueioDesktop />}
      {toast && (
        <div className="toast toast--desk" role="status" key={toast.id}>
          <span>{toast.texto}</span>
          {toast.desfazer && <button type="button" onClick={() => { toast.desfazer!(); fecharToast(); }}>Desfazer</button>}
        </div>
      )}
    </div>
  );
}
