import { describe, expect, it } from 'vitest';
import { anosComDespesa, csvIR, dedutivel, mascararDocumento, resumoIR, semDocumento, tipoDocumento } from './despesas';
import type { Despesa, Pessoa } from './types';

const p = (id: string, tipo?: Pessoa['tipo']): Pessoa => ({ id, nome: `${id} Almeida`, curto: id, cor: '#ccc', alergias: [], condicoes: [], tipo });
const d = (o: Partial<Despesa>): Despesa => ({ id: Math.random().toString(36), pessoaId: 'helena', data: '2026-03-10', valor: 100, tipo: 'consulta', prestador: 'Dra. Marta', ...o });

describe('documento', () => {
  it('máscara de CPF e CNPJ', () => {
    expect(mascararDocumento('52998224725')).toBe('529.982.247-25');
    expect(mascararDocumento('5299')).toBe('529.9');
    expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('dígitos verificadores', () => {
    expect(tipoDocumento('529.982.247-25')).toBe('cpf');
    expect(tipoDocumento('529.982.247-26')).toBeUndefined();
    expect(tipoDocumento('111.111.111-11')).toBeUndefined();
    expect(tipoDocumento('11.222.333/0001-81')).toBe('cnpj');
    expect(tipoDocumento('11.222.333/0001-80')).toBeUndefined();
  });
});

describe('resumoIR', () => {
  const pessoas = [p('helena'), p('mel', 'pet')];
  const lista = [
    d({ valor: 450, reembolso: 180, documento: '52998224725' }),
    d({ valor: 450, data: '2026-06-01', documento: '529.982.247-25', prestador: 'Dra Marta Lins' }),
    d({ valor: 89.9, tipo: 'remedio', prestador: 'Farmácia' }),
    d({ valor: 300, tipo: 'exame', prestador: 'Lab. Central' }),
    d({ valor: 200, data: '2025-12-30' }),
    d({ pessoaId: 'mel', valor: 250, prestador: 'Vet' }),
  ];
  it('junta pelo CPF, desconta o reembolso e deixa remédio e pet fora', () => {
    const r = resumoIR(lista, pessoas, 2026);
    expect(r).toHaveLength(2);
    const h = r[0];
    expect(h).toMatchObject({ pessoaId: 'helena', pago: 1289.9, reembolsado: 180, dedutivel: 1020, naoDedutivel: 89.9 });
    expect(h.linhas).toEqual([
      { pessoaId: 'helena', prestador: 'Dra. Marta', documento: '529.982.247-25', tipo: 'consulta', pago: 900, reembolsado: 180, qtd: 2 },
      { pessoaId: 'helena', prestador: 'Lab. Central', documento: undefined, tipo: 'exame', pago: 300, reembolsado: 0, qtd: 1 },
    ]);
    expect(r[1]).toMatchObject({ pessoaId: 'mel', dedutivel: 0, naoDedutivel: 250, linhas: [] });
    expect(semDocumento(r).map((l) => l.prestador)).toEqual(['Lab. Central']);
  });
  it('dedutível e anos', () => {
    expect(dedutivel({ tipo: 'terapia' })).toBe(true);
    expect(dedutivel({ tipo: 'consulta' }, { tipo: 'pet' })).toBe(false);
    expect(anosComDespesa(lista, '2026-11-19')).toEqual([2026, 2025]);
  });
  it('CSV com ponto e vírgula e vírgula decimal', () => {
    const csv = csvIR(resumoIR(lista, pessoas, 2026), pessoas, 2026).split('\r\n');
    expect(csv[0]).toBe('Ano;Pessoa;Prestador;CPF/CNPJ;Tipo;Valor pago;Reembolsado;Parcela dedutível;Pagamentos');
    expect(csv[1]).toBe('2026;helena Almeida;Dra. Marta;529.982.247-25;Consulta médica;900,00;180,00;720,00;2');
  });
});
