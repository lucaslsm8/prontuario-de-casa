// Relógio lógico híbrido (HLC): hora do aparelho + contador, para ordenar eventos de vários aparelhos.
// Formato em texto "<ms 13 dígitos>-<contador 4 dígitos>-<aparelhoId>": ordenar a string ordena os eventos.

export interface Hlc { ms: number; c: number; aparelho: string }

export const fmtHlc = (h: Hlc) => `${String(h.ms).padStart(13, '0')}-${String(h.c).padStart(4, '0')}-${h.aparelho}`;

export function lerHlc(s: string): Hlc {
  const [ms, c, ...aparelho] = s.split('-');
  return { ms: Number(ms), c: Number(c), aparelho: aparelho.join('-') };
}

/** Maior contador que cabe nos 4 dígitos; passou disso, avança o milissegundo para a ordem da string não quebrar. */
const MAX_C = 9999;

/** Próximo carimbo local: nunca volta, mesmo se o relógio do aparelho atrasar. */
export function proximoHlc(ultimo: Hlc | null, agora: number, aparelho: string): Hlc {
  if (!ultimo || agora > ultimo.ms) return { ms: agora, c: 0, aparelho };
  if (ultimo.c >= MAX_C) return { ms: ultimo.ms + 1, c: 0, aparelho };
  return { ms: ultimo.ms, c: ultimo.c + 1, aparelho };
}

/** Confere o formato antes de confiar num HLC vindo de outro aparelho. */
export const hlcValido = (s: unknown): s is string => typeof s === 'string' && /^\d{13}-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
