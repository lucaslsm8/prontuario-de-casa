// Aviso de alergia ao cadastrar um remédio: o nome bate com uma alergia da pessoa,
// direto ("Dipirona" × "dipirona") ou pela família do remédio ("Amoxicilina" × "penicilina").
// Função pura, testada em alergias.test.ts. É um lembrete, não um checador de interações.

import type { Alergia } from './types';

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Família (como as pessoas costumam escrever a alergia) → remédios que pertencem a ela. */
const FAMILIAS: { nomes: string[]; remedios: string[]; rotulo: string }[] = [
  { nomes: ['penicilina', 'penicilinas', 'betalactamico', 'beta-lactamico'], remedios: ['amoxicilina', 'ampicilina', 'penicilina', 'benzetacil', 'oxacilina', 'piperacilina', 'clavulanato'], rotulo: 'penicilinas' },
  { nomes: ['cefalosporina', 'cefalosporinas'], remedios: ['cefalexina', 'cefadroxil', 'ceftriaxona', 'cefuroxima', 'cefazolina', 'cefepima'], rotulo: 'cefalosporinas' },
  { nomes: ['sulfa', 'sulfas', 'sulfonamida'], remedios: ['sulfametoxazol', 'bactrim', 'sulfadiazina', 'sulfassalazina'], rotulo: 'sulfas' },
  { nomes: ['aas', 'aspirina', 'acido acetilsalicilico'], remedios: ['aas', 'aspirina', 'acido acetilsalicilico', 'melhoral', 'doril'], rotulo: 'AAS' },
  { nomes: ['dipirona', 'metamizol', 'novalgina'], remedios: ['dipirona', 'metamizol', 'novalgina', 'anador', 'lisador', 'buscopan composto'], rotulo: 'dipirona' },
  { nomes: ['anti-inflamatorio', 'anti-inflamatorios', 'antiinflamatorio', 'aine', 'aines'], remedios: ['ibuprofeno', 'diclofenaco', 'nimesulida', 'cetoprofeno', 'naproxeno', 'meloxicam', 'piroxicam', 'celecoxibe', 'aas', 'aspirina'], rotulo: 'anti-inflamatórios' },
  { nomes: ['ibuprofeno'], remedios: ['ibuprofeno', 'advil', 'alivium'], rotulo: 'ibuprofeno' },
  { nomes: ['iodo', 'contraste iodado'], remedios: ['contraste', 'iodo', 'povidine'], rotulo: 'iodo' },
  { nomes: ['codeina', 'opioide', 'opioides'], remedios: ['codeina', 'tramadol', 'morfina', 'oxicodona', 'tylex'], rotulo: 'opioides' },
];

export interface AvisoAlergia { alergia: Alergia; porFamilia?: string }

/** Alergias da pessoa que batem com o nome do remédio. Vazio = nada a avisar. */
export function alergiasDoRemedio(nomeRemedio: string, alergias: Alergia[]): AvisoAlergia[] {
  const nome = sem(nomeRemedio);
  if (nome.length < 3) return [];
  const out: AvisoAlergia[] = [];
  for (const a of alergias) {
    const sub = sem(a.substancia);
    if (sub.length < 3) continue;
    // Direto: o nome do remédio contém a substância, ou o primeiro nome do remédio está na alergia.
    const primeiro = nome.split(/\s+/)[0];
    if (nome.includes(sub) || (primeiro.length >= 4 && sub.includes(primeiro))) { out.push({ alergia: a }); continue; }
    const fam = FAMILIAS.find((f) => f.nomes.some((n) => sub.includes(n)));
    if (fam && fam.remedios.some((r) => nome.includes(r))) out.push({ alergia: a, porFamilia: fam.rotulo });
  }
  return out;
}

/** "Alergia a Penicilina (urticária) · Amoxicilina é da família das penicilinas." */
export function textoAvisoAlergia(av: AvisoAlergia, nomeRemedio: string) {
  const r = av.alergia.reacao ? ` (${av.alergia.reacao})` : '';
  const base = `Alergia a ${av.alergia.substancia}${r}`;
  return av.porFamilia ? `${base} · ${nomeRemedio.trim().split(/\s+/)[0]} é da família das ${av.porFamilia}.` : `${base}.`;
}
