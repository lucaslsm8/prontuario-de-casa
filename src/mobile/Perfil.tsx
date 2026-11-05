// Celular: o app funciona no perfil de uma pessoa (ou pet) da família, ou em "Família toda". Sempre abre
// no de quem usa o aparelho; trocar vale até fechar o app. A foto do perfil aberto é a última aba (TabBar):
// um toque abre o seletor, segurar abre a página da pessoa. Início, Agenda, Remédios e Exames mostram só o perfil.
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dosesHoje, EscopoPerfil, pessoa, podeVer, temEu, useStore, type State } from '../data/store';
import { ehPet, familia, pets } from '../data/pets';
import { quem } from '../data/format';
import { HOJE } from '../data/tempo';
import { useAgora } from '../data/useAgora';
import { pendenciaDoPerfil } from '../data/seletorPerfil';
import type { Pessoa } from '../data/types';
import { Avatar, Label, cx } from '../ui';
import { Folha } from '../ui/Backup';
import { IcConfig } from '../ui/Icones';

/** `id` é o perfil aberto; em "Família toda" fica vazio e `todos` é verdadeiro. */
interface ValorPerfil { id?: string; todos: boolean; trocar: (id: string) => void; abrirSeletor: () => void }
const PerfilCtx = createContext<ValorPerfil>({ todos: false, trocar: () => undefined, abrirSeletor: () => undefined });
export const usePerfil = () => useContext(PerfilCtx);

const TODOS = '*';

/**
 * Telas da família inteira (perfil de cada um, configurações, busca) e o detalhe de um registro pelo id
 * (remédio, exame, consulta de qualquer um, aberto do perfil dele ou da busca): sem recorte.
 */
const SEM_RECORTE = /^\/(pessoa|pet|familia|configuracoes|compartilhar|privacidade|atualizacoes|busca|emergencia|boas-vindas|cadastro|desbloqueio)(\/|$)|^\/(remedios|exames)\/(?!novo(\/|$))[^/]|^\/consulta\//;

/** Abre uma aba (Agenda, Remédios, Exames) já no perfil de `id`: do perfil de alguém, a aba mostra o que é dele. */
export function useAbrirNoPerfil() {
  const { trocar } = usePerfil();
  const nav = useNavigate();
  return (id: string, aba: string) => { trocar(id); nav(aba); };
}

export function PerfilProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const loc = useLocation();
  const [escolhido, setEscolhido] = useState<string>();
  const [seletor, setSeletor] = useState(false);
  const meu = state.pessoas.find((p) => p.souEu)?.id;
  const todos = escolhido === TODOS;
  // Perfil escolhido que saiu da família (removido): volta para o seu.
  const id = todos ? undefined : escolhido && pessoa(state, escolhido) ? escolhido : meu;
  const valor = useMemo<ValorPerfil>(() => ({
    id, todos, trocar: setEscolhido, abrirSeletor: () => setSeletor(true),
  }), [id, todos]);
  const recorte = temEu(state) && !SEM_RECORTE.test(loc.pathname) ? id : undefined;
  return (
    <PerfilCtx.Provider value={valor}>
      <EscopoPerfil pessoaId={recorte}>{children}</EscopoPerfil>
      {seletor && <SeletorPerfil atual={id} todos={todos} onEscolher={(p) => { setEscolhido(p); setSeletor(false); }} onClose={() => setSeletor(false)} />}
    </PerfilCtx.Provider>
  );
}

/** O que a pessoa tem pendente agora, só com o que ela compartilha com você. */
function pendencia(state: State, p: Pessoa, agora: number) {
  const ver = (c: 'remedios' | 'consultas') => p.souEu || ehPet(p) || podeVer(state, p.id, c);
  const doses = ver('remedios') ? dosesHoje(state).filter((d) => d.pessoa.id === p.id) : [];
  const remedios = ver('remedios') ? state.remedios.filter((r) => r.pessoaId === p.id) : [];
  const consultas = ver('consultas') ? state.consultas.filter((c) => c.pessoaId === p.id) : [];
  return pendenciaDoPerfil(doses, remedios, consultas, agora, HOJE);
}

