// Aparelhos da família: funções puras sobre o log (evento `aparelho`) e o estado projetado.
import type { Evento } from './persistencia';
import type { Aparelho } from './types';
import { lerHlc } from './hlc';

/** 'pc-ab12cd' / 'cel-…' / 'web-…' → plataforma do evento (web conta como pc). */
export const plataformaDoId = (id: string): 'pc' | 'cel' => (id.startsWith('cel') ? 'cel' : 'pc');

/** "PC de Helena" / "Celular de Helena" (primeiro nome); sem nome, "Este aparelho". */
export function nomePadraoAparelho(plataforma: 'pc' | 'cel', nomePessoa?: string): string {
  const curto = nomePessoa?.trim().split(/\s+/)[0];
  if (!curto) return 'Este aparelho';
  return `${plataforma === 'cel' ? 'Celular' : 'PC'} de ${curto}`;
}

/** ISO do último evento de cada aparelho (campo `em`; se inválido, o relógio do HLC). */
export function vistoPorAparelho(eventos: Evento[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const ev of eventos) {
    if (!ev.aparelho) continue;
    let ms = Date.parse(ev.em);
    if (Number.isNaN(ms) && ev.hlc) ms = lerHlc(ev.hlc).ms;
    if (Number.isNaN(ms)) continue;
    const atual = m.get(ev.aparelho);
    if (!atual || ms > Date.parse(atual)) m.set(ev.aparelho, new Date(ms).toISOString());
  }
  return m;
}

/** Ao remover `removidoId`: quem recebe a chave nova (os outros aparelhos ativos com chave pública; este aparelho
 *  o Rust inclui sozinho) e quem sai junto por não ter chave pública (versão antiga do app). */
export function planoRemocao(aparelhos: Aparelho[], meuId: string | null, removidoId: string): { destinatarios: { id: string; chave: string }[]; semChave: Aparelho[] } {
  const outros = aparelhos.filter((a) => !a.removido && a.id !== removidoId && a.id !== meuId);
  return {
    destinatarios: outros.flatMap((a) => (a.chavePublica ? [{ id: a.id, chave: a.chavePublica }] : [])),
    semChave: outros.filter((a) => !a.chavePublica),
  };
}

/** Aparelhos ativos da família, o visto mais recentemente primeiro (desempate pelo id). */
export const aparelhosDaFamilia = (s: { aparelhos: Aparelho[] }): Aparelho[] =>
  s.aparelhos.filter((a) => !a.removido).sort((a, b) => (a.visto === b.visto ? (a.id < b.id ? -1 : 1) : a.visto < b.visto ? 1 : -1));
