import { describe, expect, it } from 'vitest';
import { editaveis, estadoExemplo, podeVer, projetar } from './store';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';
import { SECOES_PET, resumoPet, agruparFamiliaPets, consultasDaFamilia, historicoPeso, novaAplicacao, proximosCuidados, reforcoVencido, ultimasVacinas, vencidaHa, descricaoPet, ehPet, familia, opcoesPessoas, pesoAtual, pets, proximaConsultaDaFamilia, proximaPrevencao, sintomasRecentes, ultimasPrevencoes, vacinasDoPet, SINAIS, TIPOS_PROCEDIMENTO, SUGESTOES_VACINA, tiposProcedimento, rotulosProcedimento, tituloProcedimento, equipeProcedimento, linhaPet, rotuloCastrado, telHref } from './pets';

const ana: Pessoa = { id: 'ana', nome: 'Ana Souza', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [], souEu: true };
const rex: Pessoa = { id: 'rex', nome: 'Rex', curto: 'Rex', cor: '#ddd', alergias: [], condicoes: [], tipo: 'pet', pet: { especie: 'cachorro', raca: 'Poodle' } };
const ev = (tipo: string, dados: Record<string, unknown>, n = 1): Evento => ({ id: `e${n}`, em: '2026-10-29T10:00:00Z', tipo, dados }) as Evento;
const base = (...mais: Evento[]) => projetar([ev('addPessoa', { pessoa: ana }, 0), ev('addPessoa', { pessoa: rex }, 1), ...mais]);

describe('eventos de pets', () => {
  it('estado base começa vazio', () => {
    const s = projetar([]);
    expect([s.vacinas, s.prevencoes, s.sintomas, s.procedimentos, s.pesagens]).toEqual([[], [], [], [], []]);
  });
  it('addVacina', () => {
    const vacina = { id: 'v1', pessoaId: 'rex', nome: 'V10', data: '2026-01-10', proxima: '2027-01-10' };
    expect(base(ev('addVacina', { vacina }, 2)).vacinas).toEqual([vacina]);
  });
  it('addPrevencao', () => {
    const prevencao = { id: 'p1', pessoaId: 'rex', tipo: 'antipulgas', produto: 'NexGard', data: '2026-10-01', intervaloDias: 30 };
    expect(base(ev('addPrevencao', { prevencao }, 2)).prevencoes).toEqual([prevencao]);
  });
  it('desfazerPrevencao remove só a prevenção com aquele id', () => {
    const p1 = { id: 'p1', pessoaId: 'rex', tipo: 'antipulgas', produto: 'NexGard', data: '2026-09-01', intervaloDias: 30 };
    const p2 = { ...p1, id: 'p2', data: '2026-10-01' };
    const s = base(ev('addPrevencao', { prevencao: p1 }, 2), ev('addPrevencao', { prevencao: p2 }, 3), ev('desfazerPrevencao', { id: 'p2' }, 4));
    expect(s.prevencoes).toEqual([p1]);
    expect(base(ev('addPrevencao', { prevencao: p1 }, 2), ev('desfazerPrevencao', { id: 'nada' }, 3)).prevencoes).toEqual([p1]);
  });
  it('evento desconhecido (de outra versão) não quebra o log', () => {
    const vacina = { id: 'v1', pessoaId: 'rex', nome: 'V10', data: '2026-01-10' };
    const s = base(ev('eventoDoFuturo', { x: 1 }, 2), ev('addVacina', { vacina }, 3));
    expect(s.pessoas.map((p) => p.id)).toEqual(['ana', 'rex']);
    expect(s.vacinas).toEqual([vacina]);
  });
  it('addSintoma', () => {
    const sintoma = { id: 's1', pessoaId: 'rex', data: '2026-10-27', sinais: ['Vômito'], nota: 'após comer grama' };
    expect(base(ev('addSintoma', { sintoma }, 2)).sintomas).toEqual([sintoma]);
  });
  it('addProcedimento', () => {
    const procedimento = { id: 'c1', pessoaId: 'rex', data: '2026-05-02', tipo: 'Castração' };
    expect(base(ev('addProcedimento', { procedimento }, 2)).procedimentos).toEqual([procedimento]);
  });
  it('addPesagem', () => {
    const pesagem = { id: 'pe1', pessoaId: 'rex', data: '2026-10-01', kg: 12.4 };
    expect(base(ev('addPesagem', { pesagem }, 2)).pesagens).toEqual([pesagem]);
  });
  it('editarPessoa aceita pet e ignora tipo', () => {
    const s = base(ev('editarPessoa', { pessoaId: 'rex', patch: { tipo: 'pessoa', pet: { especie: 'cachorro', raca: 'Poodle', castrado: true } } }, 2));
    const p = s.pessoas.find((x) => x.id === 'rex')!;
    expect(p.tipo).toBe('pet');
    expect(p.pet).toEqual({ especie: 'cachorro', raca: 'Poodle', castrado: true });
  });
});

