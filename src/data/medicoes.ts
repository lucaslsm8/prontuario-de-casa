// Medições de pessoas (peso, pressão, glicemia…) e séries para os gráficos de progresso.
// Funções puras, testadas em medicoes.test.ts.

import type { Medicao, Pesagem, Pessoa, TipoMedicao } from './types';
import { lerNumeroBR } from './perfil';
import { brParaISO, somarDias } from './formularios-puro';
import { numBR } from './format';

export interface InfoMedicao {
  id: TipoMedicao;
  nome: string;
  unidade: string;
  casas: number;
  /** Faixa de referência desenhada no gráfico (só orientação, não diagnóstico). */
  faixa?: [number, number];
  faixa2?: [number, number];
  dupla?: boolean;
  /** Limites para aceitar o valor digitado. */
  min: number;
  max: number;
}

export const MEDICOES: InfoMedicao[] = [
  { id: 'peso', nome: 'Peso', unidade: 'kg', casas: 1, min: 1, max: 400 },
  { id: 'pressao', nome: 'Pressão', unidade: 'mmHg', casas: 0, faixa: [90, 120], faixa2: [60, 80], dupla: true, min: 40, max: 260 },
  { id: 'glicemia', nome: 'Glicemia', unidade: 'mg/dL', casas: 0, faixa: [70, 99], min: 20, max: 700 },
  { id: 'altura', nome: 'Altura', unidade: 'm', casas: 2, min: 0.3, max: 2.5 },
  { id: 'temperatura', nome: 'Temperatura', unidade: '°C', casas: 1, faixa: [35.5, 37.5], min: 30, max: 45 },
  { id: 'saturacao', nome: 'Saturação', unidade: '%', casas: 0, faixa: [95, 100], min: 50, max: 100 },
];
export const infoMedicao = (t: TipoMedicao) => MEDICOES.find((m) => m.id === t)!;

/** Contexto da glicemia. */
export const CONTEXTOS_GLICEMIA = ['Jejum', 'Pós-refeição', 'Aleatória'] as const;

export const fmtMedicao = (m: Pick<Medicao, 'tipo' | 'valor' | 'valor2'>) => {
  const i = infoMedicao(m.tipo);
  if (m.tipo === 'pressao') return `${m.valor}/${m.valor2 ?? '—'}`;
  return i.casas ? numBR(m.valor, i.casas) : String(Math.round(m.valor));
};

/** Medições de um tipo, da mais antiga para a mais nova (desempate pela ordem de registro). */
export function serieMedicao(ms: Medicao[], pessoaId: string, tipo: TipoMedicao): Medicao[] {
  return ms
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.pessoaId === pessoaId && m.tipo === tipo)
    .sort((a, b) => `${a.m.data}${a.m.hora ?? ''}`.localeCompare(`${b.m.data}${b.m.hora ?? ''}`) || a.i - b.i)
    .map(({ m }) => m);
}

export const ultimaMedicao = (ms: Medicao[], pessoaId: string, tipo: TipoMedicao) => serieMedicao(ms, pessoaId, tipo).slice(-1)[0] as Medicao | undefined;

/** Variação entre a última e a primeira medição da série ("+1,2 kg", "−4"). */
export function variacao(serie: { valor: number }[], casas: number, unidade = ''): string | undefined {
  if (serie.length < 2) return undefined;
  const d = serie[serie.length - 1].valor - serie[0].valor;
  const r = Math.round(d * 10 ** casas) / 10 ** casas;
  if (r === 0) return 'estável';
  return `${r > 0 ? '+' : '−'}${casas ? numBR(Math.abs(r), casas) : Math.abs(r)}${unidade ? ` ${unidade}` : ''}`;
}

/** IMC com 1 casa (peso em kg, altura em m). */
export function imc(peso?: number, altura?: number): number | undefined {
  if (!peso || !altura) return undefined;
  return Math.round((peso / (altura * altura)) * 10) / 10;
}
export function faixaImc(v: number) {
  if (v < 18.5) return 'abaixo do peso';
  if (v < 25) return 'peso adequado';
  if (v < 30) return 'sobrepeso';
  return 'obesidade';
}

/** O que a pessoa passa a mostrar no perfil depois de uma medição (sempre a mais recente de cada tipo). */
export function perfilDasMedicoes(p: Pessoa, ms: Medicao[]): Pick<Pessoa, 'peso' | 'altura' | 'pressao'> {
  const peso = ultimaMedicao(ms, p.id, 'peso');
  const altura = ultimaMedicao(ms, p.id, 'altura');
  const pressao = ultimaMedicao(ms, p.id, 'pressao');
  return {
    peso: peso?.valor ?? p.peso,
    altura: altura?.valor ?? p.altura,
    pressao: pressao && (!p.pressao || pressao.data >= p.pressao.data) ? { valor: `${pressao.valor}/${pressao.valor2}`, data: pressao.data } : p.pressao,
  };
}

// ── Formulário ──────────────────────────────────────────────────────────────

