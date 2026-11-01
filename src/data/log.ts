// Log de eventos para a sincronização: HLC nos eventos antigos, ordem e "quem sou eu" deste aparelho.
// Tudo puro (testado em log.test.ts). O banco nunca é reescrito: a migração é refeita a cada carga, sempre igual.

import { fmtHlc, hlcValido, lerHlc, proximoHlc, type Hlc } from './hlc';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

/** Fica no kv cifrado do aparelho (chave "identidade"); não vai para o log. */
export interface Identidade { aparelhoId: string; pessoaId: string | null }

/** Sufixo do HLC dado a eventos anteriores à sincronização: igual em qualquer aparelho que tenha o mesmo log. */
export const APARELHO_LEGADO = 'legado';

export function novoAparelhoId(plataforma: 'pc' | 'cel' | 'web', aleatorio: () => number = Math.random) {
  return `${plataforma}-${Math.floor(aleatorio() * 0x1000000).toString(16).padStart(6, '0').slice(0, 6)}`;
}

const maior = (a: Hlc | null, b: Hlc) => (!a || fmtHlc(b) > fmtHlc(a) ? b : a);

/** Dá `aparelho` e `hlc` a quem não tem (ou tem HLC inválido), na ordem em que está, a partir de `em`. Eventos antigos recebem HLC terminado em `legado`, igual em qualquer aparelho. Não altera os originais. */
export function migrarLog(eventos: Evento[], aparelhoId: string): Evento[] {
  let ultimo: Hlc | null = null;
  return eventos.map((ev) => {
    if (hlcValido(ev.hlc)) {
      ultimo = maior(ultimo, lerHlc(ev.hlc));
      return ev;
    }
    const ms = Date.parse(ev.em);
    const h = proximoHlc(ultimo, Number.isNaN(ms) ? 0 : ms, APARELHO_LEGADO);
    ultimo = h;
    return { ...ev, aparelho: ev.aparelho ?? aparelhoId, hlc: fmtHlc(h) };
  });
}

/** Ordem de aplicação: por HLC e, no empate, por id. Sem nenhum HLC (testes, navegador), a ordem em que vieram. */
export const ordenarLog = (eventos: Evento[]) =>
  [...eventos].sort((a, b) => {
    const ha = a.hlc ?? '', hb = b.hlc ?? '';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return !ha ? 0 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

export const ultimoHlc = (eventos: Evento[]): Hlc | null => eventos.reduce<Hlc | null>((u, e) => (e.hlc ? maior(u, lerHlc(e.hlc)) : u), null);

/** "Eu" neste aparelho: a pessoa da identidade, se existe. O souEu do log antigo só vale na primeira vez (sem identidade). */
export function resolverEu(pessoas: Pessoa[], identidade: Identidade | null): string | null {
  if (identidade) return identidade.pessoaId && pessoas.some((p) => p.id === identidade.pessoaId) ? identidade.pessoaId : null;
  return pessoas.find((p) => p.souEu)?.id ?? null;
}
