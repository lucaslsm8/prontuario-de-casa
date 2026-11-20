// Foto do comprimido → sugestão de desenho (forma e cor), sem IA e no aparelho.
// O fundo é a cor das bordas da foto; o comprimido é o que difere dela. Da mancha saem a proporção
// (redondo, oval, oblongo), quanto ela preenche o retângulo em volta e a cor média; duas cores bem
// diferentes nas duas metades = cápsula. A pessoa confere e ajusta. Testado em fotoPilula.test.ts.

import { CORES_PILULA } from './cartela';
import type { Aparencia, CorPilula } from './types';

type RGB = [number, number, number];
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

/** A cor nomeada mais próxima (o branco do comprimido costuma sair acinzentado na foto: clareia antes de comparar). */
export function corMaisProxima(c: RGB): CorPilula {
  const max = Math.max(...c);
  const claro: RGB = max > 0 && max < 245 && Math.max(...c) - Math.min(...c) < 30 ? (c.map((x) => Math.min(255, x * (245 / max))) as RGB) : c;
  return CORES_PILULA.reduce((m, x) => (dist(claro, hexRgb(x.hex)) < dist(claro, hexRgb(m.hex)) ? x : m), CORES_PILULA[0]).id;
}

/** Pixels RGBA (como `ImageData.data`) → aparência sugerida, ou `undefined` se não deu para separar o comprimido do fundo. */
export function analisarComprimido(px: Uint8ClampedArray, w: number, h: number): Aparencia | undefined {
  const cor = (i: number): RGB => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  // Fundo: mediana das bordas.
  const borda: RGB[] = [];
  for (let x = 0; x < w; x++) { borda.push(cor(x)); borda.push(cor((h - 1) * w + x)); }
  for (let y = 0; y < h; y++) { borda.push(cor(y * w)); borda.push(cor(y * w + w - 1)); }
  const fundo: RGB = [0, 1, 2].map((k) => mediana(borda.map((c) => c[k]))) as RGB;
  const LIMIAR = 38;

  let n = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
  const dentro = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist(cor(i), fundo) <= LIMIAR) continue;
      dentro[i] = 1; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // Pouca coisa (só ruído) ou a foto toda (sem fundo visível): não sugere.
  if (n < w * h * 0.03 || n > w * h * 0.9 || bw < 4 || bh < 4) return undefined;
  const proporcao = Math.max(bw, bh) / Math.min(bw, bh);
  const preenche = n / (bw * bh); // elipse ≈ 0,785; retângulo de pontas redondas, mais

  // Duas metades ao longo do eixo maior: cápsula de duas cores.
  const horizontal = bw >= bh;
  const somas: [number[], number[]] = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!dentro[i]) continue;
      const lado = horizontal ? (x - x0 < bw / 2 ? 0 : 1) : (y - y0 < bh / 2 ? 0 : 1);
      const c = cor(i);
      somas[lado][0] += c[0]; somas[lado][1] += c[1]; somas[lado][2] += c[2]; somas[lado][3]++;
    }
  }
  const media = (s: number[]): RGB => [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
  const a = media(somas[0]), b = media(somas[1]);
  const total: RGB = [0, 1, 2].map((k) => (somas[0][k] + somas[1][k]) / (somas[0][3] + somas[1][3])) as RGB;

  if (proporcao >= 1.6 && dist(a, b) > 60) {
    const c1 = corMaisProxima(a), c2 = corMaisProxima(b);
    if (c1 !== c2) return { forma: 'capsula', cor: c1, cor2: c2 };
  }
  const forma: Aparencia['forma'] = proporcao < 1.15 ? 'redondo' : proporcao >= 1.9 && preenche > 0.83 ? (proporcao >= 2.4 ? 'capsula' : 'oblongo') : proporcao >= 2.1 ? 'oblongo' : 'oval';
  return forma === 'capsula' ? { forma, cor: corMaisProxima(total), cor2: corMaisProxima(total) } : { forma, cor: corMaisProxima(total) };
}

/** Lê a foto (data URL) num canvas pequeno e analisa. No navegador/WebView. */
export async function sugerirAparencia(foto: string): Promise<Aparencia | undefined> {
  const img = new Image();
  img.src = foto;
  await img.decode();
  const lado = 96;
  const c = document.createElement('canvas');
  c.width = lado; c.height = lado;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(img, 0, 0, lado, lado);
  return analisarComprimido(ctx.getImageData(0, 0, lado, lado).data, lado, lado);
}
