// Em que dias o remédio é tomado e com que dose: todo dia, dias da semana, a cada N dias
// (dia sim, dia não; semanal) e desmame (a dose diminui em etapas). Funções puras, testadas
// em frequencia.test.ts. Não dependem de format.ts (que reexporta `qtdPorDose` daqui).

import { lerDose, montarDose, textoQuantidade, FORMAS_REMEDIO } from './formularios-puro';
import type { Remedio } from './types';

/** `semana`: 0 = domingo … 6 = sábado. `cada`: a cada N dias contando do início (2 = dia sim, dia não; 7 = semanal). */
export type DiasRemedio = { semana: number[] } | { cada: number };
/** Uma etapa do desmame: a quantidade por dose (na forma do remédio) e por quantos dias. */
export interface EtapaDesmame { qtd: number; dias: number }

type RemDias = Pick<Remedio, 'inicio' | 'fim' | 'dias' | 'desmame'>;

const utc = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const entre = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86_400_000);
const somar = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
export const diaDaSemana = (iso: string) => new Date(utc(iso)).getUTCDay();

export const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Toda terça → "toda terça"; sábado e domingo → "todo". */
const todo = (d: number) => (d === 0 || d === 6 ? `todo ${NOMES_DIAS[d]}` : `toda ${NOMES_DIAS[d]}`);
const juntar = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/** Quantas unidades saem do estoque por dose: "2 comprimidos" → 2, "½ comprimido" → 0,5, "1,5 comp." → 1,5. */
export function qtdPorDose(r: Pick<Remedio, 'dose' | 'doseLonga'>) {
  const t = (r.doseLonga ?? r.dose).trim();
  const fr = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fr && Number(fr[1]) && Number(fr[2])) return Number(fr[1]) / Number(fr[2]);
  const m = t.match(/^(\d+(?:[.,]\d+)?)?\s*(½)?/);
  const n = (m?.[1] ? Number(m[1].replace(',', '.')) : 0) + (m?.[2] ? 0.5 : 0);
  return n > 0 ? n : 1;
}

/** Dias somados das etapas do desmame. */
export const duracaoDesmame = (etapas: EtapaDesmame[]) => etapas.reduce((n, e) => n + Math.max(0, Math.round(e.dias)), 0);
/** Último dia do desmame (inclusive). */
export const fimDoDesmame = (inicio: string, etapas: EtapaDesmame[]) => somar(inicio, Math.max(1, duracaoDesmame(etapas)) - 1);

/** Índice da etapa do desmame no dia, ou `undefined` (sem desmame, antes do início ou depois da última etapa). */
export function etapaNoDia(r: RemDias, iso: string): number | undefined {
  if (!r.desmame?.length || !r.inicio) return undefined;
  let n = entre(r.inicio, iso);
  if (n < 0) return undefined;
  for (let i = 0; i < r.desmame.length; i++) {
    const d = Math.max(0, Math.round(r.desmame[i].dias));
    if (n < d) return i;
    n -= d;
  }
  return undefined;
}

/**
 * Toma neste dia? Dentro de início e fim, nos dias escolhidos e dentro das etapas do desmame.
 * Não olha `ativo` nem "se necessário". `ignorarFim`: para a conta do estoque, que segue além do fim.
 */
export function tomaNoDia(r: RemDias, iso: string, { ignorarFim = false } = {}): boolean {
  if (r.inicio && iso < r.inicio) return false;
  if (!ignorarFim && r.fim && iso > r.fim) return false;
  if (r.desmame?.length && etapaNoDia(r, iso) === undefined) return false;
  const d = r.dias;
  if (!d) return true;
  if ('semana' in d) return d.semana.includes(diaDaSemana(iso));
  if (!r.inicio) return true;
  return entre(r.inicio, iso) % Math.max(1, Math.round(d.cada)) === 0;
}

/** Unidades por dose no dia (a da etapa, no desmame). */
export function qtdNoDia(r: RemDias & Pick<Remedio, 'dose' | 'doseLonga'>, iso: string) {
  const e = etapaNoDia(r, iso);
  return e !== undefined ? r.desmame![e].qtd : qtdPorDose(r);
}

/** O remédio com a dose do dia (no desmame, a da etapa); fora do desmame, o próprio remédio. */
export function comDoseDoDia<T extends Remedio>(r: T, iso: string): T {
  const e = etapaNoDia(r, iso);
  if (e === undefined) return r;
  const { dose, doseLonga } = montarDose(r.desmame![e].qtd, lerDose(r.doseLonga ?? r.dose).forma);
  return { ...r, dose, doseLonga };
}

