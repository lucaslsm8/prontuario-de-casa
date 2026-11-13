// Simulador de reembolso do plano de saúde (pedido em 13/11/2026). Funções puras, testadas em reembolso.test.ts.
//
// O reembolso no Brasil não é uma porcentagem: cada operadora tem uma tabela com o valor máximo por serviço,
// e cada produto (plano) cai numa "grade" dessa tabela. Reembolso = o menor entre o que você pagou e o valor
// da tabela para a sua grade (a coparticipação pode descontar).
//
// A tabela fica DENTRO do app (o app é offline; nada é consultado na hora). Fonte:
// "Exemplos de Reembolso – SulAmérica Saúde – Reembolso em reais – Modular – PME – 26/08/2026" (portal SulAmérica)
// e "Tabela de Reembolso SulAmérica (TRS) – Julho 2026" (grades 1 a 10). Serviço que não está na tabela
// (ex.: psicoterapia por psicólogo) a pessoa informa uma vez o valor do plano dela, e fica guardado no plano.

import type { Plano } from './types';

export const FONTE_SULAMERICA = 'Exemplos de reembolso SulAmérica, ago/2026';

/** Produtos SulAmérica (Saúde PME) → grade de reembolso. As versões "Vital" e "Exato" caem na mesma grade. */
export const PRODUTOS_SULAMERICA: { nome: string; grade: number }[] = [
  { nome: 'Direto (enfermaria)', grade: 1 },
  { nome: 'Exato (enfermaria)', grade: 1 },
  { nome: 'Direto (apartamento)', grade: 2 },
  { nome: 'Exato (apartamento)', grade: 2 },
  { nome: 'Clássico 100', grade: 3 },
  { nome: 'Clássico Vital', grade: 3 },
  { nome: 'Especial 100 RC', grade: 4 },
  { nome: 'Especial Vital RC', grade: 4 },
  { nome: 'Especial 100 R1', grade: 5 },
  { nome: 'Especial Vital R1', grade: 5 },
  { nome: 'Especial Mais', grade: 6 },
  { nome: 'Especial Mais Vital', grade: 6 },
  { nome: 'Executivo R1', grade: 7 },
  { nome: 'Executivo R2', grade: 8 },
  { nome: 'Executivo R3', grade: 9 },
  { nome: 'Prestige', grade: 10 },
];

/** Serviço reembolsável. `valores[g-1]` = reembolso máximo na grade g (null = não reembolsa ou sem dado na tabela). */
export interface ServicoReembolso { chave: string; codigo?: string; nome: string; grupo: 'Consultas' | 'Terapias' | 'Exames' | 'Honorários'; busca: string[]; valores?: (number | null)[] }

