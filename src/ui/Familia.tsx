// Família e aparelhos: criar a família (repositório privado no GitHub), convite em texto, entrar e "Quem é você?".
import { useState } from 'react';
import { useStore } from '../data/store';
import { persistencia } from '../data/persistencia';
import { definirFamilia, sincronizar, useInfoSync } from '../data/sincronizacao';
import { quando } from '../data/format';
import { ehPet } from '../data/pets';
import { Folha, SenhaApp } from './Backup';
import { Label, Lock } from './index';

const texto = { fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' } as const;
const erroTxt = { fontSize: 13, color: 'var(--danger)' } as const;

/** Privacidade e backup › Família e aparelhos (desktop). */
export function CardFamilia() {
  const store = useStore();
  const s = useInfoSync();
  const [folha, setFolha] = useState<null | 'criar' | 'entrar' | 'convite' | 'sair'>(null);
  const status = !s.familia ? '' : s.estado === 'sincronizando' ? 'Sincronizando…' : s.estado === 'erro' ? (s.token ? 'Token do GitHub sem acesso ou vencido' : `Não sincronizou: ${s.erro}`) : s.ultima ? `Sincronizado ${quando(s.ultima)} · pelo GitHub` : 'Ainda não sincronizou';
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className="card-head card-head--20"><Label>Família e aparelhos</Label></div>
      {!s.familia ? (
        <div className="stack" style={{ padding: '16px 20px', gap: 12 }}>
          <span style={texto}>Sincronize seus aparelhos e os da família por um repositório privado no GitHub. Tudo vai cifrado: o GitHub só guarda arquivos ilegíveis.</span>
          <div className="hstack" style={{ gap: 8 }}>
            <button type="button" className="btn btn--ink btn--h38" onClick={() => setFolha('criar')}>Criar família</button>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} onClick={() => setFolha('entrar')}>Entrar com convite</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ padding: '14px 20px' }}>
            <span className="stack" style={{ gap: 2 }}>
              <span>Repositório <span className="mono">{s.familia.repo}</span></span>
              <span style={{ fontSize: 13, color: s.estado === 'erro' ? 'var(--danger)' : 'var(--text-2)' }}>{status}</span>
            </span>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} disabled={s.estado === 'sincronizando'} onClick={() => void sincronizar(store, { manual: true })}>Sincronizar agora</button>
          </div>
          <div className="row" style={{ padding: '14px 20px' }}>
            <span className="muted">Este aparelho</span>
            <span className="mono">{store.api.aparelhoId()}</span>
          </div>
          <div className="hstack" style={{ padding: '14px 20px', gap: 8 }}>
            <button type="button" className="btn btn--ink btn--h38" onClick={() => setFolha('convite')}>Convidar aparelho</button>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent', color: 'var(--danger)' }} onClick={() => setFolha('sair')}>Sair da família</button>
          </div>
        </>
      )}
      {folha === 'criar' && <CriarFamilia onClose={() => setFolha(null)} />}
      {folha === 'entrar' && <EntrarNaFamilia desktop onClose={() => setFolha(null)} />}
      {folha === 'convite' && <Convite onClose={() => setFolha(null)} />}
      {folha === 'sair' && <SairDaFamilia onClose={() => setFolha(null)} />}
    </div>
  );
}

