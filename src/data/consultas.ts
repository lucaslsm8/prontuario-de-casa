// Lista de consultas da família (desktop, aba Consultas): filtro, ordem e agrupamento por mês.
// Funções puras, testadas em consultas.test.ts.

import type { Consulta } from './types';
import { mesAno } from './format';

export type Quando = 'proximas' | 'passadas' | 'todas';
export type TipoFiltro = 'todos' | 'consulta' | 'exame';
export interface FiltroConsultas { quando: Quando; pessoa: string; tipo: TipoFiltro; busca: string }

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const chave = (c: Consulta) => `${c.data}${c.hora}`;

/** Próximas: da mais perto para a mais longe. Passadas: da mais recente para a mais antiga. */
export function filtrarConsultas(xs: Consulta[], f: FiltroConsultas, hoje: string, nomePessoa: (id: string) => string = () => ''): Consulta[] {
  const q = sem(f.busca.trim());
  const lista = xs.filter((c) => {
    if (f.quando === 'proximas' && c.data < hoje) return false;
    if (f.quando === 'passadas' && c.data >= hoje) return false;
    if (f.pessoa !== 'todos' && c.pessoaId !== f.pessoa) return false;
    if (f.tipo !== 'todos' && c.tipo !== f.tipo) return false;
    return !q || [c.titulo, c.profissional, c.local, c.endereco, c.anotacaoPos, nomePessoa(c.pessoaId)].some((t) => t && sem(t).includes(q));
  });
  return lista.sort((a, b) => (f.quando === 'passadas' ? chave(b).localeCompare(chave(a)) : chave(a).localeCompare(chave(b))));
}

/** "NOVEMBRO 2026" → consultas, na ordem recebida. */
export function porMesConsultas(xs: Consulta[]): [string, Consulta[]][] {
  const m = new Map<string, Consulta[]>();
  for (const c of xs) {
    const k = mesAno(c.data);
    m.set(k, [...(m.get(k) ?? []), c]);
  }
  return [...m.entries()];
}

/** "hoje", "amanhã", "em 5 dias" (próximas) ou "há 3 dias" (passadas). */
export function distancia(data: string, hoje: string): string {
  const d = Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}

// ── Ficha da consulta ───────────────────────────────────────────────────────

/** A mesma pessoa em consultas diferentes ("Dra. Marta Lins", "dra marta lins"): chave da foto do profissional. */
export const chaveProfissional = (nome: string) => `prof:${sem(nome).replace(/^(dra?|dr\(a\))\.?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** Endereço completo para o mapa: local + endereço. */
export const destinoConsulta = (c: Pick<Consulta, 'local' | 'endereco'>) => [c.local, c.endereco].filter(Boolean).join(', ');

/** Rota no Google Maps (a partir de onde a pessoa estiver, calculada pelo próprio Maps). Só abre com o toque; o app não envia nada sozinho. */
export const linkRota = (c: Pick<Consulta, 'local' | 'endereco'>) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoConsulta(c))}`;

/** Que horas sair: chegar `folga` min antes, contando o trajeto. "14:15" ou undefined sem trajeto. */
export function horaDeSair(hora: string, trajetoMin?: number, folga = 15): string | undefined {
  if (!trajetoMin || trajetoMin <= 0 || !/^\d{1,2}:\d{2}$/.test(hora)) return undefined;
  const [h, m] = hora.split(':').map(Number);
  const t = (((h * 60 + m - trajetoMin - folga) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "30 min", "1 h 15 min". */
export function textoTrajeto(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** "45", "1h15", "1 h 15", "1:15" → minutos; vazio ou inválido → undefined. */
export function lerTrajeto(texto: string): number | undefined {
  const t = texto.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return undefined;
  const hm = t.match(/^(\d{1,2})(?:h|:)(\d{1,2})?(?:min)?$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0) || undefined;
  const m = t.match(/^(\d{1,3})(?:min|m)?$/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : undefined;
}
