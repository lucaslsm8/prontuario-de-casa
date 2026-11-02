import { beforeEach, describe, expect, it, vi } from 'vitest';

const p = vi.hoisted(() => ({ familiaInfo: vi.fn(), syncEnviar: vi.fn(), syncReceber: vi.fn() }));
vi.mock('./tempo', async (orig) => ({ ...(await orig<typeof import('./tempo')>()), MODO_REAL: true }));
vi.mock('./persistencia', async (orig) => ({ ...(await orig<typeof import('./persistencia')>()), persistencia: p }));

import { carregarFamilia, definirFamilia, infoSync as info, mensagemErro, sincronizar } from './sincronizacao';

const familia = { familiaId: 'f1', repo: 'a/b' };
const store = () => ({ api: { aparelhoId: () => 'pc-a', eventosParaEnviar: vi.fn(async () => []), recarregar: vi.fn(async () => {}), toast: vi.fn() } });

describe('sincronização', () => {
  beforeEach(() => { vi.resetAllMocks(); definirFamilia(familia); });

  it('erros de token viram aviso de token; o resto vira texto simples', () => {
    expect(mensagemErro('TOKEN: o token do GitHub não tem acesso ou venceu')).toEqual({ texto: 'o token do GitHub não tem acesso ou venceu', token: true });
    expect(mensagemErro(new Error('sem conexão com o GitHub'))).toEqual({ texto: 'sem conexão com o GitHub', token: false });
  });

  it('sincronizar devolve ok ou o erro (quem entra na família precisa saber)', async () => {
    p.syncEnviar.mockResolvedValue(0);
    p.syncReceber.mockResolvedValue(3);
    const s = store();
    expect(await sincronizar(s)).toEqual({ ok: true });
    expect(s.api.recarregar).toHaveBeenCalled();
    p.syncReceber.mockRejectedValue('sem conexão com o GitHub');
    expect(await sincronizar(s)).toEqual({ ok: false, erro: 'sem conexão com o GitHub' });
    expect(info().estado).toBe('erro');
  });

  it('pedido durante outra rodada recebe o resultado da rodada seguinte', async () => {
    let soltar = () => {};
    p.syncEnviar.mockImplementationOnce(() => new Promise((r) => { soltar = () => r(0); })).mockResolvedValue(0);
    p.syncReceber.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('o GitHub respondeu 500'));
    const s = store();
    const primeira = sincronizar(s);
    const segunda = sincronizar(s);
    await Promise.resolve();
    soltar();
    expect(await primeira).toEqual({ ok: true });
    expect(await segunda).toEqual({ ok: false, erro: 'o GitHub respondeu 500' });
  });

  it('erro no envio não impede o recebimento; a rodada mostra o erro do envio', async () => {
    p.syncEnviar.mockRejectedValue(new Error('o GitHub respondeu 500'));
    p.syncReceber.mockResolvedValue(2);
    const s = store();
    expect(await sincronizar(s)).toEqual({ ok: false, erro: 'o GitHub respondeu 500' });
    expect(p.syncReceber).toHaveBeenCalled();
    expect(s.api.recarregar).toHaveBeenCalled();
    expect(info().estado).toBe('erro');
  });

  it('recebimento que falhou no meio reprojeta na próxima rodada, mesmo sem nada novo', async () => {
    p.syncEnviar.mockResolvedValue(0);
    p.syncReceber.mockRejectedValueOnce(new Error('sem conexão com o GitHub')).mockResolvedValueOnce(0);
    const s = store();
    expect((await sincronizar(s)).ok).toBe(false);
    expect(s.api.recarregar).not.toHaveBeenCalled();
    expect(await sincronizar(s)).toEqual({ ok: true });
    expect(s.api.recarregar).toHaveBeenCalledTimes(1);
  });

  it('carregarFamilia com erro mantém a família e marca o erro', async () => {
    p.familiaInfo.mockRejectedValue(new Error('banco ocupado'));
    await carregarFamilia();
    expect(info().familia).toEqual(familia);
    expect(info()).toMatchObject({ estado: 'erro', erro: 'banco ocupado' });
    p.familiaInfo.mockResolvedValue(null);
    await carregarFamilia();
    expect(info().familia).toBeNull();
  });

  it('aparelho removido para de sincronizar e marca o estado, sem erro de rede', async () => {
    p.syncEnviar.mockRejectedValue(new Error('REMOVIDO: Este aparelho foi removido da família'));
    p.syncReceber.mockRejectedValue(new Error('REMOVIDO: Este aparelho foi removido da família'));
    const s = store();
    expect(await sincronizar(s)).toEqual({ ok: false, erro: 'Este aparelho foi removido da família.' });
    expect(info()).toMatchObject({ removido: true, estado: 'parado', familia: { familiaId: 'f1', removido: true } });
    p.syncEnviar.mockClear();
    expect((await sincronizar(s)).ok).toBe(false);
    expect(p.syncEnviar).not.toHaveBeenCalled();
    // Entrar de novo (convite) limpa a marca.
    definirFamilia(familia);
    expect(info().removido).toBe(false);
  });

  it('a família que vem do Rust já removida chega marcada', async () => {
    p.familiaInfo.mockResolvedValue({ ...familia, epoca: 2, removido: true });
    await carregarFamilia();
    expect(info().removido).toBe(true);
  });

  it('uma rodada que adotou chave nova atualiza a época', async () => {
    p.syncEnviar.mockResolvedValue(0);
    p.syncReceber.mockResolvedValue(0);
    p.familiaInfo.mockResolvedValue({ ...familia, epoca: 3 });
    expect(await sincronizar(store())).toEqual({ ok: true });
    expect(info().familia?.epoca).toBe(3);
  });
});
