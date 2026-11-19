import { describe, expect, it } from 'vitest';
import { calendarioSUS, curvaAltura, ehCrianca, idadeMeses, medianaAltura, pendenciasSUS, textoIdade } from './criancas';
import type { Medicao } from './types';

describe('idade e mediana', () => {
  it('meses completos', () => {
    expect(idadeMeses('2020-05-10', '2020-07-09')).toBe(1);
    expect(idadeMeses('2020-05-10', '2020-07-10')).toBe(2);
    expect(idadeMeses('2014-03-01', '2026-11-19')).toBe(152);
  });
  it('criança: pessoa com menos de 18 anos', () => {
    expect(ehCrianca({ nascimento: '2014-03-01' }, '2026-11-19')).toBe(true);
    expect(ehCrianca({ nascimento: '2000-03-01' }, '2026-11-19')).toBe(false);
    expect(ehCrianca({ nascimento: '2024-03-01', tipo: 'pet' }, '2026-11-19')).toBe(false);
  });
  it('mediana interpolada entre os anos', () => {
    expect(medianaAltura('Masculino', 0)).toBe(49.9);
    expect(medianaAltura('Feminino', 60)).toBe(109.4);
    expect(medianaAltura('Masculino', 66)).toBe(113);
    expect(medianaAltura(undefined, 24)).toBeUndefined();
  });
  it('curva: altura em cm e a mediana nas mesmas datas', () => {
    const ms: Medicao[] = [
      { id: 'a', pessoaId: 'p', tipo: 'altura', data: '2026-01-10', valor: 1.5 },
      { id: 'b', pessoaId: 'p', tipo: 'altura', data: '2025-01-10', valor: 1.44 },
      { id: 'c', pessoaId: 'p', tipo: 'peso', data: '2025-01-10', valor: 40 },
    ];
    const c = curvaAltura({ id: 'p', sexo: 'Masculino', nascimento: '2014-01-10' }, ms);
    expect(c.crianca).toEqual([{ data: '2025-01-10', valor: 144 }, { data: '2026-01-10', valor: 150 }]);
    expect(c.mediana[0]).toEqual({ data: '2025-01-10', valor: 143.1 });
    expect(c.mediana[c.mediana.length - 1]).toEqual({ data: '2026-01-10', valor: 149.1 });
    expect(c.mediana).toHaveLength(13);
  });
});

describe('calendário do SUS', () => {
  it('textos de idade', () => {
    expect(textoIdade(0)).toBe('Ao nascer');
    expect(textoIdade(15)).toBe('1 ano e 3 meses');
    expect(textoIdade(48)).toBe('4 anos');
  });
  it('doses preenchidas na ordem; atrasadas e da idade', () => {
    const vac = [
      { nome: 'BCG', data: '2026-01-02' },
      { nome: 'Hepatite B', data: '2026-01-02' },
      { nome: 'Penta', data: '2026-03-05' },
      { nome: 'VIP', data: '2026-03-05' },
      { nome: 'Pneumo 10', data: '2026-03-05' },
    ];
    // Nasceu em 01/01/2026; em 19/06/2026 tem 5 meses.
    const c = calendarioSUS('2026-01-01', vac, '2026-06-19');
    const est = (k: string) => c.find((i) => i.chave === k)?.estado;
    expect(est('bcg-0')).toBe('feita');
    expect(est('penta-0')).toBe('feita');
    expect(est('rota-0')).toBe('atrasada');
    expect(est('penta-1')).toBe('agora');
    expect(est('menc-1')).toBe('agora');
    expect(est('penta-2')).toBe('depois');
    expect(pendenciasSUS(c).atrasadas).toBeGreaterThan(0);
  });
  it('tetra viral vale para tríplice viral e varicela; penta não vira DTP', () => {
    const vac = [{ nome: 'Tríplice viral', data: '2027-01-02' }, { nome: 'Tetra viral', data: '2027-04-02' }, { nome: 'Pentavalente', data: '2026-03-01' }];
    const c = calendarioSUS('2026-01-01', vac, '2027-05-01');
    expect(c.find((i) => i.chave === 'scr-1')?.data).toBe('2027-04-02');
    expect(c.find((i) => i.chave === 'varicela-0')?.data).toBe('2027-04-02');
    expect(c.find((i) => i.chave === 'dtp-0')?.estado).toBe('agora');
  });
});
