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
}

let info: InfoSync = { familia: null, estado: 'parado' };
const ouvintes = new Set<() => void>();
const mudar = (i: Partial<InfoSync>) => { info = { ...info, ...i }; ouvintes.forEach((f) => f()); };
export const useInfoSync = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => info);

export function mensagemErro(e: unknown): { texto: string; token: boolean } {
  const t = e instanceof Error ? e.message : String(e);
  return t.startsWith('TOKEN:') ? { texto: t.slice(6).trim(), token: true } : { texto: t, token: false };
}

export async function carregarFamilia() {
  if (!MODO_REAL) return;
  mudar({ familia: await persistencia.familiaInfo().catch(() => null) });
}
export const definirFamilia = (familia: InfoFamilia | null) => mudar({ familia, estado: 'parado', erro: undefined, token: undefined, ultima: undefined });

type Store = ReturnType<typeof useStore>;

/** Sobe o que este aparelho criou, baixa o que os outros criaram e, se chegou algo, reprojeta o estado. */
export async function sincronizar(store: Pick<Store, 'api'>, { manual = false } = {}) {
  const { api } = store;
  const aparelho = api.aparelhoId();
  if (!info.familia || !aparelho) return;
  if (info.estado === 'sincronizando') {
    // Pedido durante outra rodada: roda mais uma quando esta terminar.
    novaRodada = true;
    if (manual) novaRodadaManual = true;
    return;
  }
  mudar({ estado: 'sincronizando', erro: undefined, token: undefined });
  try {
    await persistencia.syncEnviar(aparelho, await api.meusEventos());
    const chegaram = await persistencia.syncReceber(aparelho);
    if (chegaram > 0) reprojetarPendente = true;
    // Se o recarregamento falhar, a próxima rodada tenta de novo mesmo sem eventos novos.
    if (reprojetarPendente) { await api.recarregar(); reprojetarPendente = false; }
    mudar({ estado: 'ok', ultima: new Date().toISOString(), via: 'GitHub' });
    if (manual) api.toast({ texto: chegaram ? `${chegaram === 1 ? '1 mudança chegou' : `${chegaram} mudanças chegaram`} da família` : 'Tudo sincronizado' });
  } catch (e) {
    const { texto, token } = mensagemErro(e);
    mudar({ estado: 'erro', erro: texto, token });
    if (manual) api.toast({ texto: `Não foi possível sincronizar: ${texto}` });
  }
  if (novaRodada) {
    const m = novaRodadaManual;
    novaRodada = false; novaRodadaManual = false;
    await sincronizar(store, { manual: m });
  }
}
let novaRodada = false;
let novaRodadaManual = false;
let reprojetarPendente = false;

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
  const { familia } = useInfoSync();
  const pronto = store.status === 'pronto' && !store.state.bloqueado;
  useEffect(() => { void carregarFamilia(); }, []);
  useEffect(() => {
    if (!pronto || !familia) return;
    const rodar = () => void sincronizar(store);
    aposMudanca = rodar;
    rodar();
    const t = setInterval(rodar, 5 * 60 * 1000);
    return () => { clearInterval(t); aposMudanca = null; clearTimeout(espera); };
    // `store` muda a cada render; o efeito depende só de abrir/fechar e da família.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, familia]);
}
