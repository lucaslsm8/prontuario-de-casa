// Carteira de vacinação do pet: do texto lido da foto (OCR no aparelho, ocr.ts) às vacinas com data.
// Função pura, testada em carteiraVacina.test.ts. O OCR erra letras e a letra à mão quase nunca sai,
// por isso a tela mostra tudo para a pessoa conferir antes de adicionar.

import type { Vacina } from './types';

/** Uma vacina achada na carteira. `data` = aplicação; `proxima` = revacinação, quando dá para ler. */
export interface VacinaLida { nome: string; data?: string; proxima?: string; lote?: string; trecho: string; jaRegistrada?: boolean }

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Polivalente sem dizer qual: a pessoa escolhe entre V8 e V10 na revisão. */
export const POLIVALENTE = 'V8 ou V10';

/** Ordem importa: o primeiro que bate dá o nome. Os padrões rodam no texto sem acento e em minúsculas. */
const VACINAS: { nome: string; re: RegExp }[] = [
  { nome: 'V10', re: /\bv\s?-?\s?10\b|dectupla|\bl\s?4\b/ },
  { nome: 'V8', re: /\bv\s?-?\s?8\b|octupla/ },
  { nome: 'V5 (felina)', re: /\bv\s?-?\s?5\b|quintupla felina|leucemia felina|\bfelv\b/ },
  { nome: 'V4 (felina)', re: /\bv\s?-?\s?4\b|quadrupla felina/ },
  { nome: 'V3 (felina)', re: /\bv\s?-?\s?3\b|triplice felina|felocell|fel-?o-?vax|purevax/ },
  { nome: 'Antirrábica', re: /antirrabica|anti-rabica|raiva|rabica|rabisin|nobivac\s*r\b|defensor|rabvac|imrab|rai-?vac/ },
  { nome: 'Gripe canina', re: /tosse dos canis|traqueobronquite|bronchi\s?-?guard|bronchine|nobivac\s*kc|pneumo\s?dog|gripe|bordetel/ },
  { nome: 'Giárdia', re: /giardia/ },
  { nome: 'Leishmaniose', re: /leish/ },
  { nome: 'Coronavírus', re: /corona/ },
  { nome: POLIVALENTE, re: /polivalente|vanguard|recombitek|duramune|nobivac\s*dhpp|canigen|eurican|biocan|puppy\s*dp|multipla/ },
];

const RE_DATA = /(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{2,4})\b/g;
/** Fabricação e validade do frasco (no selo) não são datas da vacina do pet. */
const RE_FRASCO = /\b(fab|fabr|fabricacao|val|valid|validade|venc|vencimento|exp)\b\.?\s*:?\s*\d{1,2}\s?[/.-]\s?\d{1,2}(\s?[/.-]\s?\d{2,4})?/g;
const RE_LOTE = /\b(?:lote|partida|serie|serial|lot|ptd)\b\.?\s*(?:n[o°º.]*)?\s*:?\s*([a-z0-9][a-z0-9/-]{2,14})/;
const RE_REVAC = /revac|reforc|proxim|retorno|repetir/;

function dataISO(d: string, m: string, a: string): string | undefined {
  const ano = a.length === 2 ? 2000 + Number(a) : a.length === 4 ? Number(a) : NaN;
  const dia = Number(d), mes = Number(m);
  if (!(ano >= 2000 && ano <= 2100) || mes < 1 || mes > 12 || dia < 1) return undefined;
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (dt.getUTCDate() !== dia) return undefined;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Datas da linha (sem as do frasco), com a marca de revacinação quando a linha fala disso. */
function datasDaLinha(linha: string): { iso: string; revac: boolean }[] {
  const l = sem(linha).replace(RE_FRASCO, ' ');
  const revac = RE_REVAC.test(l);
  const out: { iso: string; revac: boolean }[] = [];
  for (const m of l.matchAll(RE_DATA)) {
    const iso = dataISO(m[1], m[2], m[3]);
    if (iso) out.push({ iso, revac });
  }
  return out;
}

const nomeDaLinha = (linha: string) => {
  const l = sem(linha);
  return VACINAS.find((v) => v.re.test(l))?.nome;
};

/**
 * Vacinas do texto da carteira. Cada linha com nome de vacina abre um bloco que vai até a próxima vacina
 * (no máximo 4 linhas depois): a primeira data até hoje é a aplicação e a seguinte, depois dela, a revacinação.
 * `existentes`: vacinas já registradas do pet (mesmo nome e data = "já registrada").
 */
export function vacinasDaCarteira(texto: string, hoje: string, existentes: Pick<Vacina, 'nome' | 'data'>[] = []): VacinaLida[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocos: { nome: string; linhas: string[] }[] = [];
  let atual: { nome: string; linhas: string[] } | undefined;
  for (const l of linhas) {
    const nome = nomeDaLinha(l);
    if (nome) {
      // Polivalente na linha seguinte ao "V10" é a marca da mesma vacina, não outra.
      if (atual && atual.linhas.length === 1 && (nome === POLIVALENTE || atual.nome === POLIVALENTE)) {
        if (atual.nome === POLIVALENTE) atual.nome = nome;
        atual.linhas.push(l);
        continue;
      }
      atual = { nome, linhas: [l] };
      blocos.push(atual);
    } else if (atual && atual.linhas.length < 5) {
      atual.linhas.push(l);
    }
  }

  const out: VacinaLida[] = [];
  for (const b of blocos) {
    const datas = b.linhas.flatMap(datasDaLinha);
    const aplic = datas.find((d) => !d.revac && d.iso <= hoje) ?? datas.find((d) => d.iso <= hoje);
    const depois = datas.filter((d) => aplic && d.iso > aplic.iso);
    const proxima = (depois.find((d) => d.revac) ?? depois[0])?.iso;
    const lote = b.linhas.map((l) => RE_LOTE.exec(sem(l))?.[1]).find(Boolean)?.toUpperCase();
    const item: VacinaLida = { nome: b.nome, trecho: b.linhas.join(' · ').slice(0, 140) };
    if (aplic) item.data = aplic.iso;
    if (proxima) item.proxima = proxima;
    if (lote) item.lote = lote;
    // A mesma vacina e data duas vezes (selo e anotação): fica uma.
    if (out.some((o) => o.nome === item.nome && o.data === item.data)) continue;
    if (item.data && existentes.some((v) => sem(v.nome) === sem(item.nome) && v.data === item.data)) item.jaRegistrada = true;
    out.push(item);
  }
  // Mais antiga primeiro, como na carteira; sem data no fim.
  return out.sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'));
}