function CriarFamilia({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const criar = async () => {
    setOcupado(true); setErro('');
    try {
      definirFamilia(await persistencia.familiaCriar(repo, token));
      onClose();
      void sincronizar(store, { manual: true });
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop onClose={onClose} titulo="Criar família">
      <span style={texto}>1. No GitHub, crie um repositório <b>privado</b> vazio (ex.: prontuario-sync).<br />2. Em Settings › Developer settings › Fine-grained tokens, gere um token só para esse repositório, com <b>Contents: Read and write</b>.<br />3. Cole os dois aqui. O token fica cifrado neste aparelho.</span>
      <input className="input input--desk" placeholder="dono/nome (ex.: lucas/prontuario-sync)" value={repo} onChange={(e) => setRepo(e.target.value)} autoFocus aria-label="Repositório" />
      <input className="input input--desk input--mono" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token do GitHub" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className="btn btn--ink btn--h40d" disabled={!repo.trim() || !token.trim() || ocupado} onClick={criar}>{ocupado ? 'Conferindo o repositório…' : 'Criar família'}</button>
    </Folha>
  );
}

/** Colar o convite (desktop agora; o QR vem na Etapa 4). Usado no card e no primeiro uso. */
export function EntrarNaFamilia({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
  const store = useStore();
  const [convite, setConvite] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Já entrou, mas a primeira sincronização falhou: a folha fica aberta até baixar os dados da família,
  // para ninguém se cadastrar de novo num aparelho vazio (duplicaria a pessoa na família).
  const [entrou, setEntrou] = useState(false);
  const baixar = async () => {
    const r = await sincronizar(store, { manual: true });
    if (r.ok) return onClose();
    setErro(`Entrou na família, mas não foi possível baixar os dados: ${r.erro ?? 'erro desconhecido'}`);
  };
  const entrar = async () => {
    setOcupado(true); setErro('');
    try {
      if (!entrou) {
        definirFamilia(await persistencia.familiaEntrar(convite));
        setEntrou(true);
      }
      await baixar();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop={desktop} onClose={entrou ? () => {} : onClose} titulo="Entrar na família">
      <span style={texto}>Em um aparelho que já está na família, abra Privacidade e backup › Convidar aparelho e copie o convite. Cole aqui.</span>
      <textarea className="input input--desk input--area input--mono" placeholder="PCASA1:…" value={convite} onChange={(e) => setConvite(e.target.value)} readOnly={entrou} autoFocus aria-label="Convite" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!convite.trim() || ocupado} onClick={entrar}>{ocupado ? 'Baixando os dados da família…' : entrou ? 'Tentar de novo' : 'Entrar'}</button>
    </Folha>
  );
}

function Convite({ onClose }: { onClose: () => void }) {
  const { api } = useStore();
  const [convite, setConvite] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const mostrar = async () => { setErro(''); try { setConvite(await persistencia.familiaConvite()); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } };
  const copiar = async () => {
    if (!convite) return;
    setErro('');
    try {
      await navigator.clipboard.writeText(convite);
      api.toast({ texto: 'Convite copiado' });
    } catch (e) { setErro(`Não foi possível copiar: ${e instanceof Error ? e.message : String(e)}`); }
  };
  return (
    <Folha desktop onClose={onClose} titulo="Convidar aparelho" alerta>
      <span style={texto}>O convite leva a chave da família e o token do GitHub: quem tiver o texto entra na família. Passe só para os seus aparelhos e os da família, por um canal seu, e apague depois de usar.</span>
      {convite ? (
        <>
          <textarea className="input input--desk input--area input--mono" readOnly value={convite} aria-label="Convite" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn--ink btn--h40d" onClick={copiar}>Copiar convite</button>
        </>
      ) : (
        <button type="button" className="btn btn--ink btn--h40d" onClick={mostrar}>Mostrar convite</button>
      )}
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
    </Folha>
  );
}

function SairDaFamilia({ onClose }: { onClose: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const sair = async () => {
    setOcupado(true); setErro('');
    try {
      await persistencia.familiaSair();
      definirFamilia(null);
      onClose();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop onClose={onClose} titulo="Sair da família?" alerta>
      <span style={texto}>Este aparelho para de sincronizar. Os dados que já estão aqui continuam aqui; os outros aparelhos não perdem nada.</span>
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className="btn btn--h40d" style={{ background: 'var(--danger)', color: 'var(--surface)' }} disabled={ocupado} onClick={sair}>Sair da família</button>
    </Folha>
  );
}

/** Depois de entrar na família (ou restaurar dados de outra pessoa): escolher quem usa este aparelho.
 *  Só aparece desbloqueado (App.tsx mostra o bloqueio antes, sem os nomes). */
export function QuemEVoce({ onEscolhido }: { onEscolhido?: () => void }) {
  const { state, api } = useStore();
  const pessoas = state.pessoas.filter((p) => !ehPet(p));
  return (
    <div className="pu" style={{ placeItems: 'center', display: 'grid', minHeight: '100vh' }}>
      <div className="stack" style={{ gap: 18, width: 'min(420px, 100% - 32px)' }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="pu__rotulo">FAMÍLIA</span>
          <h2 className="pu__titulo" style={{ margin: 0 }}>Quem é você?</h2>
          <span style={texto}>Escolha o seu perfil. Ele passa a ser o "você" deste aparelho.</span>
        </div>
        <div className="card">
          {pessoas.map((p) => (
            <button key={p.id} type="button" className="row" style={{ padding: '14px 20px', fontSize: 15, minHeight: 48 }} onClick={() => { api.definirEu(p.id); onEscolhido?.(); }}>
              <span>{p.nome}</span><span className="muted">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Depois do "Quem é você?" num aparelho sem senha: o mesmo passo "Proteja o app" do primeiro uso. */
export function ProtejaEsteAparelho({ desktop, onFim }: { desktop?: boolean; onFim: () => void }) {
  const [folha, setFolha] = useState(false);
  return (
    <div className="pu" style={{ placeItems: 'center', display: 'grid', gridTemplateColumns: '1fr', minHeight: '100vh' }}>
      <div className="stack" style={{ gap: 18, width: 'min(420px, 100% - 32px)' }}>
        <span className="pu__selo"><Lock large /></span>
        <div className="stack" style={{ gap: 8 }}>
          <h2 className="pu__titulo" style={{ margin: 0 }}>Proteja o app</h2>
          <span style={texto}>
            {desktop
              ? 'Com uma senha, o app pede para entrar ao abrir e depois de alguns minutos sem uso. Os dados já ficam criptografados neste computador.'
              : 'Com um PIN, o app pede para entrar ao abrir e depois de um tempo sem uso. Os dados já ficam criptografados neste aparelho.'}
          </span>
        </div>
        <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--outline btn--h40d" style={{ minHeight: 44 }} onClick={onFim}>Agora não</button>
          <button type="button" className="btn btn--ink btn--h40d" style={{ minHeight: 44 }} onClick={() => setFolha(true)} autoFocus>{desktop ? 'Criar senha' : 'Criar PIN'}</button>
        </div>
      </div>
      {folha && <SenhaApp desktop={desktop} onClose={() => setFolha(false)} onPronto={onFim} />}
    </div>
  );
}
