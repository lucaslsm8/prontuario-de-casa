// Consultas na agenda do celular (Android, AgendaPlugin.kt). A agenda escolhida fica neste aparelho
// (localStorage: só o id e o nome da agenda); os eventos são as consultas de quem usa o aparelho.

import { useEffect } from 'react';
import { EM_TAURI } from './tempo';
import { addDias } from './format';
import type { Consulta } from './types';
import type { State } from './store';

export const agendaCelularDisponivel = () => EM_TAURI && /Android/i.test(navigator.userAgent);

export interface EventoAgenda { chave: string; titulo: string; inicio: number; fim: number; local?: string; descricao?: string }
export interface Calendario { id: number; nome: string; conta: string; principal: boolean }
export interface AgendaEscolhida { id: number; nome: string }

/** Consultas de `pessoaId` do último ano em diante, como eventos (hora local do aparelho). */
export function eventosDaAgenda(consultas: Consulta[], pessoaId: string, hoje: string, nomePessoa?: string): EventoAgenda[] {
  const desde = addDias(hoje, -365);
  return consultas
    .filter((c) => c.pessoaId === pessoaId && c.data >= desde && /^\d{2}:\d{2}$/.test(c.hora))
    .map((c) => {
      const inicio = new Date(`${c.data}T${c.hora}:00`).getTime();
      const extras = [
        c.preparo && `Preparo: ${c.preparo}`,
        c.levar.length > 0 && `Levar: ${c.levar.map((l) => l.item).join(', ')}`,
        c.peloPlano && `Pelo plano: ${c.peloPlano}`,
        nomePessoa && `Marcada no Prontuário de Casa para ${nomePessoa}`,
      ].filter(Boolean);
      return {
        chave: c.id,
        titulo: [c.titulo, c.profissional].filter(Boolean).join(' · '),
        inicio,
        fim: inicio + (c.duracaoMin ?? 60) * 60_000,
        local: [c.local, c.endereco].filter(Boolean).join(', ') || undefined,
        descricao: extras.join('\n') || undefined,
      };
    });
}

const CHAVE = 'agenda-celular';
export function agendaEscolhida(): AgendaEscolhida | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    return v && typeof v.id === 'number' ? v : null;
  } catch {
    return null;
  }
}
function guardar(a: AgendaEscolhida | null) {
  try {
    if (a) localStorage.setItem(CHAVE, JSON.stringify(a));
    else localStorage.removeItem(CHAVE);
  } catch { /* sem armazenamento: vale só nesta abertura */ }
}

async function invocar<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/** Pede a permissão de agenda (se faltar) e lista as agendas em que dá para escrever. */
export async function listarCalendarios(): Promise<Calendario[]> {
  const r = await invocar<{ calendarios: Calendario[] }>('agenda_calendarios');
  return r.calendarios ?? [];
}

export async function sincronizarAgenda(calendarioid: number, eventos: EventoAgenda[]) {
  return invocar<{ criados?: number; apagados?: number }>('agenda_sincronizar', { calendarioid, eventos });
}

/** Liga (com a agenda escolhida) ou desliga (tira da agenda tudo o que o app pôs). */
export async function escolherAgenda(a: AgendaEscolhida | null, eventos: EventoAgenda[]) {
  await sincronizarAgenda(a?.id ?? 0, a ? eventos : []);
  guardar(a);
  window.dispatchEvent(new Event('agenda-celular'));
}

/** Mantém a agenda do celular igual às consultas de quem usa o aparelho (2 s depois da última mudança). */
export function useAgendaCelular(state: State, pronto: boolean, hoje: string) {
  const eu = state.pessoas.find((p) => p.souEu);
  const eventos = pronto && eu ? JSON.stringify(eventosDaAgenda(state.consultas, eu.id, hoje)) : '';
  useEffect(() => {
    if (!eventos || !agendaCelularDisponivel()) return;
    const a = agendaEscolhida();
    if (!a) return;
    const t = window.setTimeout(() => {
      sincronizarAgenda(a.id, JSON.parse(eventos)).catch((e) => console.warn('Agenda do celular', e));
    }, 2000);
    return () => window.clearTimeout(t);
  }, [eventos]);
}
