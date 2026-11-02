// Família e aparelhos: criar a família (repositório privado no GitHub), convite em texto, entrar e "Quem é você?".
import { useState } from 'react';
import { useStore } from '../data/store';
import { persistencia } from '../data/persistencia';
import { atualizarFamilia, definirFamilia, ehRemovido, marcarRemovido, mensagemErro, sincronizar, useInfoSync } from '../data/sincronizacao';
import { quando } from '../data/format';
import { aparelhosDaFamilia, planoRemocao } from '../data/aparelhos';
import type { Aparelho } from '../data/types';
import { ehPet } from '../data/pets';
import { Folha, SenhaApp } from './Backup';
import { Label, Lock } from './index';
import { QrConvite } from './QrConvite';
import { leitorQrDisponivel, lerConviteQr } from '../data/leitorQr';

const texto = { fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' } as const;
// Telas soltas (Quem é você? / Proteja o app): coluna única, centralizada, serve de 390 px a desktop.
const telaCheia = { display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '24px 0', background: 'var(--bg)', overflowY: 'auto' } as const;
const erroTxt = { fontSize: 13, color: 'var(--danger)' } as const;

/** Privacidade e backup › Família e aparelhos (desktop). */
export function CardFamilia({ desktop }: { desktop?: boolean }) {
  const btn = desktop ? 'btn--h38' : 'btn--h50';
  const pad = desktop ? '14px 20px' : '14px 16px';
  const store = useStore();
  const s = useInfoSync();
  const [folha, setFolha] = useState<null | 'criar' | 'entrar' | 'convite' | 'sair' | 'renomear' | 'token'>(null);
  const [removendo, setRemovendo] = useState<Aparelho | null>(null);
  const meuId = store.api.aparelhoId();
  const aparelhos = aparelhosDaFamilia(store.state);
  // Este aparelho primeiro; os outros do mais ao menos recente.
  aparelhos.sort((a, b) => Number(b.id === meuId) - Number(a.id === meuId));
  const status = !s.familia ? '' : s.estado === 'sincronizando' ? 'Sincronizando…' : s.estado === 'erro' ? (s.token ? 'Token do GitHub sem acesso ou vencido' : `Não sincronizou: ${s.erro}`) : s.ultima ? `Sincronizado ${quando(s.ultima)} · pelo ${s.via === 'Wi-Fi' ? 'Wi-Fi' : 'GitHub'}` : 'Ainda não sincronizou';
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className={desktop ? 'card-head card-head--20' : 'card-head'}><Label>Família e aparelhos</Label></div>
      {!s.familia ? (
        <div className="stack" style={{ padding: desktop ? '16px 20px' : 16, gap: 12 }}>
          <span style={texto}>Sincronize seus aparelhos e os da família por um repositório privado no GitHub. Tudo vai cifrado: o GitHub só guarda arquivos ilegíveis.</span>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn--ink ${btn}`} style={desktop ? undefined : { flex: 1 }} onClick={() => setFolha('criar')}>Criar família</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha('entrar')}>Entrar com convite</button>
          </div>
        </div>
      ) : s.removido ? (
        <div className="stack" style={{ padding: desktop ? '16px 20px' : 16, gap: 12 }} role="status">
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--danger)' }}>Este aparelho foi removido da família</span>
          <span style={texto}>Outro aparelho trocou a chave da família sem este. Ele não sincroniza mais; os dados que já estão aqui continuam aqui. Para voltar, peça um convite novo.</span>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn--ink ${btn}`} style={desktop ? undefined : { flex: 1 }} onClick={() => setFolha('entrar')}>Entrar com convite</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', ...(desktop ? {} : { flex: 1 }) }} onClick={() => void sincronizar(store, { manual: true })}>Verificar de novo</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha('token')}>Trocar token</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', color: 'var(--danger)', ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha('sair')}>Sair da família</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ padding: pad, flexWrap: 'wrap', gap: 10 }}>
            <span className="stack" style={{ gap: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
              <span>Repositório <span className="mono">{s.familia.repo}</span></span>
              <span style={{ fontSize: 13, color: s.estado === 'erro' ? 'var(--danger)' : 'var(--text-2)' }}>{status}</span>
            </span>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent' }} disabled={s.estado === 'sincronizando'} onClick={() => void sincronizar(store, { manual: true })}>Sincronizar agora</button>
          </div>
          {aparelhos.length === 0 ? (
            <div className="row" style={{ padding: pad }}>
              <span className="muted">Este aparelho</span>
              <span className="mono">{meuId}</span>
            </div>
          ) : aparelhos.map((a) => (
            <div key={a.id} className="row" style={{ padding: pad, flexWrap: 'wrap', gap: 10 }}>
              <span className="stack" style={{ gap: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
                <span>{a.nome}{a.id === meuId && <span className="muted"> · este aparelho</span>}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{a.plataforma === 'cel' ? 'Celular' : 'Computador'} · visto {a.id === meuId ? 'agora' : quando(a.visto)}</span>
              </span>
              {a.id === meuId ? (
                <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', minHeight: 44 }} onClick={() => setFolha('renomear')}>Renomear</button>
              ) : (
                <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', color: 'var(--danger)', minHeight: 44 }} onClick={() => setRemovendo(a)}>Remover</button>
              )}
            </div>
          ))}
          <div className="hstack" style={{ padding: pad, gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn--ink ${btn}`} style={desktop ? undefined : { flex: 1 }} onClick={() => setFolha('convite')}>Convidar aparelho</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha('token')}>Trocar token</button>
            <button type="button" className={`btn btn--outline ${btn}`} style={{ background: 'transparent', color: 'var(--danger)', ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha('sair')}>Sair da família</button>
          </div>
        </>
      )}
      {folha === 'criar' && <CriarFamilia desktop={desktop} onClose={() => setFolha(null)} />}
      {folha === 'entrar' && <EntrarNaFamilia desktop={desktop} onClose={() => setFolha(null)} />}
      {folha === 'convite' && <Convite desktop={desktop} onClose={() => setFolha(null)} />}
      {folha === 'sair' && <SairDaFamilia desktop={desktop} onClose={() => setFolha(null)} />}
      {folha === 'token' && <TrocarToken desktop={desktop} onClose={() => setFolha(null)} />}
      {removendo && <RemoverAparelho desktop={desktop} alvo={removendo} onClose={() => setRemovendo(null)} />}
      {folha === 'renomear' && <RenomearAparelho desktop={desktop} atual={aparelhos.find((a) => a.id === meuId)?.nome ?? ''} onClose={() => setFolha(null)} />}
    </div>
  );
}

function RenomearAparelho({ desktop, atual, onClose }: { desktop?: boolean; atual: string; onClose: () => void }) {
  const { api } = useStore();
  const [nome, setNome] = useState(atual);
  const salvar = () => { api.renomearAparelho(nome); onClose(); };
  return (
    <Folha desktop={desktop} onClose={onClose} titulo="Renomear aparelho">
      <span style={texto}>Esse nome aparece na lista de aparelhos de toda a família.</span>
      <input className={`input${desktop ? ' input--desk' : ''}`} value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nome.trim()) salvar(); }} autoFocus aria-label="Nome do aparelho" />
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!nome.trim()} onClick={salvar}>Salvar</button>
    </Folha>
  );
}

/** "Remover aparelho": troca a chave da família sem ele. Exige o token novo (o removido conhece o antigo e leria a
 *  chave nova no repositório), mostra quem recebe a chave nova e confirma digitando o nome. */
function RemoverAparelho({ desktop, alvo, onClose }: { desktop?: boolean; alvo: Aparelho; onClose: () => void }) {
  const store = useStore();
  const meuId = store.api.aparelhoId();
  const { destinatarios, semChave } = planoRemocao(store.state.aparelhos, meuId, alvo.id);
  const [nome, setNome] = useState('');
  const [token, setToken] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const confere = nome.trim() === alvo.nome.trim();
  const pronto = confere && !!token.trim();
  // Quem recebe a chave nova: este aparelho (o Rust inclui sozinho) e os outros com chave pública.
  const nomes = ['este aparelho', ...destinatarios.map((d) => store.state.aparelhos.find((a) => a.id === d.id)?.nome ?? d.id)];
  const remover = async () => {
    if (!meuId || !pronto) return;
    setOcupado(true); setErro('');
    try {
      const f = await persistencia.familiaRemoverAparelho(meuId, alvo.id, destinatarios, token.trim());
      atualizarFamilia(f);
      store.api.removerAparelho(alvo.id, f.epoca ?? 0);
      for (const a of semChave) store.api.removerAparelho(a.id, f.epoca ?? 0);
      store.api.toast({ texto: `${alvo.nome} saiu da família` });
      onClose();
      void sincronizar(store);
    } catch (e) {
      // Outro aparelho tirou este da família antes: para de sincronizar aqui.
      if (ehRemovido(e)) {
        marcarRemovido();
        store.api.toast({ texto: 'Este aparelho foi removido da família' });
        onClose();
        return;
      }
      setErro(mensagemErro(e).texto);
    } finally { setOcupado(false); }
  };
  return (
    <Folha desktop={desktop} onClose={ocupado ? () => {} : onClose} titulo="Remover aparelho?" alerta>
      <span style={texto}><b>{alvo.nome}</b> deixa de receber as mudanças da família: a família passa a usar uma chave nova, que vai só para os outros aparelhos. O que já está nele continua nele.</span>
      {semChave.length > 0 && (
        <span style={texto}>{semChave.length === 1 ? 'Este aparelho ainda usa uma versão antiga do app e vai sair da família também' : 'Estes aparelhos ainda usam uma versão antiga do app e vão sair da família também'}: <b>{semChave.map((a) => a.nome).join(', ')}</b>. Depois de atualizar o app neles, convide de novo.</span>
      )}
      <span style={texto}>Aparelhos que entraram há pouco e ainda não sincronizaram vão precisar de um convite novo.</span>
      <span style={texto}>O aparelho removido conhece o token do GitHub: com ele, ainda leria a chave nova no repositório. Por isso o token novo é obrigatório. Gere um token novo para o mesmo repositório, com <b>Contents: Read and write</b>, e cole abaixo: ele vai cifrado para os outros aparelhos. Revogue o token antigo no GitHub só depois que todos sincronizarem.</span>
      <input className={`input${desktop ? ' input--desk' : ''} input--mono`} type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} disabled={ocupado} required aria-required="true" aria-label="Novo token do GitHub" />
      <span style={texto}>A chave nova vai para: <b>{nomes.join(', ')}</b></span>
      <span style={texto}>Para confirmar, digite o nome do aparelho: <b>{alvo.nome}</b></span>
      <input className={`input${desktop ? ' input--desk' : ''}`} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pronto && !ocupado) void remover(); }} disabled={ocupado} autoFocus aria-label="Nome do aparelho, para confirmar" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn ${desktop ? 'btn--h40d' : 'btn--h50'}`} style={{ background: 'var(--danger)', color: 'var(--surface)' }} disabled={!pronto || ocupado} onClick={remover}>{ocupado ? 'Trocando a chave da família…' : erro ? 'Tentar de novo' : 'Remover aparelho'}</button>
    </Folha>
  );
}

/** Token novo do GitHub só neste aparelho (o fine-grained vence). A chave da família não muda. */
function TrocarToken({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
  const store = useStore();
  const [token, setToken] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const salvar = async () => {
    setOcupado(true); setErro('');
    try {
      atualizarFamilia(await persistencia.familiaTrocarToken(token));
      store.api.toast({ texto: 'Token trocado' });
      onClose();
      void sincronizar(store, { manual: true });
    } catch (e) { setErro(mensagemErro(e).texto); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop={desktop} onClose={ocupado ? () => {} : onClose} titulo="Trocar token">
      <span style={texto}>Gere um token novo no GitHub para o mesmo repositório, com <b>Contents: Read and write</b>, e cole aqui. Ele vale só para este aparelho e fica cifrado aqui.</span>
      <input className={`input${desktop ? ' input--desk' : ''} input--mono`} type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} disabled={ocupado} autoFocus aria-label="Token novo do GitHub" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!token.trim() || ocupado} onClick={salvar}>{ocupado ? 'Conferindo o token…' : 'Salvar token'}</button>
    </Folha>
  );
}

function CriarFamilia({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
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
    <Folha desktop={desktop} onClose={onClose} titulo="Criar família">
      <span style={texto}>1. No GitHub, crie um repositório <b>privado</b> vazio (ex.: prontuario-sync).<br />2. Em Settings › Developer settings › Fine-grained tokens, gere um token só para esse repositório, com <b>Contents: Read and write</b>.<br />3. Cole os dois aqui. O token fica cifrado neste aparelho.</span>
      <input className={`input${desktop ? ' input--desk' : ''}`} placeholder="dono/nome (ex.: lucas/prontuario-sync)" value={repo} onChange={(e) => setRepo(e.target.value)} autoFocus aria-label="Repositório" />
      <input className={`input${desktop ? ' input--desk' : ''} input--mono`} type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token do GitHub" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!repo.trim() || !token.trim() || ocupado} onClick={criar}>{ocupado ? 'Conferindo o repositório…' : 'Criar família'}</button>
    </Folha>
  );
}

/** Colar o convite ou, no Android, ler o QR. Usado no card e no primeiro uso. */
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
    // Convite de antes de uma troca de chave: pede outro (dá para colar o novo aqui mesmo).
    if (r.conviteAntigo) {
      setEntrou(false);
      setConvite('');
      return setErro('Esse convite é de antes de uma troca de chave da família. Peça um convite novo e cole aqui.');
    }
    setErro(`Entrou na família, mas não foi possível baixar os dados: ${r.erro ?? 'erro desconhecido'}`);
  };
  const entrar = async (texto = convite) => {
    setOcupado(true); setErro('');
    try {
      if (!entrou) {
        definirFamilia(await persistencia.familiaEntrar(texto));
        setEntrou(true);
      }
      await baixar();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  const lerQr = async () => {
    setErro('');
    try {
      const lido = await lerConviteQr();
      if (!lido) return setErro('Esse QR não é um convite da família. Tente de novo ou cole o convite.');
      setConvite(lido);
      await entrar(lido);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Folha desktop={desktop} onClose={entrou ? () => {} : onClose} titulo="Entrar na família">
      <span style={texto}>Em um aparelho que já está na família, abra Privacidade e backup › Convidar aparelho e copie o convite. Cole aqui{leitorQrDisponivel() ? ' ou leia o QR' : ''}.</span>
      {leitorQrDisponivel() && !entrou && (
        <button type="button" className="btn btn--outline btn--h50" style={{ background: 'transparent', minHeight: 44 }} disabled={ocupado} onClick={lerQr}>Ler QR</button>
      )}
      <textarea className={`input${desktop ? ' input--desk' : ''} input--area input--mono`} placeholder="PCASA1:…" value={convite} onChange={(e) => setConvite(e.target.value)} readOnly={entrou} autoFocus aria-label="Convite" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!convite.trim() || ocupado} onClick={() => entrar()}>{ocupado ? 'Baixando os dados da família…' : entrou ? 'Tentar de novo' : 'Entrar'}</button>
    </Folha>
  );
}

function Convite({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
  const { api } = useStore();
  const [convite, setConvite] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const mostrar = async () => {
    setErro('');
    try { setConvite(await persistencia.familiaConvite(api.aparelhoId() ?? '')); } catch (e) {
      if (ehRemovido(e)) marcarRemovido();
      setErro(mensagemErro(e).texto);
    }
  };
  const copiar = async () => {
    if (!convite) return;
    setErro('');
    try {
      await navigator.clipboard.writeText(convite);
      api.toast({ texto: 'Convite copiado' });
    } catch (e) { setErro(`Não foi possível copiar: ${e instanceof Error ? e.message : String(e)}`); }
  };
  return (
    <Folha desktop={desktop} onClose={onClose} titulo="Convidar aparelho" alerta>
      <span style={texto}>O convite dá acesso total à família: não fotografe nem compartilhe. Se ele vazar, use Trocar token.</span>
      {convite ? (
        <>
          <QrConvite texto={convite} />
          <textarea className={`input${desktop ? ' input--desk' : ''} input--area input--mono`} readOnly value={convite} aria-label="Convite" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} onClick={copiar}>Copiar convite</button>
        </>
      ) : (
        <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} onClick={mostrar}>Mostrar convite</button>
      )}
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
    </Folha>
  );
}

function SairDaFamilia({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
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
    <Folha desktop={desktop} onClose={onClose} titulo="Sair da família?" alerta>
      <span style={texto}>Este aparelho para de sincronizar. Os dados que já estão aqui continuam aqui; os outros aparelhos não perdem nada.</span>
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn ${desktop ? 'btn--h40d' : 'btn--h50'}`} style={{ background: 'var(--danger)', color: 'var(--surface)' }} disabled={ocupado} onClick={sair}>Sair da família</button>
    </Folha>
  );
}

/** Depois de entrar na família (ou restaurar dados de outra pessoa): escolher quem usa este aparelho.
 *  Só aparece desbloqueado (App.tsx mostra o bloqueio antes, sem os nomes). */
export function QuemEVoce({ onEscolhido }: { onEscolhido?: () => void }) {
  const { state, api } = useStore();
  const pessoas = state.pessoas.filter((p) => !ehPet(p));
  return (
    <div style={telaCheia}>
      <div className="stack" style={{ gap: 18, width: 'min(420px, 100% - 32px)' }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="pu__rotulo">FAMÍLIA</span>
          <h2 className="pu__titulo" style={{ margin: 0 }}>Quem é você?</h2>
          <span style={texto}>Escolha o seu perfil. Ele passa a ser o "você" deste aparelho.</span>
        </div>
        <div className="card">
          {pessoas.map((p) => (
            <button key={p.id} type="button" className="row" style={{ padding: '14px 16px', fontSize: 15, minHeight: 48 }} onClick={() => { api.definirEu(p.id); onEscolhido?.(); }}>
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
    <div style={telaCheia}>
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
          <button type="button" className={`btn btn--outline ${desktop ? 'btn--h40d' : 'btn--h50'}`} style={{ minHeight: 44, ...(desktop ? {} : { flex: 1 }) }} onClick={onFim}>Agora não</button>
          <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} style={{ minHeight: 44, ...(desktop ? {} : { flex: 1 }) }} onClick={() => setFolha(true)} autoFocus>{desktop ? 'Criar senha' : 'Criar PIN'}</button>
        </div>
      </div>
      {folha && <SenhaApp desktop={desktop} onClose={() => setFolha(false)} onPronto={onFim} />}
    </div>
  );
}
