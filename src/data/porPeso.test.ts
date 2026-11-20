import { describe, expect, it } from 'vitest';
import { avisoPeso, contaPorPeso, dosePorPeso } from './porPeso';

describe('dose por peso', () => {
  it('comprimido arredonda em ¼', () => {
    // 5 mg/kg × 19 kg = 95 mg; comprimido de 50 mg = 1,9 → 2.
    expect(dosePorPeso(5, 19, 50, 'comprimido')).toEqual({ mg: 95, exata: 1.9, qtd: 2 });
    // 2 mg/kg × 8 kg = 16 mg; comprimido de 25 mg = 0,64 → ¾.
    expect(dosePorPeso(2, 8, 25, 'comprimido')?.qtd).toBe(0.75);
  });
  it('mL em 0,1 e gotas inteiras; nunca zero', () => {
    expect(dosePorPeso(10, 4.2, 50, 'ml')?.qtd).toBe(0.8);
    expect(dosePorPeso(1, 3, 0.5, 'gota')?.qtd).toBe(6);
    expect(dosePorPeso(0.1, 1, 100, 'comprimido')?.qtd).toBe(0.25);
  });
  it('dados faltando', () => {
    expect(dosePorPeso(0, 10, 50, 'comprimido')).toBeUndefined();
    expect(dosePorPeso(5, 10, NaN, 'comprimido')).toBeUndefined();
  });
  it('aviso quando o peso muda mais de 10%', () => {
    const r = { ativo: true, porPeso: { mgKg: 5, kg: 19 } };
    expect(avisoPeso(r, 20)).toBe('');
    expect(avisoPeso(r, 21.5)).toBe('Dose calculada para 19 kg; hoje são 21,5 kg. Confira a dose com quem receitou.');
    expect(avisoPeso({ ...r, ativo: false }, 30)).toBe('');
    expect(contaPorPeso({ mgKg: 2.5, kg: 8 })).toBe('2,5 mg/kg × 8 kg = 20 mg');
  });
});
