// Atualizações pelo GitHub Releases (tauri-plugin-updater).
// O app baixa só o latest.json e o instalador; a assinatura é conferida com a chave pública do tauri.conf.json.
// Nada é enviado. Verifica ao abrir (se "Verificar ao abrir" estiver ligado) e no botão "Procurar atualizações".

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { EM_TAURI } from './tempo';
import { useStore } from './store';

export interface Disponivel { versao: string; notas: string[]; publicadaData: string }
export interface InfoAtualizacao {
  estado: 'parado' | 'verificando' | 'em-dia' | 'disponivel' | 'baixando' | 'erro';
  disponivel?: Disponivel;
  /** 0–100 enquanto baixa (quando o servidor informa o tamanho). */
  progresso?: number;
  erro?: string;
  /** Mostrar o aviso (some no "Agora não" até a próxima verificação). */
  aviso: boolean;
}

let info: InfoAtualizacao = { estado: 'parado', aviso: false };
const ouvintes = new Set<() => void>();
const mudar = (i: Partial<InfoAtualizacao>) => { info = { ...info, ...i }; ouvintes.forEach((f) => f()); };
export const useInfoAtualizacao = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => info);
export const dispensarAviso = () => mudar({ aviso: false });
export const mostrarAviso = () => mudar({ aviso: true });

/** Notas do release (markdown) → lista de linhas: "- item" vira "item"; títulos e linhas vazias saem. */
export function lerNotas(corpo?: string): string[] {
  return (corpo ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*•]\s+/, ''));
}

/** "2026-11-02T13:00:00Z" ou "2026-11-02 13:00:00.0 +00:00:00" → "02/11/2026". */
export function dataDoRelease(d?: string): string {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

type Update = Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>>;
let pendente: Update = null;

type Store = ReturnType<typeof useStore>;

/** Consulta o GitHub. `manual` mostra "Você já tem a versão mais nova" e erros em toast. */
export async function verificarAtualizacao({ state, api }: Pick<Store, 'state' | 'api'>, { manual = false } = {}) {
  if (info.estado === 'verificando' || info.estado === 'baixando') return;
  mudar({ estado: 'verificando', erro: undefined });
  try {
    if (!EM_TAURI) {
      // Navegador (dados de exemplo): usa a versão fictícia do seed para mostrar o aviso.
      const d = state.config.update.disponivel;
      mudar(d ? { estado: 'disponivel', disponivel: { versao: d.versao, notas: d.notas, publicadaData: d.publicadaData }, aviso: true } : { estado: 'em-dia' });
    } else {
      const { check } = await import('@tauri-apps/plugin-updater');
      pendente = await check();
      mudar(pendente
        ? { estado: 'disponivel', disponivel: { versao: pendente.version, notas: lerNotas(pendente.body), publicadaData: dataDoRelease(pendente.date) }, aviso: true }
        : { estado: 'em-dia', disponivel: undefined });
    }
    if (manual && info.estado === 'em-dia') api.toast({ texto: `Você já tem a versão mais nova (${state.config.update.instalada})` });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    mudar({ estado: 'erro', erro });
    if (manual) api.toast({ texto: 'Não foi possível procurar atualizações. Confira a internet e tente de novo.' });
  }
}

/** Backup antes (se pedido), baixa, instala e reinicia. No Windows o instalador fecha o app sozinho. */
export async function instalarAtualizacao({ state, api }: Pick<Store, 'state' | 'api'>) {
  const d = info.disponivel;
  if (!d) return;
  if (state.config.update.backupAntes && state.config.backup.temSenha) {
    if (!(await api.backupAgora())) return; // sem backup, não instala (o toast já explica o erro)
  }
  if (!EM_TAURI || !pendente) {
    api.setConfig({ update: { ...state.config.update, instalada: d.versao, disponivel: undefined } });
    mudar({ estado: 'em-dia', disponivel: undefined, aviso: false });
    api.toast({ texto: `Atualizado para ${d.versao}` });
    return;
  }
  mudar({ estado: 'baixando', progresso: undefined });
  try {
    let total = 0;
    let baixado = 0;
    await pendente.downloadAndInstall((ev) => {
      if (ev.event === 'Started') total = ev.data.contentLength ?? 0;
      if (ev.event === 'Progress') { baixado += ev.data.chunkLength; if (total) mudar({ progresso: Math.round((baixado / total) * 100) }); }
    });
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    mudar({ estado: 'erro', erro: e instanceof Error ? e.message : String(e) });
    api.toast({ texto: 'A atualização não foi instalada. Seus dados não foram alterados.' });
  }
}

/** Montado uma vez no app: verifica ao abrir, depois de desbloquear, se a opção estiver ligada. */
export function useVerificarAtualizacaoAoAbrir() {
  const store = useStore();
  const feito = useRef(false);
  const pronto = store.status === 'pronto' && !store.state.bloqueado;
  useEffect(() => {
    if (!pronto || feito.current || !EM_TAURI || !store.state.config.update.auto) return;
    feito.current = true;
    void verificarAtualizacao(store);
  }, [pronto, store]);
}
