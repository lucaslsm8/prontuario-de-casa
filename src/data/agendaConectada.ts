// Agenda conectada (Google Agenda pelo "endereço secreto no formato iCal").
// Atualiza ao abrir o app e pelo botão "Atualizar". Chamada de rede pedida pela pessoa,
// feita pelo Rust (comando baixar_agenda) e só se a pessoa colou o endereço.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { EM_TAURI, HOJE, horaAgora } from './tempo';
import { compararAgenda, lerIcs } from './ics';
import { useStore } from './store';

interface Info { atualizando: boolean; ultima?: string; erro?: string }
let info: Info = { atualizando: false };
const ouvintes = new Set<() => void>();
const mudar = (i: Partial<Info>) => { info = { ...info, ...i }; ouvintes.forEach((f) => f()); };
export const useInfoAgenda = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => info);

async function baixar(url: string): Promise<string> {
  if (EM_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('baixar_agenda', { url });
  }
  // No navegador o Google costuma bloquear (CORS): o app instalado baixa pelo Rust.
  const r = await fetch(url).catch(() => { throw new Error('no navegador o Google bloqueia; use o app instalado'); });
  if (!r.ok) throw new Error(`a agenda respondeu ${r.status}`);
  return r.text();
}

type Store = ReturnType<typeof useStore>;

/** Baixa, compara e aplica: novas consultas, alterações e cancelamentos (só de hoje em diante). */
export async function atualizarAgenda({ state, api }: Pick<Store, 'state' | 'api'>, { aviso = true } = {}) {
  const ag = state.config.agenda;
  if (!ag?.url || info.atualizando) return;
  mudar({ atualizando: true, erro: undefined });
  try {
    const d = compararAgenda(lerIcs(await baixar(ag.url)), state.consultas, ag.pessoaId, HOJE);
    for (const c of d.novas) api.addConsulta(c);
    for (const a of d.alteradas) api.editar('consultas', a.id, a.patch, '');
    api.removerVarios('consultas', d.removidas.map((c) => c.id));
    mudar({ atualizando: false, ultima: horaAgora() });
    const n = d.novas.length + d.alteradas.length + d.removidas.length;
    if (aviso || n) {
      api.toast({
        texto: n
          ? [d.novas.length && `${d.novas.length} nova${d.novas.length > 1 ? 's' : ''}`, d.alteradas.length && `${d.alteradas.length} alterada${d.alteradas.length > 1 ? 's' : ''}`, d.removidas.length && `${d.removidas.length} cancelada${d.removidas.length > 1 ? 's' : ''}`].filter(Boolean).join(', ') + ' na agenda'
          : 'Agenda em dia',
      });
    }
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    mudar({ atualizando: false, erro });
    if (aviso) api.toast({ texto: `Não foi possível atualizar: ${erro}` });
  }
}

/** Montado uma vez no app: atualiza a agenda conectada assim que os dados abrem. */
export function useAtualizarAgendaAoAbrir() {
  const store = useStore();
  const feito = useRef(false);
  const pronto = store.status === 'pronto' && !store.state.bloqueado;
  useEffect(() => {
    if (!pronto || feito.current || !store.state.config.agenda?.url) return;
    feito.current = true;
    void atualizarAgenda(store, { aviso: false });
  }, [pronto, store]);
}
