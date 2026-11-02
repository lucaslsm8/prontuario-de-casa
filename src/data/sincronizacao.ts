// Sincronização da família pelo GitHub (pacotes cifrados; a rede e a chave ficam no Rust).
// Sincroniza ao abrir, a cada 5 min com o app aberto, 5 s depois de uma mudança e no botão "Sincronizar agora".

import { useEffect, useSyncExternalStore } from 'react';
import { MODO_REAL } from './tempo';
import { persistencia, type InfoFamilia } from './persistencia';
import { useStore } from './store';

export interface InfoSync {
  familia: InfoFamilia | null;
  estado: 'parado' | 'sincronizando' | 'ok' | 'erro';
  /** ISO da última sincronização completa. */
  ultima?: string;
  via?: 'GitHub';
  erro?: string;
  /** O erro é de token (sem acesso ou vencido). */
  token?: boolean;
  /** Este aparelho foi removido da família: não sincroniza mais (os dados daqui ficam). */
  removido?: boolean;
}

let info: InfoSync = { familia: null, estado: 'parado' };
const ouvintes = new Set<() => void>();
const mudar = (i: Partial<InfoSync>) => { info = { ...info, ...i }; ouvintes.forEach((f) => f()); };
export const useInfoSync = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => info);

/** Erro do Rust quando a família trocou a chave sem este aparelho. */
export const ehRemovido = (e: unknown) => (e instanceof Error ? e.message : String(e)).startsWith('REMOVIDO:');

/** Erro do Rust de quem entrou com um convite de antes de uma troca de chave: pedir outro convite. */
export const ehConviteAntigo = (e: unknown) => (e instanceof Error ? e.message : String(e)).startsWith('CONVITE:');

export function mensagemErro(e: unknown): { texto: string; token: boolean } {
  const t = e instanceof Error ? e.message : String(e);
  if (t.startsWith('CONVITE:') || t.startsWith('REMOVIDO:')) return { texto: t.slice(t.indexOf(':') + 1).trim(), token: false };
  return t.startsWith('TOKEN:') ? { texto: t.slice(6).trim(), token: true } : { texto: t, token: false };
}

export async function carregarFamilia() {
  if (!MODO_REAL) return;
  try {
    const familia = await persistencia.familiaInfo();
    mudar({ familia, removido: !!familia?.removido });
  } catch (e) {
    // Erro ao ler não é "sem família": mantém a que estava e mostra o erro.
    const { texto, token } = mensagemErro(e);
    mudar({ estado: 'erro', erro: texto, token });
  }
}
export const definirFamilia = (familia: InfoFamilia | null) => mudar({ familia, estado: 'parado', erro: undefined, token: undefined, ultima: undefined, removido: !!familia?.removido });
/** O Rust disse que este aparelho foi removido: para de sincronizar (os dados daqui ficam). */
export const marcarRemovido = () => mudar({ estado: 'parado', removido: true, erro: undefined, token: undefined, ...(info.familia ? { familia: { ...info.familia, removido: true } } : {}) });
/** A família mudou de época (aparelho removido, chave nova): atualiza sem mexer no resto. */
export const atualizarFamilia = (familia: InfoFamilia) => mudar({ familia, removido: !!familia.removido });
/** O estado atual, fora do React (testes). */
export const infoSync = () => info;

type Store = ReturnType<typeof useStore>;
/** `conviteAntigo`: entrou com um convite de antes de uma troca de chave (peça outro). */
export interface ResultadoSync { ok: boolean; erro?: string; conviteAntigo?: boolean }

let emAndamento = false;
/** Pedidos que chegaram durante uma rodada: rodam juntos numa rodada a mais e recebem o resultado dela. */
let pendente: { manual: boolean; avisar: ((r: ResultadoSync) => void)[] } | null = null;
let reprojetarPendente = false;

