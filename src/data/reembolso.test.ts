import { describe, expect, it } from 'vitest';
import { buscarServicos, gradeDoPlano, lerReais, reais, simular, tetoReembolso, SERVICOS } from './reembolso';

const consulta = SERVICOS.find((s) => s.chave === '10101012')!;
const psico = SERVICOS.find((s) => s.chave === '50000470')!;
const plano = (produto: string, extra = {}) => ({ operadora: 'SulAmérica Saúde', produto, ...extra });

describe('reembolso', () => {
  it('acha o serviço pelo apelido ou código', () => {
    expect(buscarServicos('psicólogo')[0].codigo).toBe('50000470');
    expect(buscarServicos('fisio').map((s) => s.chave)).toContain('fisioterapia');
    expect(buscarServicos('10101012')[0].nome).toBe('Consulta em consultório');
    expect(buscarServicos('').length).toBe(SERVICOS.length);
  });
  it('grade pelo produto (o nome mais longo vence)', () => {
    expect(gradeDoPlano(plano('Especial 100 R1'))).toBe(5);
    expect(gradeDoPlano(plano('Especial Mais Vital'))).toBe(6);
    expect(gradeDoPlano(plano('Executivo R3 Apartamento'))).toBe(9);
    expect(gradeDoPlano(plano('Prestige'))).toBe(10);
    expect(gradeDoPlano({ operadora: 'Outra', produto: 'Prestige' })).toBeUndefined();
    expect(gradeDoPlano(plano('Qualquer', { reembolso: { grade: 7 } }))).toBe(7);
  });
  it('teto: valor informado pela pessoa vence a tabela', () => {
    expect(tetoReembolso(consulta, plano('Especial 100 R1'))).toEqual({ valor: 185.65, origem: 'tabela', grade: 5 });
    expect(tetoReembolso(psico, plano('Especial 100 R1'))).toEqual({ grade: 5 });
    expect(tetoReembolso(psico, plano('Especial 100 R1', { reembolso: { valores: { '50000470': 112 } } }))).toEqual({ valor: 112, origem: 'plano' });
    // Grade sem cobertura na tabela (consulta na grade 1): sem valor.
    expect(tetoReembolso(consulta, plano('Direto (enfermaria)')).valor).toBeUndefined();
  });
  it('simula: o menor entre o pago e o teto', () => {
    expect(simular(300, 185.65)).toEqual({ reembolso: 185.65, porConta: 114.35, pct: 62 });
    expect(simular(100, 185.65)).toEqual({ reembolso: 100, porConta: 0, pct: 100 });
  });
  it('lê e escreve reais', () => {
    expect(lerReais('R$ 1.240,50')).toBe(1240.5);
    expect(lerReais('300')).toBe(300);
    expect(lerReais('1.500')).toBe(1500);
    expect(lerReais('abc')).toBeUndefined();
    expect(reais(1240.5)).toBe('R$ 1.240,50');
    expect(reais(185.65)).toBe('R$ 185,65');
  });
});