const _ = null;
export const SERVICOS: ServicoReembolso[] = [
  { chave: '10101012', codigo: '10101012', nome: 'Consulta em consultório', grupo: 'Consultas', busca: ['consulta', 'medico', 'clinico', 'especialista', 'consultorio'],
    valores: [_, _, 112.62, 155.02, 185.65, 341.14, 500, 660, 880, 1100] },
  { chave: '10101039', codigo: '10101039', nome: 'Consulta em pronto-socorro', grupo: 'Consultas', busca: ['pronto socorro', 'ps', 'emergencia', 'urgencia'],
    valores: [91.94, 91.94, 112.62, 155.02, 185.65, 341.14, 500, 660, 880, 1100] },
  { chave: '50000470', codigo: '50000470', nome: 'Sessão de psicoterapia individual por psicólogo', grupo: 'Terapias', busca: ['psicologo', 'psicologa', 'psicoterapia', 'terapia', 'analise'] },
  { chave: 'fisioterapia', nome: 'Sessão de fisioterapia', grupo: 'Terapias', busca: ['fisioterapia', 'fisio', 'fisioterapeuta'] },
  { chave: 'fonoaudiologia', nome: 'Sessão de fonoaudiologia', grupo: 'Terapias', busca: ['fonoaudiologia', 'fono', 'fonoaudiologo'] },
  { chave: 'nutricao', nome: 'Consulta com nutricionista', grupo: 'Terapias', busca: ['nutricionista', 'nutricao', 'dieta'] },
  { chave: 'terapia-ocupacional', nome: 'Sessão de terapia ocupacional', grupo: 'Terapias', busca: ['terapia ocupacional', 'to', 'terapeuta ocupacional'] },
  { chave: 'acupuntura', nome: 'Sessão de acupuntura', grupo: 'Terapias', busca: ['acupuntura'] },
  { chave: '31309054', codigo: '31309054', nome: 'Parto cesariana (equipe médica)', grupo: 'Honorários', busca: ['cesariana', 'cesarea', 'parto'],
    valores: [_, _, _, _, 3249.08, 3249.08, 13262.45, 21791.4, 28255.11, 50810.08] },
  { chave: '31309127', codigo: '31309127', nome: 'Parto via vaginal (equipe médica)', grupo: 'Honorários', busca: ['parto normal', 'parto vaginal', 'parto'],
    valores: [_, _, _, _, 3379.21, 3379.21, 13782.99, 22572.24, 29296.2, 52762.13] },
  { chave: '30903025', codigo: '30903025', nome: 'Revascularização do miocárdio (equipe médica)', grupo: 'Honorários', busca: ['ponte de safena', 'revascularizacao', 'cirurgia cardiaca'],
    valores: [_, _, _, _, 9074.34, 9074.34, 38396.19, 59649.1, 79142.03, 144589.7] },
  { chave: '10103015', codigo: '10103015', nome: 'Atendimento ao recém-nascido em berçário', grupo: 'Honorários', busca: ['recem nascido', 'pediatra', 'bercario'],
    valores: [_, _, _, _, 333.96, 333.96, 768.12, 1382.61, 1590, 1987.51] },
  { chave: '10103023', codigo: '10103023', nome: 'Atendimento ao recém-nascido em sala de parto', grupo: 'Honorários', busca: ['recem nascido', 'pediatra', 'sala de parto'],
    valores: [_, _, _, _, 375.89, 375.89, 864.55, 1556.19, 1789.62, 2237.03] },
  { chave: '30205271', codigo: '30205271', nome: 'Adenoidectomia por videoendoscopia (equipe médica)', grupo: 'Honorários', busca: ['adenoide', 'adenoidectomia'],
    valores: [_, _, _, _, 569.89, 569.89, 1372, 2562.34, 2991.32, 3662.59] },
  { chave: '30715180', codigo: '30715180', nome: 'Hérnia de disco toracolombar (equipe médica)', grupo: 'Honorários', busca: ['hernia de disco', 'coluna'],
    valores: [_, _, _, _, 3734.1, 3734.1, 8850.92, 16329.16, 18969.8, 23384.1] },
  { chave: '30907136', codigo: '30907136', nome: 'Varizes, dois membros (equipe médica)', grupo: 'Honorários', busca: ['varizes'],
    valores: [_, _, _, _, 3094, 3094, 7378.72, 13679.16, 15922.29, 19574.74] },
  { chave: '31002340', codigo: '31002340', nome: 'Gastrectomia total por videolaparoscopia (equipe médica)', grupo: 'Honorários', busca: ['gastrectomia', 'estomago'],
    valores: [_, _, _, _, 3598.62, 3598.62, 15843.61, 25169.45, 33295.27, 59841.93] },
  { chave: '31003079', codigo: '31003079', nome: 'Apendicectomia (equipe médica)', grupo: 'Honorários', busca: ['apendicite', 'apendicectomia', 'apendice'],
    valores: [_, _, _, _, 1638.6, 1638.6, 7281, 11616.1, 15359.2, 27525.78] },
  { chave: '31004202', codigo: '31004202', nome: 'Hemorroidectomia (equipe médica)', grupo: 'Honorários', busca: ['hemorroida', 'hemorroidectomia'],
    valores: [_, _, _, _, 1026.24, 1026.24, 5094.8, 8078.42, 10782.06, 19802.86] },
  { chave: '31005101', codigo: '31005101', nome: 'Colecistectomia (vesícula) (equipe médica)', grupo: 'Honorários', busca: ['vesicula', 'colecistectomia'],
    valores: [_, _, _, _, 2273.49, 2273.49, 10060.06, 16026.1, 21192.15, 38010.78] },
  { chave: '31009336', codigo: '31009336', nome: 'Hérnia inguinal por videolaparoscopia (equipe médica)', grupo: 'Honorários', busca: ['hernia inguinal', 'hernia'],
    valores: [_, _, _, _, 1841.44, 1841.44, 4497.84, 8493.61, 9958.91, 12120.51] },
  { chave: '31206220', codigo: '31206220', nome: 'Postectomia (fimose) (equipe médica)', grupo: 'Honorários', busca: ['fimose', 'postectomia'],
    valores: [_, _, _, _, 875.84, 875.84, 3994.25, 6460.69, 8527.13, 15128.46] },
];

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Busca por nome, apelido ("psicólogo", "fisio") ou código TUSS. */
export function buscarServicos(q: string): ServicoReembolso[] {
  const t = sem(q);
  if (!t) return SERVICOS;
  // "psicólogo" não pode casar com o apelido "ps": só apelidos de 4+ letras valem como começo do que foi digitado.
  return SERVICOS.filter((s) => s.codigo?.startsWith(t) || sem(s.nome).includes(t) || s.busca.some((b) => b.includes(t) || (b.length >= 4 && t.startsWith(b))));
}