/** "segunda, quarta e sexta", "dia sim, dia não", "toda terça", "a cada 3 dias"; todo dia = "". */
export function textoDias(r: Pick<Remedio, 'dias' | 'inicio'>): string {
  const d = r.dias;
  if (!d) return '';
  if ('semana' in d) {
    const s = [...new Set(d.semana)].sort();
    if (s.length === 0 || s.length === 7) return '';
    if (s.join() === '1,2,3,4,5') return 'de segunda a sexta';
    if (s.join() === '0,6') return 'sábado e domingo';
    if (s.length === 1) return todo(s[0]);
    return juntar(s.map((x) => (s.length > 3 ? DIAS_CURTOS[x] : NOMES_DIAS[x])));
  }
  const n = Math.max(1, Math.round(d.cada));
  if (n === 1) return '';
  if (n === 2) return 'dia sim, dia não';
  if (n === 7) return r.inicio ? todo(diaDaSemana(r.inicio)) : '1x por semana';
  if (n === 14) return 'a cada 2 semanas';
  return `a cada ${n} dias`;
}

/** "2 comp. por 5 dias, depois 1 comp. por 5 dias". */
export function textoDesmame(r: Pick<Remedio, 'desmame' | 'dose' | 'doseLonga'>): string {
  if (!r.desmame?.length) return '';
  const forma = lerDose(r.doseLonga ?? r.dose).forma;
  return r.desmame.map((e, i) => `${i ? 'depois ' : ''}${montarDose(e.qtd, forma).dose} por ${e.dias} ${e.dias === 1 ? 'dia' : 'dias'}`).join(', ');
}

/** Resumo para as listas: "dia sim, dia não", "desmame (2 → 1 → ½ comp.)". Vazio = todo dia. */
export function resumoDias(r: Pick<Remedio, 'dias' | 'inicio' | 'desmame' | 'dose' | 'doseLonga'>): string {
  const partes = [textoDias(r)];
  if (r.desmame?.length) {
    const f = FORMAS_REMEDIO.find((x) => x.id === lerDose(r.doseLonga ?? r.dose).forma) ?? FORMAS_REMEDIO[0];
    partes.push(`desmame (${r.desmame.map((e) => textoQuantidade(e.qtd)).join(' → ')} ${f.curto ?? f.varios})`);
  }
  return partes.filter(Boolean).join(' · ');
}

/**
 * Quantos dias o estoque cobre a partir de `hoje`, dia a dia (para dias da semana, intervalo e desmame).
 * `porDia`: doses no dia em que toma. Para sempre que faltar para as doses de um dia; teto de 2 anos.
 */
export function diasCobertos(r: RemDias & Pick<Remedio, 'dose' | 'doseLonga' | 'estoque'>, hoje: string, porDia: number): number {
  let est = r.estoque ?? 0;
  const TETO = 730;
  for (let i = 0; i < TETO; i++) {
    const iso = somar(hoje, i);
    // O desmame termina de verdade: depois da última etapa não sai mais nada do estoque.
    if (!tomaNoDia(r, iso, { ignorarFim: !r.desmame?.length })) {
      if (r.desmame?.length && r.inicio && iso > fimDoDesmame(r.inicio, r.desmame)) return TETO;
      continue;
    }
    const precisa = porDia * qtdNoDia(r, iso);
    if (est + 1e-9 < precisa) return i;
    est -= precisa;
  }
  return TETO;
}

/** Validade da receita: dias até vencer (negativo = vencida), ou `undefined` sem validade. */
export const diasParaVencerReceita = (r: Pick<Remedio, 'receitaValidade'>, hoje: string) =>
  r.receitaValidade ? entre(hoje, r.receitaValidade) : undefined;
/** A partir de quantos dias antes a receita aparece como "vence em breve". */
export const AVISO_RECEITA_DIAS = 7;
/** "Receita vencida há 3 dias", "Receita vence amanhã", "Receita vence em 5 dias"; longe de vencer = "". */
export function avisoReceita(r: Pick<Remedio, 'receitaValidade'>, hoje: string): string {
  const n = diasParaVencerReceita(r, hoje);
  if (n === undefined || n > AVISO_RECEITA_DIAS) return '';
  if (n < 0) return `Receita vencida há ${-n} ${n === -1 ? 'dia' : 'dias'}`;
  if (n === 0) return 'Receita vence hoje';
  if (n === 1) return 'Receita vence amanhã';
  return `Receita vence em ${n} dias`;
}