function SeletorPerfil({ atual, todos, onEscolher, onClose }: { atual?: string; todos: boolean; onEscolher: (id: string) => void; onClose: () => void }) {
  const { state } = useStore();
  const nav = useNavigate();
  const agora = useAgora();
  const ir = (to: string) => { onClose(); nav(to); };
  const vendo = <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Vendo</span>;
  const linha = (p: Pessoa) => {
    const pend = pendencia(state, p, agora);
    const este = !todos && p.id === atual;
    return (
      <button type="button" key={p.id} className={cx('seletor__linha', este && 'is-vendo')} onClick={() => onEscolher(p.id)} aria-pressed={este}>
        <Avatar pessoa={p} size={40} font={15} />
        <span className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{p.souEu ? `${p.curto} (você)` : p.curto}</span>
          <span className={cx('seletor__pend', pend.alerta && 'is-alerta')}>{pend.texto}</span>
        </span>
        {este && vendo}
      </button>
    );
  };
  const pessoas = familia(state).sort((a, b) => Number(!!b.souEu) - Number(!!a.souEu));
  const aberto = !todos && atual ? pessoa(state, atual) : undefined;
  return (
    <Folha titulo="Ver o perfil de" onClose={onClose}>
      <div className="stack" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {pessoas.map(linha)}
        {pets(state).length > 0 && <Label>Pets</Label>}
        {pets(state).map(linha)}
        <button type="button" className={cx('seletor__linha', todos && 'is-vendo')} onClick={() => onEscolher(TODOS)} aria-pressed={todos}>
          <AvatarTodos pessoas={[...pessoas, ...pets(state)]} size={40} />
          <span className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Família toda</span>
            <span className="seletor__pend">Todos juntos, como no computador</span>
          </span>
          {todos && vendo}
        </button>
      </div>
      {aberto && (
        <button type="button" className="btn btn--ink btn--h50" onClick={() => ir(`/pessoa/${aberto.id}`)}>
          {aberto.souEu ? 'Abrir o seu perfil' : `Abrir o perfil de ${aberto.curto}`}
        </button>
      )}
      <div className="hstack" style={{ gap: 8 }}>
        {aberto && !ehPet(aberto) && (aberto.souEu || podeVer(state, aberto.id, 'perfil')) && (
          <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={() => ir(`/pessoa/${aberto.id}/emergencia`)}>Emergência</button>
        )}
        <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={() => ir('/familia')}>Família</button>
        <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={() => ir('/planos')}>Carteirinhas</button>
      </div>
    </Folha>
  );
}

/** Duas fotos sobrepostas: "Família toda". */
export function AvatarTodos({ pessoas, size }: { pessoas: Pessoa[]; size: number }) {
  const [a, b] = pessoas;
  const menor = Math.round(size * 0.72);
  return (
    <span className="avatar-todos" style={{ width: size, height: size }} aria-hidden>
      {a && <span style={{ position: 'absolute', left: 0, top: 0 }}><Avatar pessoa={a} size={menor} /></span>}
      {b && <span style={{ position: 'absolute', right: 0, bottom: 0 }}><Avatar pessoa={b} size={menor} /></span>}
    </span>
  );
}

/**
 * Última aba: a foto do perfil aberto (o nome fica no seletor e no `title`; na barra não cabe).
 * Toque abre o seletor; segurar abre a página da pessoa.
 */
export function AbaPerfil() {
  const { state } = useStore();
  const { id, todos, abrirSeletor } = usePerfil();
  const nav = useNavigate();
  const loc = useLocation();
  const timer = useRef<number>();
  const segurou = useRef(false);
  const p = id ? pessoa(state, id) : undefined;
  if (!p && !todos) return null;
  const nome = todos ? 'Todos' : p!.souEu ? 'Você' : p!.curto;
  const soltar = () => window.clearTimeout(timer.current);
  return (
    <button
      type="button"
      className={cx('tabbar__perfil', !!id && loc.pathname === `/pessoa/${id}` && 'active')}
      aria-label={`Perfil: ${todos ? 'Família toda' : quem(p)}. Toque para trocar, segure para abrir`}
      title={nome}
      onPointerDown={() => {
        segurou.current = false;
        if (!p) return;
        timer.current = window.setTimeout(() => { segurou.current = true; nav(`/pessoa/${p.id}`); }, 500);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (!segurou.current) abrirSeletor(); }}
    >
      {todos ? <AvatarTodos pessoas={familia(state)} size={30} /> : <Avatar pessoa={p!} size={30} font={12} />}
    </button>
  );
}

/** "Salvar remédio" → "Salvar remédio para Roberto" quando é de outra pessoa. */
export function textoSalvar(state: State, pessoaId: string | undefined, base: string) {
  const p = pessoaId ? pessoa(state, pessoaId) : undefined;
  return p && !p.souEu ? `${base} para ${p.curto}` : base;
}

/** Engrenagem das configurações, no topo do Início. */
export function BotaoConfig() {
  const nav = useNavigate();
  return (
    <button type="button" className="btn btn--outline btn--h40" style={{ width: 44, minWidth: 44, padding: 0, flexShrink: 0 }} onClick={() => nav('/configuracoes')} aria-label="Configurações" title="Configurações">
      <IcConfig size={20} />
    </button>
  );
}
