import { describe, expect, it } from 'vitest';
import { aparelhosDaFamilia, nomePadraoAparelho, planoRemocao, plataformaDoId, vistoPorAparelho } from './aparelhos';
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

  it('removerAparelho tira da lista; "renomear" atrasado na chave velha não traz de volta; voltar com convite traz', () => {
    const base = [
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' }),
      reg('2', 'cel-b', '0000000000002-0000-cel-b', '2026-10-30T11:00:00.000Z', 'Celular', { chavePublica: 'bb' }),
      ev('3', 'pc-a', '0000000000003-0000-pc-a', '2026-10-30T12:00:00.000Z', 'removerAparelho', { aparelhoId: 'cel-b', epoca: 1 }),
    ];
    const s = projetar(base);
    expect(s.aparelhos.find((a) => a.id === 'cel-b')).toMatchObject({ removido: true, removidoEpoca: 1, chavePublica: 'bb' });
    expect(aparelhosDaFamilia(s).map((a) => a.id)).toEqual(['pc-a']);
    // O removido ainda não sabe e renomeia, na época 0: continua removido.
    const atrasado = projetar([...base, reg('4', 'cel-b', '0000000000004-0000-cel-b', '2026-10-30T13:00:00.000Z', 'Celular novo', { epoca: 0 })]);
    expect(aparelhosDaFamilia(atrasado).map((a) => a.id)).toEqual(['pc-a']);
    // Entrou de novo com convite (época 1): volta para a lista, com a mesma chave (a do aparelho é estável).
    const voltou = projetar([...base, reg('4', 'cel-b', '0000000000004-0000-cel-b', '2026-10-30T13:00:00.000Z', 'Celular', { epoca: 1, chavePublica: 'bb' })]);
    expect(voltou.aparelhos.find((a) => a.id === 'cel-b')).toMatchObject({ removido: undefined, chavePublica: 'bb' });
  });

  it('evento `aparelho` só vale do próprio aparelho', () => {
    const log = [
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' }),
      // cel-b tenta descrever pc-a (nome e chave): ignorado.
      ev('2', 'cel-b', '0000000000002-0000-cel-b', '2026-10-30T11:00:00.000Z', 'aparelho', { aparelhoId: 'pc-a', nome: 'Falso', plataforma: 'pc', chavePublica: 'xx' }),
      // cel-b tenta criar um aparelho que não é ele: ignorado.
      ev('3', 'cel-b', '0000000000003-0000-cel-b', '2026-10-30T11:00:00.000Z', 'aparelho', { aparelhoId: 'pc-fantasma', nome: 'Fantasma', plataforma: 'pc', chavePublica: 'ff' }),
      // Sem assinatura: ignorado.
      { id: '4', em: '2026-10-30T11:00:00.000Z', tipo: 'aparelho', dados: { aparelhoId: 'pc-a', nome: 'Sem dono', plataforma: 'pc' } },
    ];
    const s = projetar(log);
    expect(s.aparelhos.map((a) => [a.id, a.nome, a.chavePublica])).toEqual([['pc-a', 'PC de Helena', 'aa']]);
  });

  it('chave pública: vale a primeira (renomear não troca; chave diferente é ignorada)', () => {
    const s = projetar([
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' }),
      reg('2', 'pc-a', '0000000000002-0000-pc-a', '2026-10-30T11:00:00.000Z', 'Notebook', { chavePublica: 'xx' }),
      reg('3', 'pc-a', '0000000000003-0000-pc-a', '2026-10-30T12:00:00.000Z', 'Notebook da sala'),
    ]);
    expect(s.aparelhos[0]).toMatchObject({ nome: 'Notebook da sala', chavePublica: 'aa' });
    // Sem chave no primeiro registro (versão antiga): a primeira que aparecer fica.
    const t = projetar([
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC'),
      reg('2', 'pc-a', '0000000000002-0000-pc-a', '2026-10-30T11:00:00.000Z', 'PC', { chavePublica: 'aa' }),
      reg('3', 'pc-a', '0000000000003-0000-pc-a', '2026-10-30T12:00:00.000Z', 'PC', { chavePublica: 'bb' }),
    ]);
    expect(t.aparelhos[0].chavePublica).toBe('aa');
  });

  it('plano da remoção: chave nova para quem tem chave pública; sem chave sai junto', () => {
    const s = projetar([
      reg('1', 'pc-a', '0000000000001-0000-pc-a', '2026-10-30T10:00:00.000Z', 'PC de Helena', { chavePublica: 'aa' }),
      reg('2', 'cel-b', '0000000000002-0000-cel-b', '2026-10-30T11:00:00.000Z', 'Celular', { chavePublica: 'bb' }),
      reg('3', 'pc-c', '0000000000003-0000-pc-c', '2026-10-30T11:00:00.000Z', 'PC velho'),
      reg('4', 'pc-x', '0000000000004-0000-pc-x', '2026-10-30T11:00:00.000Z', 'Notebook', { chavePublica: 'xx' }),
      reg('5', 'cel-z', '0000000000005-0000-cel-z', '2026-10-30T11:00:00.000Z', 'Antigo', { chavePublica: 'zz', removido: true }),
    ]);
    const p = planoRemocao(s.aparelhos, 'pc-a', 'pc-x');
    expect(p.destinatarios).toEqual([{ id: 'cel-b', chave: 'bb' }]);
    expect(p.semChave.map((a) => a.id)).toEqual(['pc-c']);
  });
});
