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

/** Quanto um HLC recebido pode estar à frente do relógio deste aparelho. */
const FUTURO_MAX = 24 * 60 * 60 * 1000;

/** Confere o formato antes de confiar num HLC vindo de outro aparelho, e recusa carimbo mais de 1 dia no futuro
 *  (um relógio muito adiantado puxaria o HLC de todos os aparelhos para a frente). */
export const hlcValido = (s: unknown, agora: number = Date.now()): s is string =>
  typeof s === 'string' && /^\d{13}-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && Number(s.slice(0, 13)) <= agora + FUTURO_MAX;
