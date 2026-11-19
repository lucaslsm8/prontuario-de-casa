// Eventos assinados por aparelho (Ed25519; a chave privada fica no Rust, src-tauri/src/assinatura.rs).
// Funções puras, testadas em assinatura.test.ts.
//
// Regras:
// - Cada aparelho anuncia a chave no próprio evento `aparelho` (`chaveAssinatura`, `pessoaId` = quem usa o
//   aparelho). A primeira chave anunciada fica (confiança no primeiro uso, como a `chavePublica`).
// - Depois do anúncio, todo evento que diz vir daquele aparelho precisa de assinatura válida. Os de antes
//   (sem assinatura) continuam valendo: são o histórico.
// - Eventos sensíveis (papéis, responsável, compartilhamento, aparelhos) com autor X: se X já tem aparelho
//   com chave, só valem assinados por um aparelho de X, ou se estão na lista `legado` que o aparelho de X
//   anunciou junto com a chave (os sensíveis de X que já existiam).
// Limite: quem anuncia primeiro a chave de um aparelho (ou um aparelho novo para uma pessoa) fica com ela;
// um aparelho estranho aparece em "Aparelhos e sincronização" e pode ser removido.

import type { Evento } from './persistencia';

/** Tipos cujo efeito depende de quem fez (autor): só o aparelho dessa pessoa pode emitir. */
export const SENSIVEIS = new Set(['pedirPapel', 'responderPapel', 'removerPapel', 'editarPessoa', 'compartilhar', 'removerAparelho']);

/** JSON com as chaves em ordem (o Rust pode devolver o objeto em outra ordem). */
export function canonico(v: unknown): string {
  // Número com casas: 15 dígitos significativos (um último dígito diferente ao reler o JSON no Rust não muda o texto).
  if (typeof v === 'number') return Number.isFinite(v) && !Number.isInteger(v) ? JSON.stringify(Number(v.toPrecision(15))) : JSON.stringify(v);
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
}

/** O texto que o aparelho assina: tudo do evento menos a própria assinatura. */
export const textoAssinado = (ev: Evento) => canonico([ev.id, ev.em, ev.autor ?? null, ev.aparelho ?? null, ev.hlc ?? null, ev.tipo, ev.dados]);

/** Chave e dono de cada aparelho, do primeiro anúncio (`desde` = HLC dele). */
export interface ChaveAparelho { chave: string; pessoaId?: string; desde: string; legado: Set<string> }

/** Primeiro anúncio de chave de cada aparelho (só vale o evento `aparelho` vindo dele mesmo), na ordem do log. */
export function chavesDosAparelhos(eventos: Evento[]): Map<string, ChaveAparelho> {
  const m = new Map<string, ChaveAparelho>();
  const ordem = [...eventos].sort((a, b) => (a.hlc ?? '').localeCompare(b.hlc ?? ''));
  for (const ev of ordem) {
    if (ev.tipo !== 'aparelho') continue;
    const d = ev.dados as { aparelhoId?: string; chaveAssinatura?: string; pessoaId?: string; legado?: unknown };
    if (!d.aparelhoId || ev.aparelho !== d.aparelhoId || !d.chaveAssinatura || m.has(d.aparelhoId)) continue;
    m.set(d.aparelhoId, {
      chave: d.chaveAssinatura,
      pessoaId: d.pessoaId,
      desde: ev.hlc ?? '',
      legado: new Set(Array.isArray(d.legado) ? d.legado.filter((x): x is string => typeof x === 'string') : []),
    });
  }
  return m;
}

/** O que mandar conferir ao Rust: eventos assinados que dizem vir de um aparelho com chave. */
export function paraConferir(eventos: Evento[], chaves: Map<string, ChaveAparelho>): { id: string; texto: string; sig: string; chave: string }[] {
  const out: { id: string; texto: string; sig: string; chave: string }[] = [];
  for (const ev of eventos) {
    const c = ev.aparelho ? chaves.get(ev.aparelho) : undefined;
    if (c && ev.sig) out.push({ id: ev.id, texto: textoAssinado(ev), sig: ev.sig, chave: c.chave });
  }
  return out;
}

/**
 * Tira os eventos que não passam nas regras. `validos`: ids com assinatura conferida; `confiaveis`: eventos
 * criados neste aparelho nesta sessão (ainda sendo assinados/gravados).
 */
export function filtrarAssinados(eventos: Evento[], chaves: Map<string, ChaveAparelho>, validos: Set<string>, confiaveis: Set<string> = new Set()): Evento[] {
  // Aparelhos com chave de cada pessoa, e o histórico sensível que eles atestaram.
  const daPessoa = new Map<string, ChaveAparelho[]>();
  for (const [, c] of chaves) if (c.pessoaId) daPessoa.set(c.pessoaId, [...(daPessoa.get(c.pessoaId) ?? []), c]);
  return eventos.filter((ev) => {
    if (confiaveis.has(ev.id)) return true;
    const c = ev.aparelho ? chaves.get(ev.aparelho) : undefined;
    const assinado = !!c && !!ev.sig && validos.has(ev.id);
    // Assinatura presente e errada: fora, sempre.
    if (c && ev.sig && !assinado) return false;
    // Aparelho com chave: depois do anúncio, só assinado. O próprio anúncio precisa vir assinado.
    if (c && !assinado && (ev.hlc ?? '') >= c.desde) return false;
    if (!SENSIVEIS.has(ev.tipo) || !ev.autor) return true;
    const dele = daPessoa.get(ev.autor);
    if (!dele?.length) return true;
    if (assinado) return c!.pessoaId === ev.autor;
    return dele.some((x) => x.legado.has(ev.id));
  });
}

/** Sensíveis do autor no log (para o `legado` do primeiro anúncio da chave). */
export const legadoDe = (eventos: Evento[], autor: string) => eventos.filter((e) => SENSIVEIS.has(e.tipo) && e.autor === autor && !e.sig).map((e) => e.id);