/** Sobe o que ainda não subiu, baixa o que os outros criaram e, se chegou algo, reprojeta o estado. */
export async function sincronizar(store: { api: Pick<Store['api'], 'aparelhoId' | 'eventosParaEnviar' | 'recarregar' | 'toast'> }, { manual = false } = {}): Promise<ResultadoSync> {
  const { api } = store;
  const aparelho = api.aparelhoId();
  if (!info.familia || !aparelho) return { ok: false, erro: 'Este aparelho não está numa família.' };
  if (info.removido) {
    // Automático: não tenta. Manual ("Verificar de novo", "Sincronizar agora"): confere no remoto de novo.
    if (!manual) return { ok: false, erro: 'Este aparelho foi removido da família.' };
    try {
      atualizarFamilia(await persistencia.familiaVerificar(aparelho));
    } catch (e) {
      if (ehRemovido(e)) {
        marcarRemovido();
        api.toast({ texto: 'Este aparelho continua fora da família' });
        return { ok: false, erro: 'Este aparelho foi removido da família.' };
      }
      const { texto, token } = mensagemErro(e);
      mudar({ estado: 'erro', erro: texto, token });
      api.toast({ texto: `Não foi possível verificar: ${texto}` });
      return { ok: false, erro: texto };
    }
  }
  if (emAndamento) {
    pendente ??= { manual: false, avisar: [] };
    pendente.manual ||= manual;
    const p = pendente;
    return new Promise((r) => p.avisar.push(r));
  }
  emAndamento = true;
  mudar({ estado: 'sincronizando', erro: undefined, token: undefined });
  let r: ResultadoSync;
  try {
    // Erro no envio não impede o recebimento; a rodada termina mostrando o erro do envio.
    let erroEnvio: unknown = null;
    try {
      await persistencia.syncEnviar(aparelho, await api.eventosParaEnviar());
    } catch (e) { erroEnvio = e; }
    let chegaram: number;
    try {
      chegaram = await persistencia.syncReceber(aparelho);
    } catch (e) {
      // Pode ter gravado parte dos pacotes antes de falhar: a próxima rodada boa reprojeta mesmo sem nada novo.
      reprojetarPendente = true;
      throw e;
    }
    if (chegaram > 0) reprojetarPendente = true;
    // Se o recarregamento falhar, a próxima rodada tenta de novo mesmo sem eventos novos.
    if (reprojetarPendente) { await api.recarregar(); reprojetarPendente = false; }
    if (erroEnvio !== null) throw erroEnvio;
    // A rodada pode ter adotado uma chave nova da família (outro aparelho foi removido): a época vale para os eventos daqui.
    let f: InfoFamilia | null = null;
    try { f = await persistencia.familiaInfo(); } catch { /* fica a época de antes */ }
    if (f && info.familia && f.familiaId === info.familia.familiaId && f.epoca !== info.familia.epoca) mudar({ familia: f });
    mudar({ estado: 'ok', ultima: new Date().toISOString(), via: 'GitHub' });
    if (manual) api.toast({ texto: chegaram ? `${chegaram === 1 ? '1 mudança chegou' : `${chegaram} mudanças chegaram`} da família` : 'Tudo sincronizado' });
    r = { ok: true };
  } catch (e) {
    if (ehRemovido(e)) {
      // Para de sincronizar; nada daqui é apagado.
      marcarRemovido();
      if (manual) api.toast({ texto: 'Este aparelho foi removido da família' });
      r = { ok: false, erro: 'Este aparelho foi removido da família.' };
    } else {
      const { texto, token } = mensagemErro(e);
      mudar({ estado: 'erro', erro: texto, token });
      if (manual) api.toast({ texto: `Não foi possível sincronizar: ${texto}` });
      r = { ok: false, erro: texto, ...(ehConviteAntigo(e) ? { conviteAntigo: true } : {}) };
    }
  }
  emAndamento = false;
  const p = pendente;
  pendente = null;
  if (p) {
    const r2 = await sincronizar(store, { manual: p.manual });
    p.avisar.forEach((f) => f(r2));
  }
  return r;
}

let aposMudanca: (() => void) | null = null;
let espera: ReturnType<typeof setTimeout> | undefined;
/** Chamado a cada evento gravado: sincroniza 5 s depois da última mudança. */
export function avisarMudanca() {
  if (!aposMudanca) return;
  clearTimeout(espera);
  espera = setTimeout(() => aposMudanca?.(), 5000);
}

/** Montado uma vez no app: carrega a família e sincroniza ao abrir, a cada 5 min e depois de mudanças. */
export function useSincronizacao() {
  const store = useStore();
  const { familia, removido } = useInfoSync();
  const pronto = store.status === 'pronto' && !store.state.bloqueado;
  // Os efeitos dependem da família (id), não do objeto: a época nova não reinicia o ciclo.
  const familiaId = familia?.familiaId;
  useEffect(() => { void carregarFamilia(); }, []);
  // Único ponto que registra este aparelho (evento `aparelho`): com família, log carregado e o "eu" conhecido. Não repete: sai se o log já tem o aparelho.
  // Também quando o log diz que este aparelho foi removido mas ele voltou com um convite novo: registra de novo.
  const euId = store.state.pessoas.find((p) => p.souEu)?.id;
  const meuId = store.api.aparelhoId();
  const listadoComoRemovido = store.state.aparelhos.some((a) => a.id === meuId && a.removido);
  useEffect(() => {
    if (pronto && familiaId && !removido && euId) void store.api.registrarAparelho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, familiaId, removido, euId, listadoComoRemovido]);
  useEffect(() => {
    if (!pronto || !familiaId || removido) return;
    const rodar = () => void sincronizar(store);
    aposMudanca = rodar;
    rodar();
    const t = setInterval(rodar, 5 * 60 * 1000);
    return () => { clearInterval(t); aposMudanca = null; clearTimeout(espera); };
    // `store` muda a cada render; o efeito depende só de abrir/fechar e da família.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, familiaId, removido]);
}
