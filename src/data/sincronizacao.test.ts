import { describe, expect, it } from 'vitest';
import { mensagemErro } from './sincronizacao';

describe('sincronização', () => {
  it('erros de token viram aviso de token; o resto vira texto simples', () => {
    expect(mensagemErro('TOKEN: o token do GitHub não tem acesso ou venceu')).toEqual({ texto: 'o token do GitHub não tem acesso ou venceu', token: true });
    expect(mensagemErro(new Error('sem conexão com o GitHub'))).toEqual({ texto: 'sem conexão com o GitHub', token: false });
  });
});
