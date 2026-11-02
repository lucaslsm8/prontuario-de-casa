import { describe, expect, it } from 'vitest';
import { aparelhosDaFamilia, nomePadraoAparelho, plataformaDoId, vistoPorAparelho } from './aparelhos';
import type { Evento } from './persistencia';
import { projetar } from './store';

const ev = (id: string, aparelho: string, hlc: string, em: string, tipo: string, dados: Record<string, unknown>): Evento => ({ id, em, aparelho, hlc, tipo, dados });
const reg = (id: string, aparelho: string, hlc: string, em: string, nome: string, extra: Record<string, unknown> = {}) =>
  ev(id, aparelho, hlc, em, 'aparelho', { aparelhoId: aparelho, nome, plataforma: aparelho.startsWith('cel') ? 'cel' : 'pc', ...extra });

describe('aparelhos', () => {
  it('nome padrão e plataforma', () => {
    expect(nomePadraoAparelho('pc', 'Helena Almeida')).toBe('PC de Helena');
    expect(nomePadraoAparelho('cel', ' Roberto ')).toBe('Celular de Roberto');
    expect(nomePadraoAparelho('pc')).toBe('Este aparelho');
    expect(plataformaDoId('cel-ab12')).toBe('cel');
    expect(plataformaDoId('web-ab12')).toBe('pc');
  });

  it('projeta o aparelho com a chave pública', () => {
    const s = projetar([reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' })]);
    expect(s.aparelhos).toEqual([{ id: 'pc-a', nome: 'PC de Helena', plataforma: 'pc', chavePublica: 'aa', removido: undefined, visto: '2026-10-30T10:00:00.000Z' }]);
  });

  it('renomear vale o mais recente pelo HLC e mantém a chave', () => {
    const log = [
      reg('2', 'pc-a', '0000000000003-0000-pc-a', '2026-10-30T12:00:00.000Z', 'Notebook da sala'),
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' }),
    ];
    const s = projetar(log);
    expect(s.aparelhos).toHaveLength(1);
    expect(s.aparelhos[0]).toMatchObject({ nome: 'Notebook da sala', chavePublica: 'aa' });
  });

  it('visto = último evento do aparelho, de qualquer tipo', () => {
    const log = [
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena'),
      reg('2', 'cel-b', '0000000000002-0000-cel-b', '2026-10-30T11:00:00.000Z', 'Celular de Roberto'),
      ev('3', 'cel-b', '0000000000009-0000-cel-b', '2026-10-31T08:30:00.000Z', 'compartilhar', { de: 'a', para: 'b', categorias: [] }),
      ev('4', 'pc-a', '0000000000005-0000-pc-a', '2026-10-30T18:00:00.000Z', 'compartilhar', { de: 'a', para: 'b', categorias: [] }),
    ];
    const vistos = vistoPorAparelho(log);
    expect(vistos.get('pc-a')).toBe('2026-10-30T18:00:00.000Z');
    expect(vistos.get('cel-b')).toBe('2026-10-31T08:30:00.000Z');
    // Mais recentemente visto primeiro.
    expect(aparelhosDaFamilia(projetar(log)).map((a) => a.id)).toEqual(['cel-b', 'pc-a']);
  });

  it('removidos ficam fora da lista da família', () => {
    const log = [
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena'),
      reg('2', 'cel-b', '0000000000002-0000-cel-b', '2026-10-30T11:00:00.000Z', 'Celular', { removido: true }),
    ];
    const s = projetar(log);
    expect(s.aparelhos).toHaveLength(2);
    expect(aparelhosDaFamilia(s).map((a) => a.id)).toEqual(['pc-a']);
  });
});
