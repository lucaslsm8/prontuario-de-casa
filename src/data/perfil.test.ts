import { describe, expect, it } from 'vitest';
import { numCurto } from './format';
import { diffPessoa, formDePessoa, lerNumeroBR, pessoaDoForm, recorteQuadrado, type FormPerfil } from './perfil';
import { projetar } from './store';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

const base: Pessoa = { id: 'ana', nome: 'Ana Souza', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [], souEu: true };
const ev = (tipo: string, dados: Record<string, unknown>, n = 1): Evento => ({ id: `e${n}`, em: '2026-10-29T10:00:00Z', tipo, dados }) as Evento;
const comPessoa = (...mais: Evento[]) => projetar([ev('addPessoa', { pessoa: base }, 0), ...mais]);

describe('evento editarPessoa', () => {
  it('aplica campo a campo', () => {
    const s = comPessoa(ev('editarPessoa', { pessoaId: 'ana', patch: { curto: 'Aninha', peso: 60, foto: 'data:image/jpeg;base64,AA' } }));
    expect(s.pessoas[0]).toMatchObject({ curto: 'Aninha', peso: 60, nome: 'Ana Souza', foto: 'data:image/jpeg;base64,AA' });
  });
  it('foto null remove a foto', () => {
    const s = comPessoa(
      ev('editarPessoa', { pessoaId: 'ana', patch: { foto: 'data:x' } }, 1),
      ev('editarPessoa', { pessoaId: 'ana', patch: { foto: null } }, 2),
    );
    expect('foto' in s.pessoas[0]).toBe(false);
  });
  it('ignora id e souEu', () => {
    const s = comPessoa(ev('editarPessoa', { pessoaId: 'ana', patch: { id: 'x', souEu: false, curto: 'B' } }));
    expect(s.pessoas[0]).toMatchObject({ id: 'ana', souEu: true, curto: 'B' });
  });
  it('não mexe em outras pessoas', () => {
    const outra = { ...base, id: 'bia', souEu: false };
    const s = projetar([ev('addPessoa', { pessoa: base }, 0), ev('addPessoa', { pessoa: outra }, 1), ev('editarPessoa', { pessoaId: 'bia', patch: { curto: 'Bi' } }, 2)]);
    expect(s.pessoas.map((p) => p.curto)).toEqual(['Ana', 'Bi']);
  });
});

describe('remoção com null', () => {
  const viaJson = (e: Evento) => JSON.parse(JSON.stringify(e)) as Evento;
  it('patch null remove o campo e sobrevive ao JSON', () => {
    const s = projetar([ev('addPessoa', { pessoa: { ...base, peso: 60 } }, 0), viaJson(ev('editarPessoa', { pessoaId: 'ana', patch: { peso: null } }, 1))]);
    expect('peso' in s.pessoas[0]).toBe(false);
  });
  it('foto undefined não muda nada', () => {
    const s = comPessoa(ev('editarPessoa', { pessoaId: 'ana', patch: { foto: undefined } }));
    expect(s.pessoas[0]).toEqual(base);
  });
  it('pessoaId desconhecido é no-op', () => {
    const s = comPessoa(ev('editarPessoa', { pessoaId: 'zzz', patch: { curto: 'X' } }));
    expect(s.pessoas).toEqual([base]);
  });
  it('null em campo obrigatório é ignorado', () => {
    const s = comPessoa(ev('editarPessoa', { pessoaId: 'ana', patch: { nome: null, curto: null, cor: null } }));
    expect(s.pessoas[0]).toMatchObject({ nome: 'Ana Souza', curto: 'Ana', cor: '#ccc' });
  });
  it('null em alergias e condições vira lista vazia', () => {
    const s = projetar([ev('addPessoa', { pessoa: { ...base, alergias: ['Dipirona'], condicoes: ['Asma'] } }, 0), ev('editarPessoa', { pessoaId: 'ana', patch: { alergias: null, condicoes: null } }, 1)]);
    expect(s.pessoas[0]).toMatchObject({ alergias: [], condicoes: [] });
  });
  it('diffPessoa emite null para campo removido', () => {
    expect(diffPessoa({ ...base, peso: 60 }, base)).toEqual({ peso: null });
  });
});

describe('recorteQuadrado', () => {
  it('centraliza em paisagem', () => expect(recorteQuadrado(400, 200)).toEqual({ sx: 100, sy: 0, lado: 200 }));
  it('centraliza em retrato', () => expect(recorteQuadrado(200, 400)).toEqual({ sx: 0, sy: 100, lado: 200 }));
  it('quadrada', () => expect(recorteQuadrado(300, 300)).toEqual({ sx: 0, sy: 0, lado: 300 }));
});

