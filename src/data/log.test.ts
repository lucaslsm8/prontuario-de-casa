import { describe, expect, it } from 'vitest';
import { migrarLog, novoAparelhoId, ordenarLog, resolverEu, ultimoHlc } from './log';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

const ev = (id: string, em: string, extra: Partial<Evento> = {}): Evento => ({ id, em, tipo: 'x', dados: {}, ...extra });
const pessoa = (id: string, souEu?: boolean): Pessoa => ({ id, nome: id, curto: id, cor: '#ccc', alergias: [], condicoes: [], souEu });

describe('log', () => {
  it('novoAparelhoId: plataforma + 6 hex', () => {
    expect(novoAparelhoId('pc', () => 0)).toBe('pc-000000');
    expect(novoAparelhoId('cel', () => 0.999999)).toMatch(/^cel-[0-9a-f]{6}$/);
  });

  it('migrarLog dá HLC na ordem original, mesmo com hora fora de ordem, e é determinístico', () => {
    const antigos = [ev('a', '2026-10-30T10:00:00.000Z'), ev('b', '2026-10-30T09:00:00.000Z'), ev('c', '2026-10-30T10:00:00.000Z')];
    const m = migrarLog(antigos, 'pc-aaaaaa');
    expect(m.map((e) => e.aparelho)).toEqual(['pc-aaaaaa', 'pc-aaaaaa', 'pc-aaaaaa']);
    const ms = Date.parse('2026-10-30T10:00:00.000Z');
    expect(m.map((e) => e.hlc)).toEqual([`${ms}-0000-pc-aaaaaa`, `${ms}-0001-pc-aaaaaa`, `${ms}-0002-pc-aaaaaa`]);
    expect(migrarLog(antigos, 'pc-aaaaaa')).toEqual(m);
    expect(antigos[0].hlc).toBeUndefined(); // não altera o original
  });

  it('migrarLog mantém o HLC de quem já tem e continua depois dele', () => {
    const m = migrarLog([ev('a', '2026-10-30T10:00:00.000Z', { hlc: '9999999999999-0000-cel-bbbbbb', aparelho: 'cel-bbbbbb' }), ev('b', '2026-10-30T11:00:00.000Z')], 'pc-aaaaaa');
    expect(m[0].hlc).toBe('9999999999999-0000-cel-bbbbbb');
    expect(m[1].hlc).toBe('9999999999999-0001-pc-aaaaaa');
  });

  it('ordenarLog ordena por HLC, sem HLC fica na ordem em que veio', () => {
    expect(ordenarLog([ev('b', '', { hlc: '0000000000002-0000-x' }), ev('a', '', { hlc: '0000000000001-0000-x' })]).map((e) => e.id)).toEqual(['a', 'b']);
    expect(ordenarLog([ev('b', ''), ev('a', '')]).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('ultimoHlc é o maior carimbo do log', () => {
    expect(ultimoHlc([])).toBeNull();
    expect(ultimoHlc([ev('a', '', { hlc: '0000000000005-0001-pc-a' }), ev('b', '', { hlc: '0000000000005-0000-pc-a' })])).toEqual({ ms: 5, c: 1, aparelho: 'pc-a' });
  });

  it('resolverEu: identidade salva se a pessoa existe; senão, o souEu antigo do log', () => {
    const ps = [pessoa('ana', true), pessoa('bia')];
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'bia' })).toBe('bia');
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'sumiu' })).toBe('ana');
    expect(resolverEu(ps, null)).toBe('ana');
    expect(resolverEu([pessoa('bia')], null)).toBeNull();
  });
});
