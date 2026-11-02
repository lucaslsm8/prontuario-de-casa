// Sincronização da família pelo GitHub (pacotes cifrados; a rede e a chave ficam no Rust) e direto pelo Wi-Fi (lan.rs).
// Sincroniza ao abrir, a cada 5 min com o app aberto, 5 s depois de uma mudança e no botão "Sincronizar agora".
// O Wi-Fi vai junto em cada rodada e, sozinho, a cada 2 min; o que chega por lá reprojeta pelo mesmo caminho.

import { useEffect, useSyncExternalStore } from 'react';
import { MODO_REAL } from './tempo';
import { persistencia, type InfoFamilia, type ResumoLan } from './persistencia';
import { useStore } from './store';

export interface InfoSync {
  familia: InfoFamilia | null;
  estado: 'parado' | 'sincronizando' | 'ok' | 'erro';
  /** ISO da última sincronização completa. */
  ultima?: string;
  /** Por onde foi a última troca que deu certo. */
  via?: 'GitHub' | 'Wi-Fi';
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

/** Troca pelo Wi-Fi; nunca falha (sem par na rede, ou fora do app instalado, é zero). */
async function trocarPelaLan(): Promise<ResumoLan> {
  try {
    const r = await persistencia.lanSincronizarAgora();
    return { pares: r?.pares ?? 0, chegaram: r?.chegaram ?? 0 };
  } catch {
    return { pares: 0, chegaram: 0 };
  }
}

/** Erro do GitHub que o Wi-Fi supre (sem internet, GitHub fora). Token, convite antigo e removido não. */
const contornavel = (e: unknown) => !mensagemErro(e).token && !ehConviteAntigo(e) && !ehRemovido(e);

/** Trocou com alguém pelo Wi-Fi: "Sincronizado há … · pelo Wi-Fi". Um aviso de token continua na tela. */
function marcarWifi() {
  if (info.estado === 'erro' && info.token) return;
  mudar({ estado: 'ok', ultima: new Date().toISOString(), via: 'Wi-Fi', erro: undefined, token: undefined });
}

type StoreSync = Parameters<typeof sincronizar>[0];

/** Pedidos que chegaram durante a rodada que terminou: rodam juntos numa rodada a mais. */
async function rodarPendente(store: StoreSync) {
  const p = pendente;
  pendente = null;
  if (p) {
    const r2 = await sincronizar(store, { manual: p.manual });
    p.avisar.forEach((f) => f(r2));
  }
}

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
    let chegaram = 0;
    let erroReceber: unknown = null;
    try {
      chegaram = await persistencia.syncReceber(aparelho);
    } catch (e) {
      // Pode ter gravado parte dos pacotes antes de falhar: a próxima rodada boa reprojeta mesmo sem nada novo.
      reprojetarPendente = true;
      erroReceber = e;
    }
    const erros = [erroReceber, erroEnvio].filter((e) => e !== null);
    const removido = erros.find(ehRemovido);
    if (removido !== undefined) throw removido;
    // Pelo Wi-Fi, na mesma rodada (o Rust também barra quem foi removido).
    const lan = await trocarPelaLan();
    if (chegaram > 0 || lan.chegaram > 0) reprojetarPendente = true;
    // Sem GitHub (sem internet, GitHub fora), mas com um aparelho da família no Wi-Fi: a rodada vale pelo Wi-Fi.
    const peloWifi = erros.length > 0 && lan.pares > 0 && erros.every(contornavel);
    if (erroReceber !== null && !peloWifi) throw erroReceber;
    // Se o recarregamento falhar, a próxima rodada tenta de novo mesmo sem eventos novos.
    if (reprojetarPendente) { await api.recarregar(); reprojetarPendente = false; }
    if (erroEnvio !== null && !peloWifi) throw erroEnvio;
    if (erros.length === 0) {
      // A rodada pode ter adotado uma chave nova da família (outro aparelho foi removido): a época vale para os eventos daqui.
      let f: InfoFamilia | null = null;
      try { f = await persistencia.familiaInfo(); } catch { /* fica a época de antes */ }
      if (f && info.familia && f.familiaId === info.familia.familiaId && f.epoca !== info.familia.epoca) mudar({ familia: f });
    }
    mudar({ estado: 'ok', ultima: new Date().toISOString(), via: peloWifi || (lan.chegaram > 0 && chegaram === 0) ? 'Wi-Fi' : 'GitHub' });
    const total = chegaram + lan.chegaram;
    if (manual) api.toast({ texto: total ? `${total === 1 ? '1 mudança chegou' : `${total} mudanças chegaram`} da família` : 'Tudo sincronizado' });
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
  await rodarPendente(store);
  return r;
}

/** Só o Wi-Fi (a cada 2 min): troca com quem está na rede e reprojeta se chegou algo. Com outra rodada em andamento, pula. */
export async function sincronizarPeloWifi(store: StoreSync) {
  if (!info.familia || info.removido || emAndamento) return;
  emAndamento = true;
  try {
    const lan = await trocarPelaLan();
    if (lan.chegaram > 0) reprojetarPendente = true;
    if (lan.pares > 0) {
      if (reprojetarPendente) { await store.api.recarregar(); reprojetarPendente = false; }
      marcarWifi();
    }
  } catch { /* o recarregamento falhou: a próxima rodada reprojeta */ }
  emAndamento = false;
  await rodarPendente(store);
}

/** Outro aparelho trocou com este pelo Wi-Fi (evento `sync-lan-chegou`): reprojeta como no GitHub. */
export async function aoChegarPeloWifi(store: StoreSync, chegaram: number) {
  if (!info.familia || info.removido) return;
  if (chegaram > 0) reprojetarPendente = true;
  if (emAndamento) {
    // A rodada em andamento pode já ter reprojetado: uma rodada a mais reprojeta o que chegou agora.
    if (chegaram > 0) pendente ??= { manual: false, avisar: [] };
    return;
  }
  emAndamento = true;
  try {
    if (reprojetarPendente) { await store.api.recarregar(); reprojetarPendente = false; }
    marcarWifi();
  } catch { /* a próxima rodada reprojeta */ }
  emAndamento = false;
  await rodarPendente(store);
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
    // Wi-Fi: o serviço (anúncio mDNS + servidor) só fica ligado com o app aberto, desbloqueado e na frente.
    const ligar = () => void persistencia.lanIniciar().catch(() => {});
    const parar = () => void persistencia.lanParar().catch(() => {});
    const visivel = () => (document.hidden ? parar() : ligar());
    ligar();
    document.addEventListener('visibilitychange', visivel);
    const wifi = () => { if (!document.hidden) void sincronizarPeloWifi(store); };
    // A descoberta leva alguns segundos: a primeira troca só pelo Wi-Fi vem logo depois de ligar.
    const primeira = setTimeout(wifi, 8000);
    const tWifi = setInterval(wifi, 2 * 60 * 1000);
    let soltar: (() => void) | undefined;
    let saiu = false;
    void persistencia.lanOuvir((n) => void aoChegarPeloWifi(store, n)).then((f) => { if (saiu) f(); else soltar = f; }).catch(() => {});
    return () => {
      clearInterval(t); aposMudanca = null; clearTimeout(espera);
      clearTimeout(primeira); clearInterval(tWifi);
      document.removeEventListener('visibilitychange', visivel);
      saiu = true; soltar?.();
      parar();
    };
    // `store` muda a cada render; o efeito depende só de abrir/fechar e da família.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, familiaId, removido]);
}
