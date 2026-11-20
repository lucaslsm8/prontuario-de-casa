// Ração do pet: quanto dura o saco e quando comprar. Funções puras, testadas em racao.test.ts.

import type { Racao } from './types';

const utc = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const somar = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);

/** Dias que um saco dura (inteiros), ou `undefined` sem saco ou porção. */
export const diasDoSaco = (r: Pick<Racao, 'sacoKg' | 'gramasDia'>) =>
  r.sacoKg && r.gramasDia > 0 ? Math.floor((r.sacoKg * 1000) / r.gramasDia) : undefined;

/** Quando o saco aberto acaba (ISO) e quantos dias faltam a partir de `hoje` (negativo = já acabou). */
export function fimDoSaco(r: Racao, hoje: string): { data: string; faltam: number } | undefined {
  const dias = diasDoSaco(r);
  if (dias == null || !r.abertoEm) return undefined;
  const data = somar(r.abertoEm, dias);
  return { data, faltam: Math.round((utc(data) - utc(hoje)) / 86_400_000) };
}

/** Avisar para comprar quando faltam até tantos dias. */
export const AVISO_RACAO_DIAS = 5;

/** "180 g por dia em 2 refeições (90 g cada)". */
export function textoPorcao(r: Pick<Racao, 'gramasDia' | 'refeicoes'>): string {
  const g = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} g`;
  if (!r.refeicoes || r.refeicoes < 2) return `${g(r.gramasDia)} por dia`;
  return `${g(r.gramasDia)} por dia em ${r.refeicoes} refeições (${g(r.gramasDia / r.refeicoes)} cada)`;
}
