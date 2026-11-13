// Valores dos exames de laboratório (colesterol, glicose, TSH…) e a evolução de cada um.
// Funções puras, testadas em resultados.test.ts.

import type { Exame, Resultado } from './types';
import type { Ponto } from './medicoes';
import { lerNumeroBR } from './perfil';

export interface InfoMarcador { nome: string; unidade: string; min?: number; max?: number }

/** Marcadores comuns, com a unidade e a faixa de referência usual para adultos (só orientação). */
export const MARCADORES: InfoMarcador[] = [
  { nome: 'Glicose', unidade: 'mg/dL', min: 70, max: 99 },
  { nome: 'Hemoglobina glicada', unidade: '%', max: 5.7 },
  { nome: 'Colesterol total', unidade: 'mg/dL', max: 190 },
  { nome: 'LDL', unidade: 'mg/dL', max: 130 },
  { nome: 'HDL', unidade: 'mg/dL', min: 40 },
  { nome: 'Triglicerídeos', unidade: 'mg/dL', max: 150 },
  { nome: 'TSH', unidade: 'mUI/L', min: 0.4, max: 4 },
  { nome: 'T4 livre', unidade: 'ng/dL', min: 0.9, max: 1.8 },
  { nome: 'Creatinina', unidade: 'mg/dL', min: 0.6, max: 1.2 },
  { nome: 'Ureia', unidade: 'mg/dL', min: 15, max: 45 },
  { nome: 'Ácido úrico', unidade: 'mg/dL', min: 2.5, max: 7 },
  { nome: 'Hemoglobina', unidade: 'g/dL', min: 12, max: 17 },
  { nome: 'Leucócitos', unidade: 'mil/mm³', min: 4, max: 11 },
  { nome: 'Plaquetas', unidade: 'mil/mm³', min: 150, max: 450 },
  { nome: 'Ferritina', unidade: 'ng/mL', min: 15, max: 300 },
  { nome: 'Vitamina D', unidade: 'ng/mL', min: 30, max: 100 },
  { nome: 'Vitamina B12', unidade: 'pg/mL', min: 200, max: 900 },
  { nome: 'TGO (AST)', unidade: 'U/L', max: 40 },
  { nome: 'TGP (ALT)', unidade: 'U/L', max: 41 },
  { nome: 'PSA', unidade: 'ng/mL', max: 4 },
  { nome: 'Potássio', unidade: 'mEq/L', min: 3.5, max: 5.1 },
  { nome: 'Sódio', unidade: 'mEq/L', min: 135, max: 145 },
];

const chave = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export const infoMarcador = (nome: string) => MARCADORES.find((m) => chave(m.nome) === chave(nome));

/** Fora da faixa de referência do marcador (ou da faixa digitada no resultado). */
export function foraDaFaixa(r: Resultado): 'alto' | 'baixo' | undefined {
  const i = infoMarcador(r.marcador);
  const min = r.min ?? i?.min;
  const max = r.max ?? i?.max;
  if (max != null && r.valor > max) return 'alto';
  if (min != null && r.valor < min) return 'baixo';
  return undefined;
}

/** 212 → "212"; 5.9 → "5,9"; 2.15 → "2,15". */
export const fmtValor = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ','));
export const fmtResultado = (r: Resultado) => `${fmtValor(r.valor)} ${r.unidade}`.trim();

/** Lê o valor digitado; unidade vazia usa a do marcador conhecido. */
export function montarResultado(marcador: string, valor: string, unidade: string): Resultado | undefined {
  const nome = marcador.trim();
  const v = lerNumeroBR(valor);
  if (!nome || v == null) return undefined;
  const i = infoMarcador(nome);
  return { marcador: i?.nome ?? nome, valor: v, unidade: unidade.trim() || i?.unidade || '' };
}

/** Marcadores que a pessoa tem em algum exame (na ordem da lista conhecida; os outros depois). */
export function marcadoresDaPessoa(exames: Exame[], pessoaId: string): string[] {
  const nomes = new Set(exames.filter((e) => e.pessoaId === pessoaId).flatMap((e) => (e.resultados ?? []).map((r) => r.marcador)));
  const conhecidos = MARCADORES.map((m) => m.nome).filter((n) => nomes.has(n));
  return [...conhecidos, ...[...nomes].filter((n) => !conhecidos.includes(n)).sort()];
}

/** Evolução de um marcador: um ponto por exame, em ordem de coleta. */
export function serieMarcador(exames: Exame[], pessoaId: string, marcador: string): (Ponto & { exameId: string; resultado: Resultado })[] {
  return exames
    .filter((e) => e.pessoaId === pessoaId)
    .flatMap((e) => (e.resultados ?? []).filter((r) => chave(r.marcador) === chave(marcador)).map((r) => ({ e, r })))
    .sort((a, b) => a.e.dataColeta.localeCompare(b.e.dataColeta))
    .map(({ e, r }) => ({ data: e.dataColeta, valor: r.valor, rotulo: fmtResultado(r), exameId: e.id, resultado: r }));
}

/** Quantos valores do exame estão fora da faixa (para o destaque na lista). */
export const qtdForaDaFaixa = (e: Pick<Exame, 'resultados'>) => (e.resultados ?? []).filter((r) => foraDaFaixa(r)).length;
/** "1 valor fora da faixa" / "3 valores fora da faixa" / '' */
export const textoForaDaFaixa = (n: number) => (n ? `${n} ${n === 1 ? 'valor' : 'valores'} fora da faixa` : '');
