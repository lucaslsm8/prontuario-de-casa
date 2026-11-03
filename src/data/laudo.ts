// Texto do laudo (PDF do laboratório) → resultado, valores e data da coleta.
// Funções puras, testadas em laudo.test.ts. A extração do texto fica em pdf.ts.

import { MARCADORES, infoMarcador } from './resultados';
import type { Resultado } from './types';

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Linhas sem espaços repetidos; no máximo uma linha vazia seguida. */
export function limparTexto(t: string): string {
  return t
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Outros nomes com que os laboratórios escrevem os marcadores conhecidos. */
const APELIDOS: Record<string, string[]> = {
  Glicose: ['glicose em jejum', 'glicemia de jejum', 'glicemia em jejum', 'glicemia', 'glicose'],
  'Hemoglobina glicada': ['hemoglobina glicada', 'hemoglobina glicosilada', 'hba1c', 'a1c'],
  'Colesterol total': ['colesterol total'],
  LDL: ['ldl-colesterol', 'colesterol ldl', 'ldl colesterol', 'ldl'],
  HDL: ['hdl-colesterol', 'colesterol hdl', 'hdl colesterol', 'hdl'],
  Triglicerídeos: ['triglicerideos', 'triglicerides', 'triglicérides'],
  TSH: ['tsh ultrassensivel', 'tsh'],
  'T4 livre': ['t4 livre'],
  Creatinina: ['creatinina'],
  Ureia: ['ureia'],
  'Ácido úrico': ['acido urico'],
  Hemoglobina: ['hemoglobina'],
  Leucócitos: ['leucocitos'],
  Plaquetas: ['plaquetas'],
  Ferritina: ['ferritina'],
  'Vitamina D': ['25-hidroxivitamina d', '25 hidroxivitamina d', '25-oh vitamina d', 'vitamina d'],
  'Vitamina B12': ['vitamina b12', 'cianocobalamina'],
  'TGO (AST)': ['tgo', 'ast', 'aspartato aminotransferase'],
  'TGP (ALT)': ['tgp', 'alt', 'alanina aminotransferase'],
  PSA: ['psa total', 'psa'],
  Potássio: ['potassio'],
  Sódio: ['sodio'],
};

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;

/** "1.234,5" → 1234.5; "5,7" → 5.7; "0.9" → 0.9. */
function numero(s: string): number {
  const t = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  return Number(t);
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Valores dos marcadores conhecidos: a linha que começa com o nome (ou um apelido) e o primeiro número depois dele.
 * Se a linha tiver "70 a 99" / "70 - 99" depois do valor, vira a faixa de referência.
 * Cada linha serve a um marcador só (o apelido mais longo vence: "hemoglobina glicada" antes de "hemoglobina").
 */
export function marcadoresDoTexto(texto: string): Resultado[] {
  const linhas = limparTexto(texto).split('\n');
  const usadas = new Set<number>();
  const achados: Resultado[] = [];
  const pares = MARCADORES.flatMap((m) => (APELIDOS[m.nome] ?? [sem(m.nome)]).map((a) => ({ m, a: sem(a) }))).sort((x, y) => y.a.length - x.a.length);
  for (const { m, a } of pares) {
    if (achados.some((r) => r.marcador === m.nome)) continue;
    const re = new RegExp(`^${escapar(a)}(?![\\p{L}\\d])[^\\d]*?(${NUM})(?:\\s*(?:a|-|até|ate)\\s*(${NUM}))?`, 'u');
    for (let i = 0; i < linhas.length; i++) {
      if (usadas.has(i)) continue;
      const l = sem(linhas[i]).replace(/^[\s•·*-]+/, '');
      const x = re.exec(l);
      if (!x) continue;
      const valor = numero(x[1]);
      if (!Number.isFinite(valor)) continue;
      // "Hemoglobina 14,2 g/dL 12,0 a 17,0": o segundo par é a referência. Sem par, só o valor.
      const resto = l.slice(x.index + x[0].length);
      const ref = new RegExp(`(${NUM})\\s*(?:a|-|até|ate)\\s*(${NUM})`, 'u').exec(resto);
      const r: Resultado = { marcador: m.nome, valor, unidade: infoMarcador(m.nome)?.unidade ?? '' };
      if (ref) { r.min = numero(ref[1]); r.max = numero(ref[2]); }
      achados.push(r);
      usadas.add(i);
      break;
    }
  }
  return MARCADORES.flatMap((m) => achados.filter((r) => r.marcador === m.nome));
}

/** Data da coleta (ISO): a data na linha que fala de coleta; senão a primeira data do texto. */
export function dataDoTexto(texto: string): string | undefined {
  const re = /(\d{2})\/(\d{2})\/(\d{4})/;
  const linhas = limparTexto(texto).split('\n');
  const linha = linhas.find((l) => /colet|atendimento|realizad/i.test(sem(l)) && re.test(l)) ?? linhas.find((l) => re.test(l));
  const x = linha ? re.exec(linha) : null;
  if (!x) return undefined;
  const [, d, m, a] = x;
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return undefined;
  return `${a}-${m}-${d}`;
}
