// Agenda em .ics (iCalendar): exportar consultas para o Google/Outlook e importar convites.
// Sem rede: o arquivo é escolhido ou salvo pela pessoa. Funções puras, testadas em ics.test.ts.

import type { Consulta } from './types';

const dois = (n: number) => String(n).padStart(2, '0');
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const desescapar = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** "2026-11-05" + "10:00" → "20261105T100000" (hora local, sem fuso: o calendário usa o do aparelho). */
const dt = (data: string, hora: string) => `${data.replace(/-/g, '')}T${hora.replace(':', '')}00`;

/** Quebra linhas longas (RFC 5545: 75 octetos; aqui 74 caracteres, folgado para pt-BR). */
function dobrar(linha: string) {
  const out: string[] = [];
  for (let i = 0; i < linha.length; i += 74) out.push((i ? ' ' : '') + linha.slice(i, i + 74));
  return out.join('\r\n');
}

export function gerarIcs(consultas: Consulta[], nomeDe: (pessoaId: string) => string, agora = new Date()): string {
  const carimbo = `${agora.getUTCFullYear()}${dois(agora.getUTCMonth() + 1)}${dois(agora.getUTCDate())}T${dois(agora.getUTCHours())}${dois(agora.getUTCMinutes())}00Z`;
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prontuário de Casa//PT-BR', 'CALSCALE:GREGORIAN'];
  for (const c of consultas) {
    const [h, m] = c.hora.split(':').map(Number);
    const fimMin = h * 60 + m + (c.duracaoMin ?? 30);
    const fim = `${dois(Math.min(23, Math.floor(fimMin / 60)))}:${dois(fimMin >= 24 * 60 ? 59 : fimMin % 60)}`;
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${c.id}@arquivo-da-familia`,
      `DTSTAMP:${carimbo}`,
      `DTSTART:${dt(c.data, c.hora)}`,
      `DTEND:${dt(c.data, fim)}`,
      dobrar(`SUMMARY:${escapar(`${c.titulo} · ${nomeDe(c.pessoaId)}`)}`),
      ...(c.local ? [dobrar(`LOCATION:${escapar(c.local)}`)] : []),
      ...(c.profissional ? [dobrar(`DESCRIPTION:${escapar(c.profissional)}`)] : []),
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n';
}

export interface EventoIcs { titulo: string; data: string; hora: string; local?: string; descricao?: string; uid?: string }

/** Lê os VEVENTs de um .ics (data e hora locais; UTC "Z" é convertido para o fuso do aparelho). */
export function lerIcs(texto: string): EventoIcs[] {
  // Desdobra as linhas continuadas (começam com espaço ou tab).
  const linhas = texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: EventoIcs[] = [];
  let atual: Record<string, string> | null = null;
  for (const l of linhas) {
    if (l === 'BEGIN:VEVENT') { atual = {}; continue; }
    if (l === 'END:VEVENT') {
      if (atual?.DTSTART) {
        const q = lerData(atual.DTSTART);
        if (q) out.push({ titulo: desescapar(atual.SUMMARY ?? 'Consulta').trim(), ...q, local: atual.LOCATION && desescapar(atual.LOCATION), descricao: atual.DESCRIPTION && desescapar(atual.DESCRIPTION), uid: atual.UID });
      }
      atual = null;
      continue;
    }
    if (!atual) continue;
    const i = l.indexOf(':');
    if (i < 0) continue;
    const chave = l.slice(0, i).split(';')[0].toUpperCase();
    const valor = l.slice(i + 1);
    // DTSTART;TZID=…: guarda a parte das propriedades para saber se é só data.
    atual[chave] = chave === 'DTSTART' ? `${l.slice(0, i)}|${valor}` : valor;
  }
  return out;
}

function lerData(bruto: string): { data: string; hora: string } | undefined {
  const [props, v] = bruto.split('|');
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return undefined;
  if (!m[4] || /VALUE=DATE(?!-)/.test(props)) return { data: `${m[1]}-${m[2]}-${m[3]}`, hora: '09:00' };
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { data: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`, hora: `${dois(d.getHours())}:${dois(d.getMinutes())}` };
  }
  return { data: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}` };
}

// ── Agenda conectada (Google, Outlook…) ──────────────────────────────────────

/** Id estável da consulta vinda da agenda conectada (o UID do evento, encurtado). */
export function idDaAgenda(uid: string | undefined, e: EventoIcs) {
  const base = uid ?? `${e.data}${e.hora}${e.titulo}`;
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return `gcal-${h.toString(36)}`;
}

export interface Diferenca { novas: Consulta[]; alteradas: { id: string; patch: Partial<Consulta> }[]; removidas: Consulta[] }

/**
 * Compara a agenda baixada com as consultas que vieram dela (id "gcal-…").
 * Só olha de hoje em diante: o que já passou fica como está. Evento que sumiu da agenda = cancelado.
 */
export function compararAgenda(eventos: EventoIcs[], consultas: Consulta[], pessoaId: string, hoje: string): Diferenca {
  const futuros = eventos.filter((e) => e.data >= hoje);
  const vindas = new Map(consultas.filter((c) => c.id.startsWith('gcal-')).map((c) => [c.id, c]));
  const vistos = new Set<string>();
  const novas: Consulta[] = [];
  const alteradas: Diferenca['alteradas'] = [];
  for (const e of futuros) {
    const id = idDaAgenda(e.uid, e);
    if (vistos.has(id)) continue;
    vistos.add(id);
    const atual = vindas.get(id);
    const dados = { titulo: e.titulo, data: e.data, hora: e.hora, local: e.local || undefined };
    if (!atual) {
      novas.push({ id, tipo: /exame|coleta|laborat/i.test(e.titulo) ? 'exame' : 'consulta', pessoaId, ...dados, duracaoMin: 30, levar: [], lembretes: ['1 dia antes'] });
      continue;
    }
    const patch: Partial<Consulta> = {};
    for (const k of ['titulo', 'data', 'hora', 'local'] as const) if ((atual[k] ?? undefined) !== dados[k]) (patch as Record<string, unknown>)[k] = dados[k] ?? null;
    if (Object.keys(patch).length) alteradas.push({ id, patch });
  }
  const removidas = [...vindas.values()].filter((c) => c.data >= hoje && !vistos.has(c.id));
  return { novas, alteradas, removidas };
}
