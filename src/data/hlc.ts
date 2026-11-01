// Relógio lógico híbrido (HLC): hora do aparelho + contador, para ordenar eventos de vários aparelhos.
// Formato em texto "<ms 13 dígitos>-<contador 4 dígitos>-<aparelhoId>": ordenar a string ordena os eventos.

export interface Hlc { ms: number; c: number; aparelho: string }

export const fmtHlc = (h: Hlc) => `${String(h.ms).padStart(13, '0')}-${String(h.c).padStart(4, '0')}-${h.aparelho}`;

export function lerHlc(s: string): Hlc {
  const [ms, c, ...aparelho] = s.split('-');
  return { ms: Number(ms), c: Number(c), aparelho: aparelho.join('-') };
}

/** Próximo carimbo local: nunca volta, mesmo se o relógio do aparelho atrasar. */
export function proximoHlc(ultimo: Hlc | null, agora: number, aparelho: string): Hlc {
  if (!ultimo || agora > ultimo.ms) return { ms: agora, c: 0, aparelho };
  return { ms: ultimo.ms, c: ultimo.c + 1, aparelho };
}
