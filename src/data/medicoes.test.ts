import { describe, expect, it } from 'vitest';
import { adesaoPorSemana, faixaImc, fmtMedicao, imc, lerPressao, medicoesDoPatch, montarMedicao, perfilDasMedicoes, pontosPesagem, serieMedicao, variacao, type FormMedicao } from './medicoes';
import { projetar } from './store';
import type { Evento } from './persistencia';
import type { Medicao, Pessoa } from './types';

const HOJE = '2026-10-28';
const ana: Pessoa = { id: 'ana', nome: 'Ana', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [], souEu: true, altura: 1.6 };
const m = (id: string, tipo: Medicao['tipo'], data: string, valor: number, valor2?: number): Medicao => ({ id, pessoaId: 'ana', tipo, data, valor, ...(valor2 ? { valor2 } : {}) });
const form = (o: Partial<FormMedicao>): FormMedicao => ({ tipo: 'peso', data: '27/10/2026', hora: '08:10', valor: '', valor2: '', contexto: 'Jejum', nota: '', ...o });

describe('medições', () => {
  it('série em ordem de data e a variação', () => {
    const ms = [m('2', 'peso', '2026-10-01', 61.5), m('1', 'peso', '2026-08-01', 63), m('3', 'pressao', '2026-10-01', 120, 80)];
    expect(serieMedicao(ms, 'ana', 'peso').map((x) => x.id)).toEqual(['1', '2']);
    expect(variacao(serieMedicao(ms, 'ana', 'peso'), 1, 'kg')).toBe('−1,5 kg');
    expect(variacao([{ valor: 1 }], 1)).toBeUndefined();
    expect(variacao([{ valor: 1 }, { valor: 1 }], 0)).toBe('estável');
  });
  it('pressão: 120/80, 12/8 em cmHg e inválidas', () => {
    expect(lerPressao('120/80')).toEqual([120, 80]);
    expect(lerPressao('12/8')).toEqual([120, 80]);
    expect(lerPressao('12 x 8')).toEqual([120, 80]);
    expect(lerPressao('80/120')).toBeUndefined();
    expect(lerPressao('abc')).toBeUndefined();
    expect(fmtMedicao(m('x', 'pressao', HOJE, 130, 85))).toBe('130/85');
    expect(fmtMedicao(m('x', 'peso', HOJE, 61.5))).toBe('61,5');
  });
  it('monta a medição e valida', () => {
    expect(montarMedicao(form({ valor: '61,5' }), 'ana', HOJE).medicao).toEqual({ pessoaId: 'ana', tipo: 'peso', data: '2026-10-27', hora: '08:10', valor: 61.5 });
    expect(montarMedicao(form({ tipo: 'pressao', valor: '13', valor2: '8' }), 'ana', HOJE).medicao).toMatchObject({ valor: 130, valor2: 80 });
    expect(montarMedicao(form({ tipo: 'glicemia', valor: '98' }), 'ana', HOJE).medicao).toMatchObject({ contexto: 'Jejum' });
    expect(montarMedicao(form({ valor: '900' }), 'ana', HOJE).erros.valor).toBeDefined();
    expect(montarMedicao(form({ valor: '60', data: '30/10/2026' }), 'ana', HOJE).erros.data).toBe('A data não pode ser no futuro.');
    expect(montarMedicao(form({ tipo: 'pressao', valor: '80', valor2: '120' }), 'ana', HOJE).erros.valor).toBeDefined();
  });
  it('IMC e faixa', () => {
    expect(imc(64, 1.6)).toBe(25);
    expect(imc(64, undefined)).toBeUndefined();
    expect([faixaImc(18), faixaImc(22), faixaImc(27), faixaImc(31)]).toEqual(['abaixo do peso', 'peso adequado', 'sobrepeso', 'obesidade']);
  });
  it('perfil mostra a medição mais recente; pressão antiga não sobrescreve a do perfil', () => {
    const p = { ...ana, pressao: { valor: '118/76', data: '2026-10-20' } };
    const r = perfilDasMedicoes(p, [m('1', 'peso', '2026-08-01', 63), m('2', 'peso', '2026-10-01', 61), m('3', 'pressao', '2026-09-01', 130, 85)]);
    expect(r).toEqual({ peso: 61, altura: 1.6, pressao: { valor: '118/76', data: '2026-10-20' } });
  });
  it('editar perfil vira medição do dia', () => {
    expect(medicoesDoPatch('ana', { peso: 60, pressao: { valor: '12/8', data: HOJE }, altura: null }, HOJE)).toEqual([
      { pessoaId: 'ana', tipo: 'peso', data: HOJE, valor: 60 },
      { pessoaId: 'ana', tipo: 'pressao', data: HOJE, valor: 120, valor2: 80 },
    ]);
  });
  it('eventos addMedicao / desfazerMedicao atualizam o perfil', () => {
    const ev = (tipo: string, dados: Record<string, unknown>, n: number): Evento => ({ id: `e${n}`, em: '2026-10-28T10:00:00Z', tipo, dados }) as Evento;
    const s = projetar([ev('addPessoa', { pessoa: ana }, 0), ev('addMedicao', { medicao: m('a', 'peso', '2026-10-01', 62) }, 1), ev('addMedicao', { medicao: m('b', 'peso', '2026-10-20', 61) }, 2)]);
    expect([s.medicoes.length, s.pessoas[0].peso]).toEqual([2, 61]);
    const s2 = projetar([ev('addPessoa', { pessoa: ana }, 0), ev('addMedicao', { medicao: m('a', 'peso', '2026-10-01', 62) }, 1), ev('addMedicao', { medicao: m('b', 'peso', '2026-10-20', 61) }, 2), ev('desfazerMedicao', { id: 'b' }, 3)]);
    expect([s2.medicoes.length, s2.pessoas[0].peso]).toEqual([1, 62]);
  });
});

