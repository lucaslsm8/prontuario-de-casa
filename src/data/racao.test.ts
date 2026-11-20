import { describe, expect, it } from 'vitest';
import { diasDoSaco, fimDoSaco, textoPorcao } from './racao';

describe('ração', () => {
  it('quanto dura o saco e quando acaba', () => {
    const r = { marca: 'X', gramasDia: 300, sacoKg: 15, abertoEm: '2026-11-01' };
    expect(diasDoSaco(r)).toBe(50);
    expect(fimDoSaco(r, '2026-11-19')).toEqual({ data: '2026-12-21', faltam: 32 });
    expect(fimDoSaco({ ...r, abertoEm: undefined }, '2026-11-19')).toBeUndefined();
    expect(diasDoSaco({ gramasDia: 300 })).toBeUndefined();
  });
  it('porção', () => {
    expect(textoPorcao({ gramasDia: 180, refeicoes: 2 })).toBe('180 g por dia em 2 refeições (90 g cada)');
    expect(textoPorcao({ gramasDia: 72.5 })).toBe('72,5 g por dia');
  });
});