describe('seletores', () => {
  const s = base(
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-09-01', kg: 12 } }, 2),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-10-01', kg: 12.5 } }, 3),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-07-01', kg: 11 } }, 4),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'ana', data: '2026-10-05', kg: 60 } }, 5),
  );
  it('família e pets', () => {
    expect(ehPet(rex)).toBe(true);
    expect(ehPet(ana)).toBe(false);
    expect(familia(s).map((p) => p.id)).toEqual(['ana']);
    expect(pets(s).map((p) => p.id)).toEqual(['rex']);
  });
  it('pets na ordem de cadastro', () => {
    const t = base(ev('addPessoa', { pessoa: { ...rex, id: 'bob' } }, 2));
    expect(pets(t).map((p) => p.id)).toEqual(['rex', 'bob']);
  });
  it('ultimasVacinas agrupa por nome sem diferenciar caixa nem espaços', () => {
    const s = base(
      ev('addVacina', { vacina: { id: 'a', pessoaId: 'rex', nome: 'V10', data: '2025-01-10' } }, 2),
      ev('addVacina', { vacina: { id: 'b', pessoaId: 'rex', nome: ' v10 ', data: '2026-01-10' } }, 3),
    );
    expect(ultimasVacinas(s, 'rex').map((v) => v.id)).toEqual(['b']);
  });
  it('pesoAtual é a pesagem de data mais recente', () => {
    expect(pesoAtual(s, 'rex')).toEqual({ id: 'pe', pessoaId: 'rex', data: '2026-10-01', kg: 12.5 });
    expect(pesoAtual(s, 'nada')).toBeUndefined();
  });
  it('proximaPrevencao soma intervalo à data', () => {
    const p = { id: 'p', pessoaId: 'rex', tipo: 'antipulgas' as const, produto: 'X', data: '2026-10-20', intervaloDias: 30 };
    expect(proximaPrevencao(p)).toBe('2026-11-19');
    expect(proximaPrevencao({ ...p, data: '2026-12-15', intervaloDias: 30 })).toBe('2027-01-14');
    expect(proximaPrevencao({ ...p, data: '2028-02-28', intervaloDias: 1 })).toBe('2028-02-29');
  });
  it('ultimasPrevencoes: a mais recente por tipo (outro: por produto)', () => {
    const mk = (id: string, tipo: string, produto: string, data: string) => ({ id, pessoaId: 'rex', tipo, produto, data, intervaloDias: 30 });
    const t = base(
      ev('addPrevencao', { prevencao: mk('a', 'antipulgas', 'NexGard', '2026-08-01') }, 2),
      ev('addPrevencao', { prevencao: mk('b', 'antipulgas', 'NexGard', '2026-09-01') }, 3),
      ev('addPrevencao', { prevencao: mk('c', 'vermifugo', 'Drontal', '2026-07-01') }, 4),
      ev('addPrevencao', { prevencao: mk('d', 'antipulgas', 'Bravecto', '2026-06-01') }, 5),
      ev('addPrevencao', { prevencao: { ...mk('e', 'vermifugo', 'Drontal', '2026-10-01'), pessoaId: 'outro' } }, 6),
      ev('addPrevencao', { prevencao: mk('f', 'outro', 'Banho', '2026-09-01') }, 7),
      ev('addPrevencao', { prevencao: mk('g', 'outro', 'Tosa', '2026-08-01') }, 8),
    );
    // "d" (Bravecto, mais antigo) foi substituído por NexGard, do mesmo tipo.
    expect(ultimasPrevencoes(t, 'rex').map((p) => p.id).sort()).toEqual(['b', 'c', 'f', 'g']);
  });
  it('vacinasDoPet filtra e ordena por data (mais recente primeiro)', () => {
    const v = (id: string, pessoaId: string, data: string) => ({ id, pessoaId, nome: 'V10', data });
    const t = base(
      ev('addVacina', { vacina: v('a', 'rex', '2025-01-01') }, 2),
      ev('addVacina', { vacina: v('b', 'rex', '2026-01-01') }, 3),
      ev('addVacina', { vacina: v('c', 'ana', '2026-02-01') }, 4),
    );
    expect(vacinasDoPet(t, 'rex').map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('sintomasRecentes respeita a janela de dias', () => {
    const sn = (id: string, data: string) => ({ id, pessoaId: 'rex', data, sinais: ['Tosse'] });
    const t = base(
      ev('addSintoma', { sintoma: sn('a', '2026-10-28') }, 2),
      ev('addSintoma', { sintoma: sn('b', '2026-09-28') }, 3),
      ev('addSintoma', { sintoma: sn('c', '2026-09-27') }, 4),
      ev('addSintoma', { sintoma: { ...sn('d', '2026-10-28'), pessoaId: 'ana' } }, 5),
    );
    expect(sintomasRecentes(t, 'rex', 30, '2026-10-28').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('listas fixas', () => {
    expect(SINAIS).toEqual(['Vômito', 'Diarreia', 'Coceira', 'Apatia', 'Falta de apetite', 'Tosse', 'Mancando', 'Outro']);
    expect(TIPOS_PROCEDIMENTO).toEqual(['Cirurgia', 'Castração', 'Limpeza de tártaro', 'Exame de imagem', 'Outro']);
    expect(SUGESTOES_VACINA).toEqual(['V8', 'V10', 'Antirrábica', 'Gripe canina', 'Giárdia', 'Leishmaniose']);
  });
  it('procedimentos de pessoa e de pet', () => {
    const pet = { tipo: 'pet' } as Pessoa;
    const gente = { tipo: 'pessoa' } as Pessoa;
    expect(tiposProcedimento(pet)).toEqual([...TIPOS_PROCEDIMENTO]);
    expect(tiposProcedimento(gente)).toEqual(['Cirurgia', 'Endoscopia', 'Colonoscopia', 'Biópsia', 'Odontológico', 'Exame de imagem', 'Outro']);
    // Na edição, o tipo já salvo continua na lista (antes de "Outro").
    expect(tiposProcedimento(gente, 'Castração')).toEqual(['Cirurgia', 'Endoscopia', 'Colonoscopia', 'Biópsia', 'Odontológico', 'Exame de imagem', 'Castração', 'Outro']);
    expect(rotulosProcedimento(pet).medico).toBe('Veterinário');
    expect(rotulosProcedimento(gente).medico).toBe('Médico');
    const proc = { id: 'p', pessoaId: 'x', data: '2026-01-02', tipo: 'Cirurgia' as const, descricao: 'Joelho' };
    expect(tituloProcedimento(proc)).toBe('Cirurgia · Joelho');
    expect(equipeProcedimento(proc)).toBeUndefined();
    expect(equipeProcedimento({ ...proc, medico: 'Dr. A', anestesista: 'Dra. B' })).toBe('Dr. A · anestesia: Dra. B');
    expect(equipeProcedimento({ ...proc, anestesista: 'Dra. B' })).toBe('anestesia: Dra. B');
  });
});

describe('permissões de pets', () => {
  it('pets são visíveis e editáveis por todos, sem compartilhamento', () => {
    const s = base();
    for (const c of ['perfil', 'remedios', 'consultas', 'exames', 'plano'] as const) expect(podeVer(s, 'rex', c)).toBe(true);
    expect(editaveis(s).map((p) => p.id)).toContain('rex');
  });
  it('pet continua visível e editável mesmo com um compartilhamento vazio dele', () => {
    // Sem a regra dos pets, `de: rex` com nada compartilhado o tiraria de `editaveis` e de `podeVer`.
    const s = { ...base(), compartilhamentos: [{ de: 'rex', para: 'ana', categorias: [] as never[] }] };
    expect(editaveis(s).map((p) => p.id)).toContain('rex');
    expect(podeVer(s, 'rex', 'remedios')).toBe(true);
  });
  it('dependente sem compartilhamento próprio (sem aparelho) fica visível para a família', () => {
    const s = estadoExemplo();
    const vo = { ...s.pessoas.find((p) => p.id === 'roberto')!, id: 'vo', souEu: undefined };
    const comVo = { ...s, pessoas: [...s.pessoas, vo], papeis: [] };
    expect(podeVer(comVo, 'vo', 'exames')).toBe(true);
    // Quem já definiu o que compartilha segue a própria escolha (sem papel de cuidador ou administrador).
    expect(podeVer(comVo, 'pedro', 'exames')).toBe(false);
  });
  it('exemplo traz Mel e Thor', () => {
    const s = estadoExemplo();
    expect(pets(s).map((p) => p.id)).toEqual(['mel', 'thor']);
    expect(familia(s).length).toBe(3);
    for (const id of ['mel', 'thor']) {
      expect(vacinasDoPet(s, id).length).toBe(2);
      expect(s.prevencoes.filter((p) => p.pessoaId === id).length).toBe(1);
      expect(pesoAtual(s, id)).toBeDefined();
    }
    expect(s.sintomas.map((x) => x.pessoaId)).toEqual(['mel']);
    expect(s.procedimentos.map((x) => x.pessoaId + ':' + x.tipo)).toEqual(['thor:Castração', 'roberto:Colonoscopia']);
    expect(podeVer(s, 'mel', 'exames')).toBe(true);
  });
});

describe('agrupamento família / pets', () => {
  const s = base(ev('addPessoa', { pessoa: { ...ana, id: 'bia', souEu: undefined } }, 2), ev('addPessoa', { pessoa: { ...rex, id: 'luna' } }, 3));
  it('família primeiro, pets depois, mantendo a ordem de cada grupo', () => {
    const itens = [{ id: 1, pessoaId: 'rex' }, { id: 2, pessoaId: 'ana' }, { id: 3, pessoaId: 'luna' }, { id: 4, pessoaId: 'bia' }, { id: 5, pessoaId: 'rex' }];
    const g = agruparFamiliaPets(itens, s);
    expect(g.familia.map((x) => x.id)).toEqual([2, 4]);
    expect(g.pets.map((x) => x.id)).toEqual([1, 3, 5]);
  });
  it('sem itens de pets, o grupo de pets fica vazio', () => {
    expect(agruparFamiliaPets([{ pessoaId: 'ana' }], s).pets).toEqual([]);
    expect(agruparFamiliaPets([], s)).toEqual({ familia: [], pets: [] });
  });
  it('aceita um seletor de pessoa', () => {
    const g = agruparFamiliaPets([{ quem: { id: 'luna' } }, { quem: { id: 'ana' } }], s, (x) => x.quem.id);
    expect(g.familia.map((x) => x.quem.id)).toEqual(['ana']);
    expect(g.pets.map((x) => x.quem.id)).toEqual(['luna']);
  });
  it('id desconhecido conta como família', () => {
    expect(agruparFamiliaPets([{ pessoaId: 'sumiu' }], s).familia.length).toBe(1);
  });
  it('opções do "Para quem": pessoas, separador, pets', () => {
    const o = opcoesPessoas(s.pessoas, (p) => p.curto);
    expect(o.opcoes.map((x) => x.id)).toEqual(['ana', 'bia', 'rex', 'luna']);
    expect(o.separarAntes).toBe(2);
    expect(opcoesPessoas(s.pessoas.filter((p) => !p.tipo), (p) => p.curto).separarAntes).toBeUndefined();
  });
  it('descrição do pet', () => {
    expect(descricaoPet({ ...rex, nascimento: '2022-03-01' })).toBe('Cachorro · Poodle · 4 anos');
    expect(descricaoPet({ ...rex, pet: { especie: 'cachorro' } })).toBe('Cachorro');
  });
});

describe('consultas da família', () => {
  const c = (id: string, pessoaId: string, data: string, tipo: 'consulta' | 'exame' = 'consulta') =>
    ({ id, tipo, pessoaId, titulo: id, data, hora: '10:00', levar: [], lembretes: [] });
  const s = base(
    ev('addConsulta', { consulta: c('vet', 'rex', '2026-10-30') }, 2),
    ev('addConsulta', { consulta: c('lab', 'ana', '2026-10-31', 'exame') }, 3),
    ev('addConsulta', { consulta: c('cardio', 'ana', '2026-11-05') }, 4),
    ev('addConsulta', { consulta: c('antiga', 'ana', '2026-10-01') }, 5),
  );
  it('ignora os pets e ordena por data', () => expect(consultasDaFamilia(s).map((x) => x.id)).toEqual(['antiga', 'lab', 'cardio']));
  it('próxima consulta: só pessoas, só consultas, de hoje em diante', () => expect(proximaConsultaDaFamilia(s, '2026-10-29')?.id).toBe('cardio'));
  it('sem consulta futura da família', () => expect(proximaConsultaDaFamilia(s, '2026-11-06')).toBeUndefined());
  it('no exemplo, a consulta da Mel não é a próxima', () => expect(proximaConsultaDaFamilia(estadoExemplo())?.pessoaId).not.toBe('mel'));
});

describe('perfil do pet', () => {
  const vac = (id: string, nome: string, data: string, proxima?: string) => ({ id, pessoaId: 'rex', nome, data, proxima });
  const s = base(
    ev('addVacina', { vacina: vac('v1', 'V10', '2025-10-01', '2026-10-01') }, 2),
    ev('addVacina', { vacina: vac('v2', 'V10', '2026-10-05', '2027-10-05') }, 3),
    ev('addVacina', { vacina: vac('v3', 'Gripe canina', '2025-10-20', '2026-10-20') }, 4),
    ev('addVacina', { vacina: vac('v4', 'Giárdia', '2026-01-10') }, 5),
    ev('addPrevencao', { prevencao: { id: 'p1', pessoaId: 'rex', tipo: 'antipulgas', produto: 'NexGard', data: '2026-10-10', intervaloDias: 30 } }, 6),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-04-10', kg: 18.6 } }, 7),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-10-10', kg: 19.2 } }, 8),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-10-20', kg: 19 } }, 9),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'rex', data: '2026-10-28', kg: 19 } }, 10),
  );
  const HOJE = '2026-10-29';
  it('última dose de cada vacina', () => expect(ultimasVacinas(s, 'rex').map((v) => v.id)).toEqual(['v2', 'v4', 'v3']));
  it('reforço vencido só na dose mais recente', () => {
    const [v1, , v3] = s.vacinas;
    expect(reforcoVencido(s, v1, HOJE)).toBe(false);
    expect(reforcoVencido(s, v3, HOJE)).toBe(true);
  });
  it('próximos cuidados: vacinas e prevenções por data, vencidos marcados', () => {
    expect(proximosCuidados(s, 'rex', HOJE)).toEqual([
      { chave: 'vacina|v3', titulo: 'Gripe canina', sub: 'Reforço de vacina', data: '2026-10-20', vencido: true },
      { chave: 'prevencao|p1', titulo: 'NexGard', sub: 'Antipulgas', data: '2026-11-09', vencido: false },
      { chave: 'vacina|v2', titulo: 'V10', sub: 'Reforço de vacina', data: '2027-10-05', vencido: false },
    ]);
  });
  it('vencida há N dias', () => {
    expect(vencidaHa('2026-10-20', HOJE)).toBe('vencida há 9 dias');
    expect(vencidaHa('2026-10-28', HOJE)).toBe('vencida há 1 dia');
  });
  it('nova aplicação repete tipo, produto e intervalo', () => {
    expect(novaAplicacao(s.prevencoes[0], 'p2', HOJE)).toEqual({ id: 'p2', pessoaId: 'rex', tipo: 'antipulgas', produto: 'NexGard', data: HOJE, intervaloDias: 30 });
  });
  it('histórico de peso: mais recente primeiro, com a diferença', () => {
    expect(historicoPeso(s, 'rex').map((h) => [h.pesagem.data, h.delta])).toEqual([
      ['2026-10-28', 'sem mudança'], ['2026-10-20', '−0,2 kg'], ['2026-10-10', '+0,6 kg'], ['2026-04-10', undefined],
    ]);
  });
});

describe('cabeçalho do perfil do pet', () => {
  it('linhaPet: espécie, raça, sexo e idade numa linha só (nascimento só quando pedido)', () => {
    const mel = { ...rex, sexo: 'Feminino' as const, nascimento: '2022-03-01' };
    expect(linhaPet(mel)).toBe('Cachorro · Poodle · Fêmea · 4 anos');
    expect(linhaPet(mel, true)).toBe('Cachorro · Poodle · Fêmea · 4 anos · nasc. 01/03/2022');
    expect(linhaPet({ ...rex, pet: { especie: 'cachorro' } })).toBe('Cachorro');
  });
  it('rotuloCastrado segue o sexo; telHref deixa só dígitos e +', () => {
    expect(rotuloCastrado({ ...rex, sexo: 'Feminino' })).toBe('Castrada');
    expect(rotuloCastrado({ ...rex, sexo: 'Masculino' })).toBe('Castrado');
    expect(rotuloCastrado(rex)).toBe('Castrado(a)');
    expect(telHref('+55 (11) 3456-7890')).toBe('tel:+551134567890');
  });
});

describe('resumo para consulta veterinária', () => {
  const HOJE = '2026-10-29';
  const luna: Pessoa = {
    ...rex, id: 'luna', nome: 'Luna', curto: 'Luna', sexo: 'Feminino', nascimento: '2022-03-01',
    alergias: [{ substancia: 'Dipirona', reacao: 'Coceira e inchaço' }],
    pet: { especie: 'cachorro', raca: 'Poodle', castrado: true, microchip: '985 112 004 218 733' },
  };
  const s = projetar([
    ev('addPessoa', { pessoa: ana }, 0),
    ev('addPessoa', { pessoa: luna }, 1),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'luna', data: '2026-01-10', kg: 11 } }, 2),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'luna', data: '2026-04-10', kg: 11.8 } }, 3),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'luna', data: '2026-10-10', kg: 12.4 } }, 4),
    ev('addPesagem', { pesagem: { id: 'pe', pessoaId: 'luna', data: '2026-07-10', kg: 12 } }, 5),
    ev('addVacina', { vacina: { id: 'v1', pessoaId: 'luna', nome: 'V10', data: '2025-10-05', proxima: '2026-10-05' } }, 6),
    ev('addVacina', { vacina: { id: 'v2', pessoaId: 'luna', nome: 'V10', data: '2026-10-05', proxima: '2027-10-05' } }, 7),
    ev('addVacina', { vacina: { id: 'v3', pessoaId: 'luna', nome: 'Gripe canina', data: '2025-10-20', proxima: '2026-10-20' } }, 8),
    ev('addVacina', { vacina: { id: 'v4', pessoaId: 'luna', nome: 'Giárdia', data: '2026-02-01' } }, 9),
    ev('addPrevencao', { prevencao: { id: 'p1', pessoaId: 'luna', tipo: 'antipulgas', produto: 'NexGard', data: '2026-10-10', intervaloDias: 30 } }, 10),
    ev('addPrevencao', { prevencao: { id: 'p2', pessoaId: 'luna', tipo: 'vermifugo', produto: ' ', data: '2026-06-01', intervaloDias: 90 } }, 11),
    ev('addSintoma', { sintoma: { id: 's1', pessoaId: 'luna', data: '2026-10-27', sinais: ['Vômito', 'Apatia'], nota: 'Comeu grama' } }, 12),
    ev('addSintoma', { sintoma: { id: 's2', pessoaId: 'luna', data: '2026-08-01', sinais: ['Tosse'] } }, 13),
    ev('addProcedimento', { procedimento: { id: 'c1', pessoaId: 'luna', data: '2023-03-18', tipo: 'Castração', clinica: 'Vida Animal' } }, 14),
    ev('addProcedimento', { procedimento: { id: 'c2', pessoaId: 'luna', data: '2025-05-02', tipo: 'Limpeza de tártaro' } }, 15),
  ]);
  const r = resumoPet(s, s.pessoas.find((x) => x.id === 'luna')!, HOJE);

  it('seções do pet, na ordem da spec', () => {
    expect(SECOES_PET.map((x) => x.nome)).toEqual([
      'Identificação do pet', 'Peso', 'Alergias', 'Remédios em uso', 'Vacinas', 'Prevenção', 'Sintomas (30 dias)', 'Procedimentos',
    ]);
  });
  it('identificação: espécie, raça, sexo, idade; castração e microchip', () => {
    expect(r.identificacao).toEqual(['Cachorro · Poodle · Fêmea · 4 anos', 'Castrada · microchip 985 112 004 218 733']);
    const semDados = resumoPet(s, { ...luna, pet: { especie: 'cachorro', castrado: false } }, HOJE);
    expect(semDados.identificacao).toEqual(['Cachorro · Fêmea · 4 anos', 'Não castrada']);
    expect(resumoPet(s, { ...luna, pet: { especie: 'cachorro' } }, HOJE).identificacao).toEqual(['Cachorro · Fêmea · 4 anos']);
  });
  it('peso: as 3 últimas pesagens com data', () => {
    expect(r.peso).toEqual(['12,4 kg · 10/10/2026', '12 kg · 10/07/2026', '11,8 kg · 10/04/2026']);
  });
  it('alergias no formato do resumo', () => {
    expect(r.alergias).toEqual(['Dipirona (coceira, inchaço)']);
  });
  it('vacinas: a última de cada uma, com o próximo reforço (vencido marcado)', () => {
    expect(r.vacinas).toEqual([
      'V10 · aplicada em 05/10/2026 · reforço 05/10/2027',
      'Giárdia · aplicada em 01/02/2026',
      'Gripe canina · aplicada em 20/10/2025 · reforço vencido em 20/10/2026',
    ]);
  });
  it('prevenção: a última de cada tipo, com a próxima (mesmo nome do perfil)', () => {
    expect(r.prevencao).toEqual([
      'Vermífugo · aplicado em 01/06/2026 · próxima vencida em 30/08/2026',
      'NexGard (antipulgas) · aplicado em 10/10/2026 · próxima 09/11/2026',
    ]);
  });
  it('sintomas só dos últimos 30 dias', () => {
    expect(r.sintomas).toEqual(['27/10 · Vômito, Apatia · Comeu grama']);
  });
  it('procedimentos do mais recente para o mais antigo', () => {
    expect(r.procedimentos).toEqual(['Limpeza de tártaro · 02/05/2025', 'Castração · 18/03/2023 · Vida Animal']);
  });
});
