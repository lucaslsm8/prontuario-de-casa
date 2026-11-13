// Hierarquia da família: responsável, administrador e cuidador (pedido em 13/11/2026).
// Funções puras, testadas em papeis.test.ts.
//
// - Responsável: campo da ficha (`Pessoa.responsavelId`), em branco = ninguém. Edita tudo da pessoa
//   e decide os pedidos por ela (para o dependente sem aparelho).
// - Administrador: pediu e foi aceito. Vê e edita tudo da pessoa.
// - Cuidador: pediu e foi aceito. Vê tudo e marca Tomei/Pular; não cadastra nem edita.
// - Família (sem papel): vê o que a pessoa compartilha; não edita.
// Pets são da casa: todo mundo vê e edita.

import type { Pessoa, PessoaId } from './types';

export type NivelPapel = 'cuidador' | 'administrador';
/** Papel de `para` sobre `de`. `pedido`: aguardando `de` (ou o responsável dele) aceitar. */
export interface Papel { de: PessoaId; para: PessoaId; aceito?: NivelPapel; pedido?: NivelPapel }
export type Nivel = 'voce' | 'responsavel' | NivelPapel;

interface Base { pessoas: Pessoa[]; papeis: Papel[] }

export const NOME_NIVEL: Record<NivelPapel | 'responsavel', string> = { responsavel: 'Responsável', administrador: 'Administrador', cuidador: 'Cuidador' };

const ehPet = (s: Base, id: PessoaId) => s.pessoas.find((p) => p.id === id)?.tipo === 'pet';
export const responsavelDe = (s: Base, id: PessoaId) => s.pessoas.find((p) => p.id === id)?.responsavelId;

/** O que `quem` é de `pessoaId`: você mesmo, responsável, administrador, cuidador ou nada. */
export function nivel(s: Base, quem: PessoaId | undefined, pessoaId: PessoaId): Nivel | undefined {
  if (!quem) return undefined;
  if (quem === pessoaId) return 'voce';
  if (responsavelDe(s, pessoaId) === quem) return 'responsavel';
  return s.papeis.find((p) => p.de === pessoaId && p.para === quem)?.aceito;
}

/** Cadastra, edita e apaga registros da pessoa. */
export function podeEditar(s: Base, quem: PessoaId | undefined, pessoaId: PessoaId) {
  if (!quem) return false;
  if (ehPet(s, pessoaId)) return true;
  const n = nivel(s, quem, pessoaId);
  return n === 'voce' || n === 'responsavel' || n === 'administrador';
}

/** Marca Tomei/Pular nas doses da pessoa (o cuidador também). */
export const podeMarcarDose = (s: Base, quem: PessoaId | undefined, pessoaId: PessoaId) =>
  podeEditar(s, quem, pessoaId) || nivel(s, quem, pessoaId) === 'cuidador';

/** Vê tudo da pessoa, mesmo o que ela não compartilha com a família. */
export const veTudo = podeMarcarDose;

/** Aceita ou recusa pedidos e tira papéis: a própria pessoa ou o responsável dela. */
export const podeDecidir = (s: Base, quem: PessoaId | undefined, pessoaId: PessoaId) =>
  !!quem && (quem === pessoaId || responsavelDe(s, pessoaId) === quem);

/** Quem aparece no Início de `quem`: ele mesmo, os pets e as pessoas de quem ele cuida (qualquer papel). */
export const noMeuCuidado = (s: Base, quem: PessoaId | undefined, pessoaId: PessoaId) =>
  ehPet(s, pessoaId) || podeMarcarDose(s, quem, pessoaId);

/** Pedidos que `quem` pode responder (para ele mesmo ou para quem ele é responsável). */
export const pedidosParaMim = (s: Base, quem: PessoaId | undefined) =>
  s.papeis.filter((p) => p.pedido && podeDecidir(s, quem, p.de));

/** Quem tem papel sobre a pessoa (responsável primeiro), para a ficha. */
export function papeisDaPessoa(s: Base, pessoaId: PessoaId): { quem: PessoaId; nivel: NivelPapel | 'responsavel' }[] {
  const r = responsavelDe(s, pessoaId);
  const out: { quem: PessoaId; nivel: NivelPapel | 'responsavel' }[] = r ? [{ quem: r, nivel: 'responsavel' }] : [];
  for (const p of s.papeis) if (p.de === pessoaId && p.aceito && p.para !== r) out.push({ quem: p.para, nivel: p.aceito });
  return out;
}

// ── Eventos ─────────────────────────────────────────────────────────────────
// `por` é o autor do evento (vem do log, não dos dados). Pedido de quem não pode é ignorado.

export function pedirPapel(s: Base, a: { de: PessoaId; para: PessoaId; papel: NivelPapel; por?: PessoaId }): Papel[] {
  if (a.por !== a.para || a.de === a.para || ehPet(s, a.de) || ehPet(s, a.para)) return s.papeis;
  if (!s.pessoas.some((p) => p.id === a.de) || !s.pessoas.some((p) => p.id === a.para)) return s.papeis;
  const atual = s.papeis.find((p) => p.de === a.de && p.para === a.para);
  if (atual?.aceito === a.papel) return s.papeis;
  const novo: Papel = { de: a.de, para: a.para, aceito: atual?.aceito, pedido: a.papel };
  return [...s.papeis.filter((p) => p !== atual), limpar(novo)];
}

export function responderPapel(s: Base, a: { de: PessoaId; para: PessoaId; aceitar: boolean; por?: PessoaId }): Papel[] {
  const atual = s.papeis.find((p) => p.de === a.de && p.para === a.para);
  if (!atual?.pedido || !podeDecidir(s, a.por, a.de)) return s.papeis;
  const novo: Papel = a.aceitar ? { de: a.de, para: a.para, aceito: atual.pedido } : { ...atual, pedido: undefined };
  const resto = s.papeis.filter((p) => p !== atual);
  return novo.aceito || novo.pedido ? [...resto, limpar(novo)] : resto;
}

/** Tira o papel (a pessoa ou o responsável) ou deixa de ter (o próprio cuidador/administrador); cancela pedido também. */
export function removerPapel(s: Base, a: { de: PessoaId; para: PessoaId; por?: PessoaId }): Papel[] {
  if (a.por !== a.para && !podeDecidir(s, a.por, a.de)) return s.papeis;
  return s.papeis.filter((p) => !(p.de === a.de && p.para === a.para));
}

/** Trocar o responsável: a própria pessoa, o responsável atual, ou qualquer um da família se está em branco. */
export function podeMudarResponsavel(s: Base, quem: PessoaId | undefined, pessoaId: PessoaId) {
  if (!quem || ehPet(s, pessoaId)) return false;
  const r = responsavelDe(s, pessoaId);
  return quem === pessoaId || r === quem || !r;
}

function limpar(p: Papel): Papel {
  const o: Papel = { de: p.de, para: p.para };
  if (p.aceito) o.aceito = p.aceito;
  if (p.pedido) o.pedido = p.pedido;
  return o;
}
