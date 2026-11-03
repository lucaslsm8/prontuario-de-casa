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