describe('diffPessoa', () => {
  it('só campos alterados', () => {
    expect(diffPessoa(base, { ...base, peso: 70, curto: 'A' })).toEqual({ peso: 70, curto: 'A' });
  });
  it('sem mudanças é vazio', () => expect(diffPessoa(base, { ...base })).toEqual({}));
  it('compara arrays e objetos em profundidade', () => {
    const a = { ...base, alergias: [{ substancia: 'Dipirona' }], pressao: { valor: '12/8', data: '2026-10-01' } };
    expect(diffPessoa(a, { ...a, alergias: [{ substancia: 'Dipirona' }], pressao: { valor: '12/8', data: '2026-10-01' } })).toEqual({});
    expect(diffPessoa(a, { ...a, alergias: [{ substancia: 'Dipirona' }, { substancia: 'Pó' }] })).toEqual({ alergias: [{ substancia: 'Dipirona' }, { substancia: 'Pó' }] });
  });
  it('foto removida vira null', () => {
    expect(diffPessoa({ ...base, foto: 'data:x' }, { ...base })).toEqual({ foto: null });
  });
  it('foto nova entra', () => expect(diffPessoa(base, { ...base, foto: 'data:y' })).toEqual({ foto: 'data:y' }));
});

describe('lerNumeroBR', () => {
  it.each([['1,74', 1.74], ['1,74 m', 1.74], ['72', 72], ['72,5 kg', 72.5], ['1.74', 1.74]])('%s', (t, n) => expect(lerNumeroBR(t)).toBe(n));
  it.each([[''], ['  '], ['abc'], ['-5'], ['0'], ['72abc']])('%j inválido', (t) => expect(lerNumeroBR(t)).toBeUndefined());
});

describe('formulário do perfil', () => {
  const roberto: Pessoa = {
    id: 'roberto', nome: 'Roberto Carlos Almeida', curto: 'Roberto', nascimento: '1965-02-14', sexo: 'Masculino',
    sangue: 'A+', peso: 82.5, altura: 1.74, pressao: { valor: '130/80', data: '2026-10-20' }, cor: '#ccc',
    alergias: [{ substancia: 'Penicilina', reacao: 'Urticária', ano: 2009 }],
    condicoes: [{ nome: 'Hipertensão', desde: '2018', tipo: 'condicao', nomeClinico: 'HAS' }],
    contatoEmergencia: { nome: 'Helena', relacao: 'Esposa', telefone: '(11) 98765-4321' },
  };
  const HOJE = '2026-10-29';
  const salvar = (mudar: (f: FormPerfil) => FormPerfil, p = roberto) => pessoaDoForm(p, mudar(formDePessoa(p)), HOJE);

  it('sem mudanças, o diff fica vazio', () => {
    const r = salvar((f) => f);
    expect(r.erros).toEqual({});
    expect(diffPessoa(roberto, r.pessoa!)).toEqual({});
  });
  it('mostra peso e altura no formato BR', () => {
    expect(formDePessoa(roberto)).toMatchObject({ peso: '82,5', altura: '1,74', nasc: '14/02/1965', pressao: '130/80' });
  });
  it('altura: cm de 100 a 250 vira metros; metros de 0,3 a 3; o resto é erro', () => {
    const altura = (v: string) => salvar((f) => ({ ...f, altura: v }));
    expect(altura('174').pessoa!.altura).toBe(1.74);
    expect(altura('1,74').pessoa!.altura).toBe(1.74);
    for (const v of ['17,4', '5', '3,5', '0,2']) expect(altura(v).erros.altura, v).toBe('Use metros, como 1,74.');
  });
  it('lê peso e altura BR; altura em cm vira metros', () => {
    const r = salvar((f) => ({ ...f, peso: '80', altura: '176' }));
    expect(diffPessoa(roberto, r.pessoa!)).toEqual({ peso: 80, altura: 1.76 });
  });
  it('valida nome, nascimento, números e contato', () => {
    const r = salvar((f) => ({ ...f, nome: ' ', nasc: '31/02/1965', peso: 'oitenta', altura: '1,7,4', contato: { nome: 'Helena', relacao: '', telefone: '' } }));
    expect(r.pessoa).toBeUndefined();
    expect(Object.keys(r.erros).sort()).toEqual(['altura', 'contato', 'nasc', 'nome', 'peso']);
  });
  it('campos vazios removem o valor', () => {
    const r = salvar((f) => ({ ...f, sangue: 'nao-sei', peso: '', pressao: '', sexo: '', contato: { nome: '', relacao: '', telefone: '' } }));
    expect(diffPessoa(roberto, r.pessoa!)).toEqual({ sexo: null, sangue: null, peso: null, pressao: null, contatoEmergencia: null });
  });
  it('pressão nova leva a data de hoje', () => {
    expect(salvar((f) => ({ ...f, pressao: '120/80' })).pessoa!.pressao).toEqual({ valor: '120/80', data: HOJE });
  });
  it('listas: linhas vazias somem, campos ocultos ficam, novas entram', () => {
    const r = salvar((f) => ({
      ...f,
      alergias: [{ ...f.alergias[0], reacao: 'Urticária forte' }, { chave: 'n1', substancia: ' ', reacao: 'x' }, { chave: 'n2', substancia: 'Dipirona', reacao: '' }],
      condicoes: [],
    }));
    expect(r.pessoa!.alergias).toEqual([{ substancia: 'Penicilina', reacao: 'Urticária forte', ano: 2009 }, { substancia: 'Dipirona' }]);
    expect(diffPessoa(roberto, r.pessoa!)).toEqual({ alergias: r.pessoa!.alergias, condicoes: [] });
  });
  it('trocar o nome atualiza o curto se ele era o primeiro nome', () => {
    expect(salvar((f) => ({ ...f, nome: 'Roberto  Almeida' })).pessoa).toMatchObject({ nome: 'Roberto Almeida', curto: 'Roberto' });
    expect(salvar((f) => ({ ...f, nome: 'Roberto Almeida' }), { ...roberto, curto: 'Tonico' }).pessoa!.curto).toBe('Tonico');
  });
  it('remover a foto vira null no diff', () => {
    const r = salvar((f) => ({ ...f, foto: undefined }), { ...roberto, foto: 'data:x' });
    expect(diffPessoa({ ...roberto, foto: 'data:x' }, r.pessoa!)).toEqual({ foto: null });
  });
});

