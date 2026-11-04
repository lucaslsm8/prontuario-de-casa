// Celular: o app funciona no perfil de uma pessoa (ou pet) da família. Sempre abre no de quem usa o
// aparelho; trocar vale até fechar o app. Início, Agenda, Remédios, Exames e Plano mostram só o perfil.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EscopoPerfil, pessoa, temEu, useStore } from '../data/store';
import { ehPet, familia, pets } from '../data/pets';
import { quem } from '../data/format';
import { Avatar, Label } from '../ui';
import { Folha } from '../ui/Backup';
import { IcConfig } from '../ui/Icones';

interface ValorPerfil { id?: string; trocar: (id: string) => void; abrirSeletor: () => void }
const PerfilCtx = createContext<ValorPerfil>({ trocar: () => undefined, abrirSeletor: () => undefined });
export const usePerfil = () => useContext(PerfilCtx);

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
  // Perfil escolhido que saiu da família (removido): volta para o seu.
  const id = escolhido && pessoa(state, escolhido) ? escolhido : meu;
  const valor = useMemo<ValorPerfil>(() => ({ id, trocar: setEscolhido, abrirSeletor: () => setSeletor(true) }), [id]);
  const recorte = temEu(state) && !SEM_RECORTE.test(loc.pathname) ? id : undefined;
  return (
    <PerfilCtx.Provider value={valor}>
      <EscopoPerfil pessoaId={recorte}>{children}</EscopoPerfil>
      {seletor && <SeletorPerfil atual={id} onEscolher={(p) => { setEscolhido(p); setSeletor(false); }} onClose={() => setSeletor(false)} />}
    </PerfilCtx.Provider>
  );
}

function SeletorPerfil({ atual, onEscolher, onClose }: { atual?: string; onEscolher: (id: string) => void; onClose: () => void }) {
  const { state } = useStore();
  const nav = useNavigate();
  const linha = (p: (typeof state.pessoas)[number]) => (
    <button
      type="button"
      key={p.id}
      className="row"
      style={{ gap: 12, padding: '10px 4px', justifyContent: 'flex-start', minHeight: 56, textAlign: 'left' }}
      onClick={() => onEscolher(p.id)}
      aria-pressed={p.id === atual}
    >
      <Avatar pessoa={p} size={40} font={15} />
      <span className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{p.souEu ? `${p.curto} (você)` : p.curto}</span>
        {!p.souEu && (p.parentesco || ehPet(p)) && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{ehPet(p) ? p.pet?.raca ?? 'Pet' : p.parentesco}</span>}
      </span>
      {p.id === atual && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Vendo</span>}
    </button>
  );
  const pessoas = familia(state).sort((a, b) => Number(!!b.souEu) - Number(!!a.souEu));
  return (
    <Folha titulo="Ver o perfil de" onClose={onClose}>
      <div className="stack" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {pessoas.map(linha)}
        {pets(state).length > 0 && <Label>Pets</Label>}
        {pets(state).map(linha)}
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={() => { onClose(); nav('/familia'); }}>Família</button>
        <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={() => { onClose(); nav('/configuracoes'); }}>Configurações</button>
      </div>
    </Folha>
  );
}

/** Engrenagem das configurações, ao lado do perfil no topo do Início. */
export function BotaoConfig() {
  const nav = useNavigate();
  return (
    <button type="button" className="btn btn--outline btn--h40" style={{ width: 44, minWidth: 44, padding: 0, marginRight: 8, flexShrink: 0 }} onClick={() => nav('/configuracoes')} aria-label="Configurações" title="Configurações">
      <IcConfig size={20} />
    </button>
  );
}

/** Botão do perfil (foto + nome) que abre o seletor. */
export function BotaoPerfil({ compacto }: { compacto?: boolean }) {
  const { state } = useStore();
  const { id, abrirSeletor } = usePerfil();
  const p = id ? pessoa(state, id) : undefined;
  if (!p) return null;
  return (
    <button type="button" className="perfil-botao" onClick={abrirSeletor} aria-label={`Perfil: ${quem(p)}. Trocar de perfil`}>
      <Avatar pessoa={p} size={compacto ? 28 : 36} font={compacto ? 11 : 13} />
      {!compacto && <span className="perfil-botao__nome">{p.souEu ? 'Você' : p.curto}</span>}
      <span aria-hidden className="perfil-botao__seta">▾</span>
    </button>
  );
}

/** Faixa no topo das abas quando o perfil não é o seu: de quem é o que está na tela e o botão de trocar. */
export function FaixaPerfil() {
  const { state } = useStore();
  const { id, abrirSeletor } = usePerfil();
  const p = id ? pessoa(state, id) : undefined;
  const meu = state.pessoas.find((x) => x.souEu);
  if (!p || !meu || p.id === meu.id) return null;
  return (
    <div className="faixa-perfil">
      <button type="button" className="faixa-perfil__quem" onClick={abrirSeletor}>
        <Avatar pessoa={p} size={28} font={11} />
        <span>Perfil de <b>{p.curto}</b></span>
      </button>
      <button type="button" className="faixa-perfil__voltar" onClick={abrirSeletor}>Trocar perfil</button>
    </div>
  );
}
