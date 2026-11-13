import { describe, expect, it } from 'vitest';
import { colunasCartela, descricaoAparencia, estadosCartela, lerCartela } from './cartela';

const conta = (e: ReturnType<typeof estadosCartela>) => ({
  cheio: e.estados.filter((x) => x === 'cheio').length,
  metade: e.estados.filter((x) => x === 'metade').length,
  contorno: e.estados.filter((x) => x === 'contorno').length,
});

describe('estadosCartela', () => {
  it('a cartela aberta é o resto do estoque', () => {
    const e = estadosCartela(31, 14);
    expect(conta(e)).toEqual({ cheio: 3, metade: 0, contorno: 11 });
    expect(e.fechadas).toBe(2);
    expect(e.estados.slice(0, 11).every((x) => x === 'contorno')).toBe(true);
  });
  it('meio comprimido vira metade, logo depois das tomadas', () => {
    const e = estadosCartela(20.5, 14);
    expect(conta(e)).toEqual({ cheio: 6, metade: 1, contorno: 7 });
    expect(e.estados[7]).toBe('metade');
    expect(e.resto).toBe(6.5);
    expect(e.fechadas).toBe(1);
  });
  it('múltiplo exato = cartela cheia; zero = toda vazia', () => {
    expect(conta(estadosCartela(28, 14))).toEqual({ cheio: 14, metade: 0, contorno: 0 });
    expect(estadosCartela(28, 14).fechadas).toBe(1);
    expect(conta(estadosCartela(0, 10))).toEqual({ cheio: 0, metade: 0, contorno: 10 });
    expect(conta(estadosCartela(0.5, 10))).toEqual({ cheio: 0, metade: 1, contorno: 9 });
  });
});

describe('cartela no formulário', () => {
  it('lerCartela valida os números', () => {
    expect(lerCartela('14', '2')).toEqual({ porCartela: 14, fileiras: 2 });
    expect(lerCartela('30', '')).toEqual({ porCartela: 30, fileiras: 1 });
    expect(lerCartela('', '2')).toBeUndefined();
    expect(lerCartela('10', '20')).toBeUndefined();
    expect(lerCartela('7,5', '1')).toBeUndefined();
  });
  it('colunas e descrição', () => {
    expect(colunasCartela({ porCartela: 14, fileiras: 2 })).toBe(7);
    expect(colunasCartela({ porCartela: 10, fileiras: 3 })).toBe(4);
    expect(descricaoAparencia({ forma: 'redondo', cor: 'branco', sulco: true })).toBe('Redondo, branco, com sulco');
    expect(descricaoAparencia({ forma: 'capsula', cor: 'azul', cor2: 'branco', sulco: true })).toBe('Cápsula, azul e branco');
  });
});
