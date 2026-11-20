// Dose por peso (pets e crianças): mg/kg × peso ÷ concentração = quantas unidades por dose.
// Só uma conta para conferir a receita: quem define a dose é o veterinário ou o médico. Testado em porPeso.test.ts.

import type { Remedio } from './types';

/** Como arredondar a quantidade: comprimido e cápsula em ¼, gotas inteiras, mL em 0,1, o resto em ½. */
const PASSO: Record<string, number> = { comprimido: 0.25, capsula: 1, gota: 1, ml: 0.1 };

/** Unidades por dose para `mgKg` × `kg`, com `mgPorUnidade` (mg em 1 comprimido, 1 mL ou 1 gota). `exata` sem arredondar. */
export function dosePorPeso(mgKg: number, kg: number, mgPorUnidade: number, forma: string): { mg: number; exata: number; qtd: number } | undefined {
  if (!(mgKg > 0) || !(kg > 0) || !(mgPorUnidade > 0)) return undefined;
  const mg = Math.round(mgKg * kg * 100) / 100;
  const exata = mg / mgPorUnidade;
  const passo = PASSO[forma] ?? 0.5;
  const qtd = Math.max(passo, Math.round(exata / passo) * passo);
  return { mg, exata: Math.round(exata * 1000) / 1000, qtd: Math.round(qtd * 100) / 100 };
}

/** Diferença de peso a partir da qual a dose calculada merece revisão (10%). */
export const LIMITE_PESO = 0.1;

/** "Dose calculada para 19 kg; hoje são 21,5 kg." quando o peso mudou mais de 10%; senão vazio. */
export function avisoPeso(r: Pick<Remedio, 'porPeso' | 'ativo'>, pesoAtual?: number): string {
  if (!r.ativo || !r.porPeso || !pesoAtual) return '';
  const { kg } = r.porPeso;
  if (Math.abs(pesoAtual - kg) / kg <= LIMITE_PESO) return '';
  const f = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
  return `Dose calculada para ${f(kg)} kg; hoje são ${f(pesoAtual)} kg. Confira a dose com quem receitou.`;
}

/** "5 mg/kg × 19 kg = 95 mg". */
export const contaPorPeso = (p: NonNullable<Remedio['porPeso']>) => {
  const f = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  return `${f(p.mgKg)} mg/kg × ${f(p.kg)} kg = ${f(p.mgKg * p.kg)} mg`;
};
