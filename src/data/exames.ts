// Filtro da lista de exames (celular e computador): busca, pessoa, tipo, período e ordem.
import type { CategoriaExame, Exame } from './types';
import { addDias } from './format';

export type PeriodoExame = 'tudo' | '30d' | '6m' | '12m' | 'entre';
export type OrdemExame = 'recentes' | 'antigos' | 'nome';

export interface FiltroExames {
  busca: string;
  /** 'todos' ou o id da pessoa. */
  pessoa: string;
  /** 'todos' ou a categoria. */
  categoria: 'todos' | CategoriaExame;
  periodo: PeriodoExame;
  /** Só com `periodo: 'entre'`: datas ISO, cada uma opcional. */
  de?: string;
  ate?: string;
  ordem: OrdemExame;
}

export const FILTRO_EXAMES_PADRAO: FiltroExames = { busca: '', pessoa: 'todos', categoria: 'todos', periodo: 'tudo', ordem: 'recentes' };

export const PERIODOS_EXAME: { id: PeriodoExame; nome: string }[] = [
  { id: 'tudo', nome: 'Tudo' },
  { id: '30d', nome: 'Últimos 30 dias' },
  { id: '6m', nome: 'Últimos 6 meses' },
  { id: '12m', nome: 'Último ano' },
  { id: 'entre', nome: 'Escolher datas' },
];

export const ORDENS_EXAME: { id: OrdemExame; nome: string }[] = [
  { id: 'recentes', nome: 'Mais recentes' },
  { id: 'antigos', nome: 'Mais antigos' },
  { id: 'nome', nome: 'Nome (A–Z)' },
];

/** Primeiro dia que entra no período (ISO), ou undefined quando não há limite inicial. */
export function inicioDoPeriodo(f: Pick<FiltroExames, 'periodo' | 'de'>, hoje: string): string | undefined {
  if (f.periodo === '30d') return addDias(hoje, -30);
  if (f.periodo === '6m') return addDias(hoje, -182);
  if (f.periodo === '12m') return addDias(hoje, -365);
  if (f.periodo === 'entre') return f.de;
  return undefined;
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Aplica o filtro e a ordem. `nomePessoa` entra na busca ("roberto" acha os exames dele). */
export function filtrarExames(exames: Exame[], f: FiltroExames, hoje: string, nomePessoa: (id: string) => string): Exame[] {
  const q = sem(f.busca.trim());
  const ini = inicioDoPeriodo(f, hoje);
  const fim = f.periodo === 'entre' ? f.ate : undefined;
  const lista = exames.filter((e) =>
    (f.pessoa === 'todos' || e.pessoaId === f.pessoa)
    && (f.categoria === 'todos' || e.categoria === f.categoria)
    && (!ini || e.dataColeta >= ini)
    && (!fim || e.dataColeta <= fim)
    && (!q || [e.nome, e.laboratorio, e.solicitante, e.categoria, nomePessoa(e.pessoaId)].some((t) => t && sem(t).includes(q))));
  return lista.sort((a, b) => {
    if (f.ordem === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR') || b.dataColeta.localeCompare(a.dataColeta);
    const d = a.dataColeta.localeCompare(b.dataColeta);
    return f.ordem === 'antigos' ? d : -d;
  });
}

/** Quantos filtros estão ligados (além da busca): para o selo do botão "Filtrar". */
export function filtrosAtivos(f: FiltroExames): number {
  return Number(f.pessoa !== 'todos') + Number(f.categoria !== 'todos') + Number(f.periodo !== 'tudo') + Number(f.ordem !== 'recentes');
}

/**
 * O filtro que vale para esta lista: a pessoa escolhida sai do filtro quando não há exame dela na lista
 * (no celular, ao trocar para o perfil de outra pessoa; ou se ela saiu da família).
 */
export function filtroValido(f: FiltroExames, exames: Pick<Exame, 'pessoaId'>[]): FiltroExames {
  return f.pessoa === 'todos' || exames.some((e) => e.pessoaId === f.pessoa) ? f : { ...f, pessoa: 'todos' };
}
