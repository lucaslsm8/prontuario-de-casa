import { describe, expect, it } from 'vitest';
import { FILTRO_EXAMES_PADRAO, filtrarExames, filtroValido, filtrosAtivos, inicioDoPeriodo, type FiltroExames } from './exames';
import type { Exame } from './types';

const ex = (id: string, pessoaId: string, nome: string, categoria: Exame['categoria'], dataColeta: string, laboratorio = 'Lab. Central'): Exame =>
  ({ id, pessoaId, nome, categoria, dataColeta, laboratorio, arquivo: 'PDF', paginas: 1 });

const EXAMES = [
  ex('a', 'helena', 'Hemograma completo', 'Sangue', '2026-02-18'),
  ex('b', 'helena', 'Mamografia', 'Imagem', '2026-02-18', 'Imagem Diagnóstica Sul'),
  ex('c', 'roberto', 'Ressonância do joelho', 'Imagem', '2026-10-01', 'Clínica Ortopédica'),
  ex('d', 'roberto', 'Perfil lipídico', 'Sangue', '2025-09-12'),
  ex('e', 'helena', 'TSH e T4 livre', 'Sangue', '2026-06-03'),
];
const HOJE = '2026-10-28';
const nome = (id: string) => ({ helena: 'Helena', roberto: 'Roberto' }[id] ?? '');
const f = (p: Partial<FiltroExames>) => ({ ...FILTRO_EXAMES_PADRAO, ...p });
const ids = (p: Partial<FiltroExames>) => filtrarExames(EXAMES, f(p), HOJE, nome).map((e) => e.id);

describe('filtrarExames', () => {
  it('sem filtro: todos, mais recentes primeiro', () => {
    expect(ids({})).toEqual(['c', 'e', 'a', 'b', 'd']);
  });
  it('ordem: mais antigos e por nome', () => {
    expect(ids({ ordem: 'antigos' })).toEqual(['d', 'a', 'b', 'e', 'c']);
    expect(ids({ ordem: 'nome' })).toEqual(['a', 'b', 'd', 'c', 'e']);
  });
  it('por pessoa e por tipo, juntos', () => {
    expect(ids({ pessoa: 'roberto' })).toEqual(['c', 'd']);
    expect(ids({ pessoa: 'helena', categoria: 'Imagem' })).toEqual(['b']);
  });
  it('períodos prontos contam a partir de hoje', () => {
    expect(ids({ periodo: '30d' })).toEqual(['c']);
    expect(ids({ periodo: '6m' })).toEqual(['c', 'e']);
    expect(ids({ periodo: '12m' })).toEqual(['c', 'e', 'a', 'b']);
  });
  it('entre datas: cada ponta é opcional e inclusiva', () => {
    expect(ids({ periodo: 'entre', de: '2026-02-18', ate: '2026-06-03' })).toEqual(['e', 'a', 'b']);
    expect(ids({ periodo: 'entre', ate: '2026-01-01' })).toEqual(['d']);
    expect(ids({ periodo: 'entre' })).toHaveLength(5);
  });
  it('busca sem acento em nome, laboratório, tipo e pessoa', () => {
    expect(ids({ busca: 'ressonancia' })).toEqual(['c']);
    expect(ids({ busca: 'ortopédica' })).toEqual(['c']);
    expect(ids({ busca: 'roberto' })).toEqual(['c', 'd']);
    expect(ids({ busca: 'imagem' })).toEqual(['c', 'b']);
  });
});

describe('inicioDoPeriodo e filtrosAtivos', () => {
  it('início de cada período', () => {
    expect(inicioDoPeriodo({ periodo: 'tudo' }, HOJE)).toBeUndefined();
    expect(inicioDoPeriodo({ periodo: '30d' }, HOJE)).toBe('2026-09-28');
    expect(inicioDoPeriodo({ periodo: 'entre', de: '2026-01-01' }, HOJE)).toBe('2026-01-01');
  });
  it('conta só o que difere do padrão (a busca não conta)', () => {
    expect(filtrosAtivos(f({ busca: 'x' }))).toBe(0);
    expect(filtrosAtivos(f({ pessoa: 'helena', periodo: '6m', ordem: 'nome' }))).toBe(3);
  });
});

describe('filtroValido', () => {
  it('tira a pessoa do filtro quando ela não tem exame na lista', () => {
    expect(filtroValido(f({ pessoa: 'roberto' }), EXAMES).pessoa).toBe('roberto');
    expect(filtroValido(f({ pessoa: 'roberto', categoria: 'Sangue' }), EXAMES.filter((e) => e.pessoaId === 'helena'))).toEqual(f({ categoria: 'Sangue' }));
  });
});
