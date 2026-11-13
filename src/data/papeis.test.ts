import { describe, expect, it } from 'vitest';
import { nivel, pedidosParaMim, pedirPapel, podeDecidir, podeEditar, podeMarcarDose, podeMudarResponsavel, removerPapel, responderPapel, type Papel } from './papeis';
import { projetar } from './store';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

const p = (id: string, extra: Partial<Pessoa> = {}): Pessoa => ({ id, nome: id, curto: id, cor: '#ccc', alergias: [], condicoes: [], ...extra });
const pessoas = [p('ana'), p('bia'), p('caio', { responsavelId: 'ana' }), p('rex', { tipo: 'pet' })];
const base = (papeis: Papel[] = []) => ({ pessoas, papeis });

describe('níveis e permissões', () => {
  it('você e o responsável editam; família não', () => {
    const s = base();
    expect(podeEditar(s, 'ana', 'ana')).toBe(true);
    expect(podeEditar(s, 'ana', 'caio')).toBe(true);
    expect(nivel(s, 'ana', 'caio')).toBe('responsavel');
    expect(podeEditar(s, 'bia', 'caio')).toBe(false);
    expect(podeEditar(s, 'bia', 'ana')).toBe(false);
  });
  it('pets: todo mundo edita', () => {
    expect(podeEditar(base(), 'bia', 'rex')).toBe(true);
  });
  it('cuidador marca dose mas não edita; administrador edita', () => {
    const s = base([{ de: 'ana', para: 'bia', aceito: 'cuidador' }]);
    expect(podeMarcarDose(s, 'bia', 'ana')).toBe(true);
    expect(podeEditar(s, 'bia', 'ana')).toBe(false);
    const adm = base([{ de: 'ana', para: 'bia', aceito: 'administrador' }]);
    expect(podeEditar(adm, 'bia', 'ana')).toBe(true);
  });
  it('pedido pendente não dá nada', () => {
    const s = base([{ de: 'ana', para: 'bia', pedido: 'administrador' }]);
    expect(podeMarcarDose(s, 'bia', 'ana')).toBe(false);
  });
});

describe('pedidos', () => {
  it('só quem vai ter o papel pede; não pede para pet nem para si', () => {
    expect(pedirPapel(base(), { de: 'ana', para: 'bia', papel: 'cuidador', por: 'bia' })).toEqual([{ de: 'ana', para: 'bia', pedido: 'cuidador' }]);
    expect(pedirPapel(base(), { de: 'ana', para: 'bia', papel: 'cuidador', por: 'caio' })).toEqual([]);
    expect(pedirPapel(base(), { de: 'rex', para: 'bia', papel: 'cuidador', por: 'bia' })).toEqual([]);
    expect(pedirPapel(base(), { de: 'bia', para: 'bia', papel: 'cuidador', por: 'bia' })).toEqual([]);
  });
  it('a pessoa (ou o responsável) aceita; outro não', () => {
    const s = base([{ de: 'caio', para: 'bia', pedido: 'cuidador' }]);
    expect(responderPapel(s, { de: 'caio', para: 'bia', aceitar: true, por: 'bia' })).toEqual(s.papeis);
    expect(responderPapel(s, { de: 'caio', para: 'bia', aceitar: true, por: 'ana' })).toEqual([{ de: 'caio', para: 'bia', aceito: 'cuidador' }]);
    expect(responderPapel(s, { de: 'caio', para: 'bia', aceitar: false, por: 'caio' })).toEqual([]);
    expect(pedidosParaMim(s, 'ana')).toHaveLength(1);
    expect(pedidosParaMim(s, 'bia')).toHaveLength(0);
  });
  it('pedir administrador sendo cuidador mantém o cuidador até aceitar', () => {
    const s = base([{ de: 'ana', para: 'bia', aceito: 'cuidador' }]);
    const pedido = pedirPapel(s, { de: 'ana', para: 'bia', papel: 'administrador', por: 'bia' });
    expect(pedido).toEqual([{ de: 'ana', para: 'bia', aceito: 'cuidador', pedido: 'administrador' }]);
    expect(responderPapel({ pessoas, papeis: pedido }, { de: 'ana', para: 'bia', aceitar: true, por: 'ana' })).toEqual([{ de: 'ana', para: 'bia', aceito: 'administrador' }]);
  });
  it('tirar: a pessoa, o responsável ou quem tem o papel', () => {
    const s = base([{ de: 'caio', para: 'bia', aceito: 'cuidador' }]);
    expect(removerPapel(s, { de: 'caio', para: 'bia', por: 'bia' })).toEqual([]);
    expect(removerPapel(s, { de: 'caio', para: 'bia', por: 'ana' })).toEqual([]);
    expect(removerPapel(base([{ de: 'ana', para: 'bia', aceito: 'cuidador' }]), { de: 'ana', para: 'bia', por: 'caio' })).toHaveLength(1);
  });
  it('responsável: a pessoa, o atual, ou qualquer um quando está em branco', () => {
    expect(podeMudarResponsavel(base(), 'bia', 'caio')).toBe(false);
    expect(podeMudarResponsavel(base(), 'ana', 'caio')).toBe(true);
    expect(podeMudarResponsavel(base(), 'caio', 'caio')).toBe(true);
    expect(podeMudarResponsavel(base(), 'caio', 'bia')).toBe(true);
    expect(podeDecidir(base(), 'ana', 'caio')).toBe(true);
  });
});

describe('no log de eventos', () => {
  const ev = (tipo: string, dados: Record<string, unknown>, n: number, autor?: string): Evento => ({ id: `e${n}`, em: '2026-11-13T10:00:00Z', autor, tipo, dados }) as Evento;
  const ini = [ev('addPessoa', { pessoa: p('ana') }, 0), ev('addPessoa', { pessoa: p('bia') }, 1)];
  it('o autor do evento vale, não o `por` dos dados', () => {
    const forjado = projetar([...ini, ev('pedirPapel', { de: 'ana', para: 'bia', papel: 'administrador', por: 'bia' }, 2, 'bia'), ev('responderPapel', { de: 'ana', para: 'bia', aceitar: true, por: 'ana' }, 3, 'bia')]);
    expect(forjado.papeis).toEqual([{ de: 'ana', para: 'bia', pedido: 'administrador' }]);
    const certo = projetar([...ini, ev('pedirPapel', { de: 'ana', para: 'bia', papel: 'administrador' }, 2, 'bia'), ev('responderPapel', { de: 'ana', para: 'bia', aceitar: true }, 3, 'ana')]);
    expect(certo.papeis).toEqual([{ de: 'ana', para: 'bia', aceito: 'administrador' }]);
  });
  it('responsável: quem não pode trocar é ignorado', () => {
    const s = projetar([...ini, ev('editarPessoa', { pessoaId: 'ana', patch: { responsavelId: 'bia' } }, 2, 'bia'), ev('editarPessoa', { pessoaId: 'ana', patch: { responsavelId: 'ana' } }, 3, 'ana')]);
    // Em branco: a Bia pôde se pôr; a própria Ana não vira responsável de si mesma.
    expect(s.pessoas.find((x) => x.id === 'ana')?.responsavelId).toBe('bia');
    const s2 = projetar([...ini, ev('editarPessoa', { pessoaId: 'ana', patch: { responsavelId: 'bia' } }, 2, 'ana'), ev('editarPessoa', { pessoaId: 'ana', patch: { responsavelId: null } }, 3, 'caio')]);
    expect(s2.pessoas.find((x) => x.id === 'ana')?.responsavelId).toBe('bia');
  });
});
