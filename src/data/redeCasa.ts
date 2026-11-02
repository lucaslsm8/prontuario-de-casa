// Rede de casa: com a rede atual cadastrada, o app abre (e fica aberto) sem senha nem biometria.
// A identidade (hash do MAC do gateway / BSSID do Wi-Fi) vem do Rust; a lista fica no kv cifrado.
import { persistencia, type RedeCasa } from './persistencia';

export type { RedeCasa };

/** Puro: a rede atual está na lista de redes de casa? Sem rede atual (indisponível), nunca. */
export function estaEmCasa(atual: RedeCasa | null | undefined, lista: readonly RedeCasa[]): boolean {
  return !!atual && lista.some((r) => r.id === atual.id);
}

const LIMITE_MS = 1500;

/**
 * Consulta a rede atual e a lista, com limite de tempo para não atrasar a abertura.
 * Qualquer falha (sem rede, sem permissão, demora) conta como "fora de casa".
 */
export async function emCasaAgora(limiteMs = LIMITE_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<boolean>((ok) => { timer = setTimeout(() => ok(false), limiteMs); });
  const consulta = (async () => {
    const lista = await persistencia.redesCasa();
    if (lista.length === 0) return false; // desligado: nem consulta a rede
    return estaEmCasa(await persistencia.redeAtual(), lista);
  })().catch(() => false);
  try {
    return await Promise.race([consulta, limite]);
  } finally {
    clearTimeout(timer);
  }
}