describe('numCurto', () => {
  it('inteiro sem casas', () => expect(numCurto(72)).toBe('72'));
  it('decimal com vírgula', () => expect(numCurto(72.5)).toBe('72,5'));
});

describe('formulário do perfil do pet', () => {
  const mel: Pessoa = {
    id: 'mel', nome: 'Mel', curto: 'Mel', nascimento: '2020-03-15', sexo: 'Feminino', cor: '#ccc', peso: 19,
    alergias: [{ substancia: 'Frango' }], condicoes: [], tipo: 'pet',
    pet: {
      especie: 'cachorro', raca: 'Vira-lata', castrado: true, microchip: '985 112',
      veterinario: { nome: 'Dra. Camila', clinica: 'Vida Animal', telefone: '(11) 3456-7890' },
      clinica24h: { nome: 'Pronto Pet', telefone: '(11) 3555-0100' },
    },
  };
  const HOJE = '2026-10-29';
  const salvar = (mudar: (f: FormPerfil) => FormPerfil, p = mel) => pessoaDoForm(p, mudar(formDePessoa(p)), HOJE);
  const mudarPet = (f: FormPerfil, m: Partial<NonNullable<FormPerfil['pet']>>) => ({ ...f, pet: { ...f.pet!, ...m } });

  it('carrega os campos do pet', () => {
    expect(formDePessoa(mel).pet).toEqual({
      raca: 'Vira-lata', castrado: true, microchip: '985 112',
      veterinario: { nome: 'Dra. Camila', clinica: 'Vida Animal', telefone: '(11) 3456-7890' },
      clinica24h: { nome: 'Pronto Pet', telefone: '(11) 3555-0100' },
    });
  });
  it('pessoa não tem campos de pet', () => expect(formDePessoa(base).pet).toBeUndefined());
  it('sem mudanças, o diff fica vazio', () => {
    const r = salvar((f) => f);
    expect(r.erros).toEqual({});
    expect(diffPessoa(mel, r.pessoa!)).toEqual({});
  });
  it('pet sem dados extras continua sem diff (castrado ausente não vira false)', () => {
    const rex: Pessoa = { id: 'rex', nome: 'Rex', curto: 'Rex', cor: '#ddd', alergias: [], condicoes: [], tipo: 'pet', pet: { especie: 'cachorro' } };
    expect(diffPessoa(rex, salvar((f) => f, rex).pessoa!)).toEqual({});
  });
  it('não mexe em peso, sangue, altura, pressão nem contato', () => {
    const comHumanos = { ...mel, sangue: 'DEA 1.1+', altura: 0.5 };
    const r = salvar((f) => ({ ...f, peso: 'x', altura: 'x', contato: { nome: 'a', relacao: '', telefone: '' } }), comHumanos);
    expect(r.erros).toEqual({});
    expect(diffPessoa(comHumanos, r.pessoa!)).toEqual({});
  });
  it('edita raça, castrado, microchip, veterinário e clínica', () => {
    const r = salvar((f) => mudarPet(f, {
      raca: ' Border  Collie ', castrado: false, microchip: '',
      veterinario: { nome: 'Dr. Leo', clinica: '', telefone: '' },
      clinica24h: { nome: '', telefone: '' },
    }));
    expect(diffPessoa(mel, r.pessoa!)).toEqual({
      pet: { especie: 'cachorro', raca: 'Border Collie', castrado: false, veterinario: { nome: 'Dr. Leo' } },
    });
  });
  it('sexo e alergias valem como nas pessoas', () => {
    const r = salvar((f) => ({ ...f, sexo: 'Masculino', alergias: [] }));
    expect(diffPessoa(mel, r.pessoa!)).toEqual({ sexo: 'Masculino', alergias: [] });
  });
  it('veterinário sem nome e clínica 24 h incompleta são erro', () => {
    const r = salvar((f) => mudarPet(f, { veterinario: { nome: '', clinica: 'X', telefone: '' }, clinica24h: { nome: 'Pronto', telefone: '' } }));
    expect(r.pessoa).toBeUndefined();
    expect(r.erros).toEqual({ veterinario: 'Informe o nome do veterinário.', clinica24h: 'Informe nome e telefone da clínica.' });
  });
});
