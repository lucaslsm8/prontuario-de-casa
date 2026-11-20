import { describe, expect, it } from 'vitest';
import { analisarComprimido, corMaisProxima } from './fotoPilula';

const W = 96, H = 96;
type RGB = [number, number, number];
/** Imagem sintética: fundo e uma forma pintada por `dentro(x, y)` com `cor(x, y)`. */
function imagem(fundo: RGB, dentro: (x: number, y: number) => boolean, cor: (x: number, y: number) => RGB) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = dentro(x, y) ? cor(x, y) : fundo;
    // um pouco de ruído, como numa foto
    const r = ((x * 7 + y * 13) % 9) - 4;
    px.set([c[0] + r, c[1] + r, c[2] + r, 255], (y * W + x) * 4);
  }
  return px;
}
const elipse = (rx: number, ry: number) => (x: number, y: number) => ((x - 48) / rx) ** 2 + ((y - 48) / ry) ** 2 <= 1;
/** Retângulo de pontas arredondadas (estádio) com meia largura `a` e raio `r`. */
const estadio = (a: number, r: number) => (x: number, y: number) => {
  const dx = Math.max(0, Math.abs(x - 48) - (a - r));
  return dx * dx + (y - 48) ** 2 <= r * r;
};
const MESA: RGB = [60, 70, 80];

describe('foto do comprimido', () => {
  it('redondo branco (acinzentado na foto)', () => {
    expect(analisarComprimido(imagem(MESA, elipse(30, 30), () => [205, 205, 200]), W, H)).toEqual({ forma: 'redondo', cor: 'branco' });
  });
  it('oval amarelo', () => {
    expect(analisarComprimido(imagem(MESA, elipse(40, 26), () => [240, 210, 100]), W, H)).toEqual({ forma: 'oval', cor: 'amarelo' });
  });
  it('oblongo rosa', () => {
    expect(analisarComprimido(imagem([235, 235, 235], estadio(40, 18), () => [240, 165, 180]), W, H)).toEqual({ forma: 'oblongo', cor: 'rosa' });
  });
  it('cápsula azul e branca', () => {
    expect(analisarComprimido(imagem(MESA, estadio(42, 15), (x) => (x < 48 ? [120, 165, 215] : [250, 250, 245])), W, H)).toEqual({ forma: 'capsula', cor: 'azul', cor2: 'branco' });
  });
  it('sem comprimido (só fundo) não sugere', () => {
    expect(analisarComprimido(imagem(MESA, () => false, () => [0, 0, 0]), W, H)).toBeUndefined();
  });
  it('cor mais próxima', () => {
    expect(corMaisProxima([215, 105, 95])).toBe('vermelho');
    expect(corMaisProxima([170, 120, 85])).toBe('marrom');
  });
});
