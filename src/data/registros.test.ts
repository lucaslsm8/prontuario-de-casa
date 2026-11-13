import { describe, expect, it } from 'vitest';
import { diffRegistro, freqDoRemedio, lerHorarios } from './formularios-puro';
import { projetar } from './store';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

const ev = (tipo: string, dados: Record<string, unknown>, n: number): Evento => ({ id: `e${n}`, em: '2026-10-28T10:00:00Z', tipo, dados }) as Evento;
const ana: Pessoa = { id: 'ana', nome: 'Ana', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [], souEu: true };
const bia: Pessoa = { id: 'bia', nome: 'Bia', curto: 'Bia', cor: '#ddd', alergias: [], condicoes: [] };
const rem = { id: 'r1', pessoaId: 'bia', nome: 'Losartana 50 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: ['08:00'], continuo: true, avisarDias: 3, lembrete: true, ativo: true, observacao: 'em jejum' };

describe('edição de registros (puro)', () => {
  it('lerHorarios ordena, normaliza e recusa lixo', () => {
    expect(lerHorarios('21h, 6:30 ;08')).toEqual(['06:30', '08:00', '21:00']);
    expect(lerHorarios('08:00, 08:00')).toEqual(['08:00']);
    expect(lerHorarios('08:00, depois')).toBeUndefined();
    expect(lerHorarios('')).toEqual([]);
  });
  it('diffRegistro só traz o que mudou e null para o que sumiu', () => {
    expect(diffRegistro<Record<string, unknown>>(rem, { ...rem, horarios: ['08:00', '20:00'], observacao: undefined })).toEqual({ horarios: ['08:00', '20:00'], observacao: null });
    expect(diffRegistro(rem, { ...rem })).toEqual({});
  });
  it('freqDoRemedio reconhece a lista e cria "outra"', () => {
    expect(freqDoRemedio({ frequencia: '1x ao dia', horarios: ['08:00'] }).id).toBe('24');
    expect(freqDoRemedio({ frequencia: '1x ao dia', horarios: ['06:30'] }).id).toBe('24');
    expect(freqDoRemedio({ horarios: ['06:30', '18:30'] })).toEqual({ id: 'outra', nome: '2x ao dia', horarios: ['06:30', '18:30'] });
    expect(freqDoRemedio({ horarios: [], seNecessario: true }).id).toBe('sn');
  });
});

describe('eventos genéricos', () => {
  const base = [ev('addPessoa', { pessoa: ana }, 0), ev('addPessoa', { pessoa: bia }, 1), ev('addRemedio', { remedio: rem }, 2)];
  it('editarRegistro aplica o patch (null apaga o campo)', () => {
    const s = projetar([...base, ev('editarRegistro', { colecao: 'remedios', id: 'r1', patch: { horarios: ['09:00'], observacao: null, id: 'outro' } }, 3)]);
    expect(s.remedios[0]).toMatchObject({ id: 'r1', horarios: ['09:00'] });
    expect(s.remedios[0]).not.toHaveProperty('observacao');
  });
  it('removerRegistro e restaurarRegistro (desfazer)', () => {
    const tirou = projetar([...base, ev('removerRegistro', { colecao: 'remedios', id: 'r1' }, 3)]);
    expect(tirou.remedios).toEqual([]);
    const voltou = projetar([...base, ev('removerRegistro', { colecao: 'remedios', id: 'r1' }, 3), ev('restaurarRegistro', { colecao: 'remedios', item: rem }, 4)]);
    expect(voltou.remedios.map((r) => r.id)).toEqual(['r1']);
  });
  it('coleção desconhecida não quebra o log', () => {
    const s = projetar([...base, ev('removerRegistro', { colecao: 'naoExiste', id: 'x' }, 3)]);
    expect(s.remedios.length).toBe(1);
  });
  it('removerPessoa leva tudo dela (a proteção de quem usa o app fica na api)', () => {
    const anexo = { id: 'a1', donoId: 'r1', tipo: 'receita', nome: 'r.jpg', mime: 'image/jpeg', dados: 'data:,', tamanho: 0, em: '' };
    const s = projetar([...base, ev('addAnexo', { anexo }, 3), ev('dose', { dose: { remedioId: 'r1', previstoPara: '2026-10-28T08:00', status: 'tomada', registradoEm: '08:01' } }, 4), ev('removerPessoa', { id: 'bia' }, 5)]);
    expect([s.pessoas.map((p) => p.id), s.remedios.length, s.doses.length, s.anexos.length]).toEqual([['ana'], 0, 0, 0]);
    expect(projetar([...base, ev('removerPessoa', { id: 'ana' }, 3)]).pessoas.map((p) => p.id)).toEqual(['bia']);
  });
  it('fotos do pet (anexo com donoId = pet) saem junto com ele', () => {
    const foto = { id: 'f1', donoId: 'bia', tipo: 'foto', nome: 'praia.jpg', mime: 'image/jpeg', dados: 'data:,', tamanho: 0, em: '' };
    expect(projetar([...base, ev('addAnexo', { anexo: foto }, 3)]).anexos.length).toBe(1);
    expect(projetar([...base, ev('addAnexo', { anexo: foto }, 3), ev('removerPessoa', { id: 'bia' }, 4)]).anexos).toEqual([]);
  });
});

describe('estoque pela dose', () => {
  const base = [ev('addPessoa', { pessoa: ana }, 0), ev('addRemedio', { remedio: { ...rem, pessoaId: 'ana', dose: '2 comp.', doseLonga: '2 comprimidos', estoque: 10 } }, 1)];
  const dose = (n: number, extra: Record<string, unknown> = {}) => ev('dose', { dose: { remedioId: 'r1', previstoPara: `2026-10-2${n}T08:00`, status: 'tomada', registradoEm: '08:01', ...extra } }, 10 + n);
  it('desconta a quantidade gravada na dose; dose antiga sem qtd desconta 1', () => {
    expect(projetar([...base, dose(1, { qtd: 2 })]).remedios[0].estoque).toBe(8);
    expect(projetar([...base, dose(1)]).remedios[0].estoque).toBe(9);
    expect(projetar([...base, dose(1, { qtd: 0.5 }), dose(2, { qtd: 0.5 })]).remedios[0].estoque).toBe(9);
  });
  it('desfazer devolve a mesma quantidade', () => {
    const s = projetar([...base, dose(1, { qtd: 2 }), ev('desfazerDose', { remedioId: 'r1', previstoPara: '2026-10-21T08:00' }, 20)]);
    expect(s.remedios[0].estoque).toBe(10);
  });
  it('comprei soma a quantidade e guarda a última compra', () => {
    const s = projetar([...base, ev('comprei', { remedioId: 'r1', qtd: 28 }, 20)]);
    expect(s.remedios[0].estoque).toBe(38);
    expect(s.remedios[0].ultimaCompra).toBe(28);
  });
});
