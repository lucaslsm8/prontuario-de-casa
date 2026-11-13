import { describe, expect, it } from 'vitest';
import { diasDeEstoque, mascararTelefone, qtdPorDose, textoEstoque } from './format';
import type { Remedio } from './types';

describe('mascararTelefone', () => {
  it('celular e fixo enquanto digita', () => {
    expect(mascararTelefone('2')).toBe('(2');
    expect(mascararTelefone('21')).toBe('(21');
    expect(mascararTelefone('2199')).toBe('(21) 99');
    expect(mascararTelefone('213456')).toBe('(21) 3456');
    expect(mascararTelefone('2134567')).toBe('(21) 3456-7');
    expect(mascararTelefone('2134567890')).toBe('(21) 3456-7890');
    expect(mascararTelefone('21991549211')).toBe('(21) 99154-9211');
  });
  it('reformata texto já mascarado e apaga tudo', () => {
    expect(mascararTelefone('(21) 99154-921')).toBe('(21) 9915-4921');
    expect(mascararTelefone('(21) 99154-9211')).toBe('(21) 99154-9211');
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('(')).toBe('');
  });
  it('0800 e 4004 (centrais) não viram DDD', () => {
    expect(mascararTelefone('0')).toBe('0');
    expect(mascararTelefone('08009')).toBe('0800 9');
    expect(mascararTelefone('08009700500')).toBe('0800 970 0500');
    expect(mascararTelefone('0800 970 0500')).toBe('0800 970 0500');
    expect(mascararTelefone('40')).toBe('40');
    expect(mascararTelefone('40045')).toBe('4004 5');
    expect(mascararTelefone('40045900')).toBe('4004 5900');
    expect(mascararTelefone('3003 1234')).toBe('3003 1234');
    expect(mascararTelefone('400459001')).toBe('400459001');
  });
  it('estrangeiro e número longo ficam como estão', () => {
    expect(mascararTelefone('+351 912 345 678')).toBe('+351 912 345 678');
    expect(mascararTelefone('0800 123 4567 99')).toBe('0800 123 4567 99');
  });
});

describe('quantidade por dose e dias de estoque', () => {
  const r = (dose: string, horarios: string[], estoque: number) => ({ id: 'r', pessoaId: 'a', nome: 'X', dose, doseLonga: dose, unidade: 'comprimidos', horarios, continuo: true, avisarDias: 3, lembrete: true, ativo: true, estoque }) as Remedio;
  it('lê a quantidade do texto da dose', () => {
    expect(qtdPorDose(r('2 comprimidos', [], 0))).toBe(2);
    expect(qtdPorDose(r('½ comprimido', [], 0))).toBe(0.5);
    expect(qtdPorDose(r('1/2 comprimido', [], 0))).toBe(0.5);
    expect(qtdPorDose(r('1½ comprimido', [], 0))).toBe(1.5);
    expect(qtdPorDose(r('1,5 comp.', [], 0))).toBe(1.5);
    expect(qtdPorDose(r('1 cápsula', [], 0))).toBe(1);
    expect(qtdPorDose(r('um pouco', [], 0))).toBe(1);
  });
  it('dias de estoque contam a dose', () => {
    expect(diasDeEstoque(r('2 comprimidos', ['08:00', '20:00'], 20))).toBe(5);
    expect(diasDeEstoque(r('½ comprimido', ['08:00'], 10))).toBe(20);
    expect(diasDeEstoque(r('1 comprimido', ['08:00', '20:00'], 21))).toBe(10);
  });
  it('estoque com meio comprimido', () => {
    expect(textoEstoque(r('½ comprimido', [], 20.5))).toBe('20,5 comprimidos');
  });
});