describe('séries de gráficos', () => {
  it('pesagens do pet em ordem', () => {
    const ps = [{ id: '2', pessoaId: 'rex', data: '2026-10-01', kg: 12.4 }, { id: '1', pessoaId: 'rex', data: '2026-06-01', kg: 11.8 }, { id: '3', pessoaId: 'outro', data: '2026-06-01', kg: 3 }];
    expect(pontosPesagem(ps, 'rex').map((p) => p.valor)).toEqual([11.8, 12.4]);
  });
  it('adesão por semana ignora hoje e semanas sem dose prevista', () => {
    const dias = [
      { iso: '2026-10-28', tomadas: 0, previstas: 2 },
      { iso: '2026-10-27', tomadas: 2, previstas: 2 },
      { iso: '2026-10-22', tomadas: 1, previstas: 2 },
      { iso: '2026-10-20', tomadas: 2, previstas: 2 },
      { iso: '2026-10-19', tomadas: 0, previstas: 0 },
    ];
    expect(adesaoPorSemana(dias, HOJE, 3)).toEqual([
      { data: '2026-10-21', valor: 100, rotulo: '100%' },
      { data: '2026-10-28', valor: 75, rotulo: '75%' },
    ]);
  });
});

describe('anexos', () => {
  it('encaixa a foto em 2000 px mantendo a proporção', async () => {
    const { encaixar, tamanhoDataUrl } = await import('./anexos');
    expect(encaixar(4000, 3000)).toEqual([2000, 1500]);
    expect(encaixar(1200, 1600)).toEqual([1200, 1600]);
    expect(tamanhoDataUrl('data:image/jpeg;base64,AAAA')).toBe(3);
  });
  it('addAnexo é idempotente e removerAnexo tira só aquele', () => {
    const ev = (tipo: string, dados: Record<string, unknown>, n: number): Evento => ({ id: `e${n}`, em: '2026-10-28T10:00:00Z', tipo, dados }) as Evento;
    const anexo = (id: string) => ({ id, donoId: 'ex1', tipo: 'exame', nome: `${id}.jpg`, mime: 'image/jpeg', dados: 'data:image/jpeg;base64,AAAA', tamanho: 3, em: '2026-10-28T10:00:00Z' });
    const s = projetar([ev('addAnexo', { anexo: anexo('a') }, 1), ev('addAnexo', { anexo: anexo('a') }, 2), ev('addAnexo', { anexo: anexo('b') }, 3), ev('removerAnexo', { id: 'a' }, 4)]);
    expect(s.anexos.map((x) => x.id)).toEqual(['b']);
  });
});