export interface FormMedicao { tipo: TipoMedicao; data: string; hora: string; valor: string; valor2: string; contexto: string; nota: string }
export type ErrosMedicao = Partial<Record<'data' | 'valor' | 'valor2', string>>;

/** Lê "130/80" ou "13/8" (em cmHg, como se fala no Brasil) → [130, 80]. */
export function lerPressao(texto: string): [number, number] | undefined {
  const m = texto.trim().match(/^(\d{1,3})\s*[/x×]\s*(\d{1,3})$/);
  if (!m) return undefined;
  let [a, b] = [Number(m[1]), Number(m[2])];
  if (a < 30 && b < 20) [a, b] = [a * 10, b * 10];
  return a > b ? [a, b] : undefined;
}

export function montarMedicao(f: FormMedicao, pessoaId: string, hoje: string): { medicao?: Omit<Medicao, 'id'>; erros: ErrosMedicao } {
  const i = infoMedicao(f.tipo);
  const erros: ErrosMedicao = {};
  const data = brParaISO(f.data);
  if (!data) erros.data = 'Use DD/MM/AAAA.';
  else if (data > hoje) erros.data = 'A data não pode ser no futuro.';
  let valor: number | undefined;
  let valor2: number | undefined;
  if (f.tipo === 'pressao') {
    const p = lerPressao(f.valor2 ? `${f.valor}/${f.valor2}` : f.valor);
    if (!p || p[0] < i.min || p[0] > i.max) erros.valor = 'Use máxima/mínima, ex.: 120/80.';
    else [valor, valor2] = p;
  } else {
    valor = lerNumeroBR(f.valor);
    if (valor == null || valor < i.min || valor > i.max) erros.valor = `Valor entre ${numBR(i.min, i.casas)} e ${numBR(i.max, i.casas)} ${i.unidade}.`;
  }
  if (Object.keys(erros).length) return { erros };
  const hora = /^\d{2}:\d{2}$/.test(f.hora) ? f.hora : undefined;
  const contexto = f.tipo === 'glicemia' && f.contexto ? f.contexto : undefined;
  const nota = f.nota.trim() || undefined;
  return { erros, medicao: { pessoaId, tipo: f.tipo, data: data!, hora, valor: valor!, ...(valor2 != null ? { valor2 } : {}), ...(contexto ? { contexto } : {}), ...(nota ? { nota } : {}) } };
}

// ── Séries para os gráficos ─────────────────────────────────────────────────

export interface Ponto { data: string; valor: number; rotulo?: string }

export const pontosMedicao = (serie: Medicao[], qual: 'valor' | 'valor2' = 'valor'): Ponto[] =>
  serie.filter((m) => m[qual] != null).map((m) => ({ data: m.data, valor: m[qual]!, rotulo: `${fmtMedicao(m)} ${infoMedicao(m.tipo).unidade}` }));

export function pontosPesagem(ps: Pesagem[], petId: string): Ponto[] {
  return ps
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.pessoaId === petId)
    .sort((a, b) => a.x.data.localeCompare(b.x.data) || a.i - b.i)
    .map(({ x }) => ({ data: x.data, valor: x.kg, rotulo: `${numBR(x.kg, 1)} kg` }));
}

/** Doses tomadas / previstas por semana (semanas terminando hoje), para o gráfico de adesão. */
export function adesaoPorSemana(dias: { iso: string; tomadas: number; previstas: number }[], hoje: string, semanas = 8): Ponto[] {
  const out: Ponto[] = [];
  for (let w = semanas - 1; w >= 0; w--) {
    const fim = somarDias(hoje, -7 * w);
    const ini = somarDias(fim, -6);
    const sem = dias.filter((d) => d.iso >= ini && d.iso <= fim && d.iso !== hoje);
    const prev = sem.reduce((a, d) => a + d.previstas, 0);
    if (!prev) continue;
    const pct = Math.round((sem.reduce((a, d) => a + Math.min(d.tomadas, d.previstas), 0) / prev) * 100);
    out.push({ data: fim, valor: pct, rotulo: `${pct}%` });
  }
  return out;
}

/** Peso, altura e pressão salvos pelo "Editar perfil" viram medições do dia (para o histórico). */
export function medicoesDoPatch(pessoaId: string, patch: { peso?: number | null; altura?: number | null; pressao?: { valor: string; data: string } | null }, hoje: string): Omit<Medicao, 'id'>[] {
  const out: Omit<Medicao, 'id'>[] = [];
  if (typeof patch.peso === 'number') out.push({ pessoaId, tipo: 'peso', data: hoje, valor: patch.peso });
  if (typeof patch.altura === 'number') out.push({ pessoaId, tipo: 'altura', data: hoje, valor: patch.altura });
  const p = patch.pressao && lerPressao(patch.pressao.valor);
  if (p && patch.pressao) out.push({ pessoaId, tipo: 'pressao', data: patch.pressao.data, valor: p[0], valor2: p[1] });
  return out;
}
