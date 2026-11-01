import { describe, expect, it } from 'vitest';
import { fmtHlc, hlcValido, lerHlc, proximoHlc } from './hlc';

describe('HLC', () => {
  it('formata com zeros à esquerda e lê de volta (aparelho com hífen)', () => {
    const h = { ms: 1793480000000, c: 7, aparelho: 'pc-3f9a1c' };
    expect(fmtHlc(h)).toBe('1793480000000-0007-pc-3f9a1c');
    expect(lerHlc('1793480000000-0007-pc-3f9a1c')).toEqual(h);
  });
  it('avança com o relógio e conta dentro do mesmo milissegundo', () => {
    const a = proximoHlc(null, 1000, 'pc-a');
    expect(a).toEqual({ ms: 1000, c: 0, aparelho: 'pc-a' });
    expect(proximoHlc(a, 1000, 'pc-a')).toEqual({ ms: 1000, c: 1, aparelho: 'pc-a' });
    expect(proximoHlc(a, 2000, 'pc-a')).toEqual({ ms: 2000, c: 0, aparelho: 'pc-a' });
  });
  it('nunca volta quando o relógio do aparelho atrasa', () => {
    const a = { ms: 5000, c: 3, aparelho: 'pc-a' };
    expect(proximoHlc(a, 4000, 'pc-a')).toEqual({ ms: 5000, c: 4, aparelho: 'pc-a' });
  });
  it('a ordem das strings é a ordem dos eventos', () => {
    const s = [fmtHlc({ ms: 20, c: 0, aparelho: 'b' }), fmtHlc({ ms: 3, c: 9, aparelho: 'a' }), fmtHlc({ ms: 20, c: 0, aparelho: 'a' })];
    expect([...s].sort()).toEqual(['0000000000003-0009-a', '0000000000020-0000-a', '0000000000020-0000-b']);
  });
  it('contador no limite passa para o próximo milissegundo (a ordem da string continua certa)', () => {
    const cheio = { ms: 5000, c: 9999, aparelho: 'pc-a' };
    const prox = proximoHlc(cheio, 5000, 'pc-a');
    expect(prox).toEqual({ ms: 5001, c: 0, aparelho: 'pc-a' });
    expect(fmtHlc(prox) > fmtHlc(cheio)).toBe(true);
    expect(proximoHlc({ ms: 5000, c: 10, aparelho: 'pc-a' }, 1, 'pc-a').c).toBe(11);
  });
  it('hlcValido aceita só o formato do app', () => {
    expect(hlcValido('1793480000000-0007-pc-3f9a1c')).toBe(true);
    expect(hlcValido('0000000000003-0000-legado')).toBe(true);
    for (const ruim of ['', 'abc', '179348-0007-pc', '1793480000000-7-pc-a', '1793480000000-0007-', 42, undefined]) expect(hlcValido(ruim)).toBe(false);
  });
  it('hlcValido recusa carimbo mais de 1 dia no futuro', () => {
    const agora = 1793480000000;
    const dia = 24 * 60 * 60 * 1000;
    expect(hlcValido(`${agora + dia}-0000-pc-a`, agora)).toBe(true);
    expect(hlcValido(`${agora + dia + 1}-0000-pc-a`, agora)).toBe(false);
    expect(hlcValido('9999999999999-0000-pc-a', agora)).toBe(false);
  });
});
