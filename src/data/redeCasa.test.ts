import { describe, expect, it } from 'vitest';
import { estaEmCasa } from './redeCasa';

const casa = { id: 'a'.repeat(64), nome: 'Casa Almeida' };
const sitio = { id: 'b'.repeat(64), nome: 'Sítio' };

describe('estaEmCasa', () => {
  it('em casa quando a rede atual está na lista', () => {
    expect(estaEmCasa(casa, [casa])).toBe(true);
    expect(estaEmCasa({ id: sitio.id, nome: 'outro nome' }, [casa, sitio])).toBe(true);
  });

  it('fora de casa em rede desconhecida', () => {
    expect(estaEmCasa({ id: 'c'.repeat(64), nome: 'Café' }, [casa, sitio])).toBe(false);
  });

  it('sem lista (desligado) ou sem rede atual, nunca em casa', () => {
    expect(estaEmCasa(casa, [])).toBe(false);
    expect(estaEmCasa(null, [casa])).toBe(false);
    expect(estaEmCasa(undefined, [casa])).toBe(false);
  });
});
