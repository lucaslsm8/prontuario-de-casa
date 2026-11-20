import { describe, expect, it } from 'vitest';
import { canonico, chavesDosAparelhos, filtrarAssinados, legadoDe, paraConferir, textoAssinado } from './assinatura';
import type { Evento } from './persistencia';

const ev = (o: Partial<Evento> & { id: string; hlc: string }): Evento => ({ em: '2026-11-19T10:00:00Z', tipo: 'addRemedio', dados: {}, ...o });
const anuncio = (aparelho: string, hlc: string, pessoaId: string, legado: string[] = [], chave = `K-${aparelho}`) =>
  ev({ id: `an-${aparelho}-${hlc}`, hlc, aparelho, autor: pessoaId, tipo: 'aparelho', sig: `s-an-${aparelho}-${hlc}`, dados: { aparelhoId: aparelho, nome: aparelho, plataforma: 'pc', chaveAssinatura: chave, pessoaId, legado } });

describe('texto canônico', () => {
  it('ordem das chaves e undefined não mudam o texto; a assinatura fica de fora', () => {
    expect(canonico({ b: 1, a: [2, { d: undefined, c: 'x' }] })).toBe('{"a":[2,{"c":"x"}],"b":1}');
    const e = ev({ id: '1', hlc: 'h1', aparelho: 'pc-a', dados: { z: 1, a: 61.8 } });
    expect(textoAssinado({ ...e, sig: 'qualquer' })).toBe(textoAssinado({ ...e, dados: { a: 61.8, z: 1 } }));
  });
});

describe('filtrarAssinados', () => {
  const log: Evento[] = [
    ev({ id: 'velho', hlc: 'h01', aparelho: 'pc-a' }),                                         // antes do anúncio, sem assinatura
    ev({ id: 'papel-velho', hlc: 'h02', aparelho: 'pc-a', autor: 'roberto', tipo: 'responderPapel' }),
    anuncio('pc-a', 'h03', 'roberto', ['papel-velho']),
    ev({ id: 'novo-ok', hlc: 'h04', aparelho: 'pc-a', sig: 'boa' }),
    ev({ id: 'novo-sem', hlc: 'h05', aparelho: 'pc-a' }),                                       // depois do anúncio, sem assinatura
    ev({ id: 'novo-ruim', hlc: 'h06', aparelho: 'pc-a', sig: 'ruim' }),
    ev({ id: 'forjado', hlc: 'h07', aparelho: 'cel-x', autor: 'roberto', tipo: 'responderPapel' }), // outro aparelho falando por Roberto
    ev({ id: 'forjado-antigo', hlc: 'h00', aparelho: 'cel-x', autor: 'roberto', tipo: 'pedirPapel' }),
    ev({ id: 'helena-papel', hlc: 'h08', aparelho: 'cel-x', autor: 'helena', tipo: 'pedirPapel' }),  // Helena sem aparelho com chave
    ev({ id: 'comum-outro', hlc: 'h09', aparelho: 'cel-x', autor: 'roberto' }),                    // não sensível
  ];
  const chaves = chavesDosAparelhos(log);
  const validos = new Set(['an-pc-a-h03', 'novo-ok']);
  const ids = filtrarAssinados(log, chaves, validos).map((e) => e.id);

  it('chave do primeiro anúncio vindo do próprio aparelho', () => {
    expect(chaves.get('pc-a')).toMatchObject({ chave: 'K-pc-a', pessoaId: 'roberto', desde: 'h03' });
    expect(paraConferir(log, chaves).map((x) => x.id)).toEqual(['an-pc-a-h03', 'novo-ok', 'novo-ruim']);
  });
  it('histórico fica; depois do anúncio só assinado', () => {
    expect(ids).toContain('velho');
    expect(ids).toContain('novo-ok');
    expect(ids).not.toContain('novo-sem');
    expect(ids).not.toContain('novo-ruim');
  });
  it('sensível de quem tem aparelho com chave: só assinado por ele ou atestado no legado', () => {
    expect(ids).toContain('papel-velho');
    expect(ids).not.toContain('forjado');
    expect(ids).not.toContain('forjado-antigo');
    expect(ids).toContain('helena-papel');
    expect(ids).toContain('comum-outro');
  });
  it('assinado pelo aparelho de outra pessoa não vale como dela', () => {
    const l = [anuncio('pc-h', 'h01', 'helena'), ev({ id: 'x', hlc: 'h02', aparelho: 'pc-h', autor: 'roberto', tipo: 'compartilhar', sig: 'ok' }), anuncio('pc-r', 'h00', 'roberto')];
    const c = chavesDosAparelhos(l);
    expect(filtrarAssinados(l, c, new Set(['an-pc-h-h01', 'an-pc-r-h00', 'x'])).map((e) => e.id)).not.toContain('x');
  });
  it('anúncio feito por outro aparelho não conta; eventos desta sessão passam', () => {
    const l = [ev({ id: 'falso', hlc: 'h01', aparelho: 'cel-x', tipo: 'aparelho', dados: { aparelhoId: 'pc-a', chaveAssinatura: 'K-falsa', pessoaId: 'x' } })];
    expect(chavesDosAparelhos(l).size).toBe(0);
    expect(filtrarAssinados([ev({ id: 'meu', hlc: 'h09', aparelho: 'pc-a' })], chaves, new Set(), new Set(['meu'])).map((e) => e.id)).toEqual(['meu']);
  });
  it('legado: os sensíveis da pessoa ainda sem assinatura', () => {
    expect(legadoDe(log, 'roberto')).toEqual(['papel-velho', 'forjado', 'forjado-antigo']);
  });
});