/** É SulAmérica? (a tabela embutida só vale para ela) */
export const ehSulAmerica = (p?: Pick<Plano, 'operadora'>) => !!p && sem(p.operadora).replace(/\s+/g, '').includes('sulamerica');

/** Grade do plano: a escolhida, ou a do produto pelo nome ("Especial 100 R1"). */
export function gradeDoPlano(p?: Pick<Plano, 'operadora' | 'produto' | 'reembolso'>): number | undefined {
  if (!p) return undefined;
  if (p.reembolso?.grade) return p.reembolso.grade;
  if (!ehSulAmerica(p)) return undefined;
  const prod = sem(p.produto);
  // O nome mais longo primeiro: "Especial Mais Vital" antes de "Especial Mais".
  const achado = [...PRODUTOS_SULAMERICA].sort((a, b) => b.nome.length - a.nome.length).find((x) => prod.includes(sem(x.nome.replace(/ \(.*\)$/, ''))));
  return achado?.grade;
}

export type OrigemValor = 'tabela' | 'plano';
/** Quanto o plano reembolsa por esse serviço: o valor que a pessoa informou, ou o da tabela pela grade. */
export function tetoReembolso(s: ServicoReembolso, p?: Pick<Plano, 'operadora' | 'produto' | 'reembolso'>): { valor?: number; origem?: OrigemValor; grade?: number } {
  const informado = p?.reembolso?.valores?.[s.chave];
  if (informado != null) return { valor: informado, origem: 'plano' };
  const grade = gradeDoPlano(p);
  const daTabela = grade && ehSulAmerica(p) ? s.valores?.[grade - 1] : undefined;
  return daTabela != null ? { valor: daTabela, origem: 'tabela', grade } : { grade };
}

/** O que volta: o menor entre o que pagou e o teto. */
export function simular(pago: number, teto: number) {
  const reembolso = Math.round(Math.min(Math.max(0, pago), Math.max(0, teto)) * 100) / 100;
  return { reembolso, porConta: Math.round((Math.max(0, pago) - reembolso) * 100) / 100, pct: pago > 0 ? Math.round((reembolso / pago) * 100) : 0 };
}

/** "R$ 1.240,00" */
export const reais = (n: number) => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
/** "1.240,50" / "300" / "R$ 300" → número. */
export function lerReais(t: string): number | undefined {
  const s = t.replace(/[R$\s]/g, '').trim();
  if (!s) return undefined;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
