import { describe, expect, it } from 'vitest';
import { brParaISO, nomeComDosagem, partesDoRemedio, dataDoReforco, isoParaBR, juntarDataHora, lerDataHora, lerDataRegistro, lerIntervaloDias, lerNascimento, lerReforco, mascaraData, normalizarHora, somarAnos, somarDias, somarMeses, mascaraValidade, montarPlano, type FormPlano } from './formularios-puro';

const HOJE = '2026-10-28';

describe('lerDataHora', () => {
  it('aceita "18/11 · 14:00" e usa o ano de hoje', () => {
    expect(lerDataHora('18/11 · 14:00', HOJE)).toEqual({ data: '2026-11-18', hora: '14:00' });
  });
  it('aceita ano explícito', () => {
    expect(lerDataHora('18/11/2027 14:00', HOJE)).toEqual({ data: '2027-11-18', hora: '14:00' });
    expect(lerDataHora('18/11/2026 14:00', HOJE)).toEqual({ data: '2026-11-18', hora: '14:00' });
  });
  it('aceita "14h00"', () => {
    expect(lerDataHora('18/11 14h00', HOJE)).toEqual({ data: '2026-11-18', hora: '14:00' });
  });
  it('completa zeros', () => {
    expect(lerDataHora('5/1 · 9:30', HOJE)).toEqual({ data: '2027-01-05', hora: '09:30' });
  });
  it('sem ano, data já passada vai para o ano seguinte', () => {
    expect(lerDataHora('01/10 · 08:00', HOJE)).toEqual({ data: '2027-10-01', hora: '08:00' });
  });
  it('sem ano, hoje continua no mesmo ano', () => {
    expect(lerDataHora('28/10 · 08:00', HOJE)).toEqual({ data: '2026-10-28', hora: '08:00' });
  });
  it('com ano explícito no passado não muda o ano', () => {
    expect(lerDataHora('01/10/2026 08:00', HOJE)).toEqual({ data: '2026-10-01', hora: '08:00' });
  });
  it('texto inválido devolve null', () => {
    expect(lerDataHora('', HOJE)).toBeNull();
    expect(lerDataHora('amanhã', HOJE)).toBeNull();
    expect(lerDataHora('18/11', HOJE)).toBeNull();
  });
});

describe('lerNascimento', () => {
  it('vazio devolve objeto vazio', () => {
    expect(lerNascimento('', HOJE)).toEqual({});
  });
  it('data válida', () => {
    expect(lerNascimento('14/02/1965', HOJE)).toEqual({ iso: '1965-02-14' });
  });
  it('31/02 é inválida', () => {
    expect(lerNascimento('31/02/1990', HOJE)).toEqual({ erro: 'Data inválida. Use DD/MM/AAAA.' });
  });
  it('data futura é inválida', () => {
    expect(lerNascimento('29/10/2026', HOJE)).toEqual({ erro: 'Data inválida. Use DD/MM/AAAA.' });
  });
  it('hoje é válida', () => {
    expect(lerNascimento('28/10/2026', HOJE)).toEqual({ iso: '2026-10-28' });
  });
  it('ano com 2 dígitos ou incompleto é inválido', () => {
    expect(lerNascimento('14/02/65', HOJE)).toEqual({ erro: 'Data inválida. Use DD/MM/AAAA.' });
    expect(lerNascimento('14/02', HOJE)).toEqual({ erro: 'Data inválida. Use DD/MM/AAAA.' });
  });
});

describe('mascaraData', () => {
  it('insere as barras', () => {
    expect(mascaraData('1')).toBe('1');
    expect(mascaraData('140')).toBe('14/0');
    expect(mascaraData('14021965')).toBe('14/02/1965');
  });
  it('ignora não dígitos e limita a 8', () => {
    expect(mascaraData('14/02/1965999')).toBe('14/02/1965');
    expect(mascaraData('ab')).toBe('');
  });
});

describe('juntarDataHora', () => {
  it('monta "DD/MM/AAAA · HH:MM"', () => {
    expect(juntarDataHora('18/11/2026', '14:00')).toBe('18/11/2026 · 14:00');
  });
  it('apara espaços e ignora partes vazias', () => {
    expect(juntarDataHora(' 18/11/2026 ', ' 14:00 ')).toBe('18/11/2026 · 14:00');
    expect(juntarDataHora('18/11/2026', '')).toBe('18/11/2026');
    expect(juntarDataHora('', '')).toBe('');
  });
  it('o resultado é lido por lerDataHora', () => {
    expect(lerDataHora(juntarDataHora('05/01/2027', '9:30'), HOJE)).toEqual({ data: '2027-01-05', hora: '09:30' });
  });
});

describe('normalizarHora', () => {
  it('completa "14", "1400", "930" e "9:30"', () => {
    expect(normalizarHora('14')).toBe('14:00');
    expect(normalizarHora('1400')).toBe('14:00');
    expect(normalizarHora('930')).toBe('09:30');
    expect(normalizarHora('9')).toBe('09:00');
    expect(normalizarHora('9:30')).toBe('09:30');
    expect(normalizarHora('14:00')).toBe('14:00');
    expect(normalizarHora(' 14h30 ')).toBe('14:30');
  });
  it('mantém o que não é hora válida', () => {
    expect(normalizarHora('')).toBe('');
    expect(normalizarHora('25')).toBe('25');
    expect(normalizarHora('14:75')).toBe('14:75');
    expect(normalizarHora('abc')).toBe('abc');
  });
});

describe('brParaISO / isoParaBR', () => {
  it('converte datas completas e válidas', () => {
    expect(brParaISO('05/01/2026')).toBe('2026-01-05');
    expect(brParaISO('29/02/2028')).toBe('2028-02-29');
    expect(isoParaBR('2026-01-05')).toBe('05/01/2026');
  });
  it('recusa incompleta ou inexistente', () => {
    expect(brParaISO('')).toBeUndefined();
    expect(brParaISO('05/01')).toBeUndefined();
    expect(brParaISO('05/01/26')).toBeUndefined();
    expect(brParaISO('31/04/2026')).toBeUndefined();
    expect(brParaISO('29/02/2026')).toBeUndefined();
    expect(brParaISO('00/10/2026')).toBeUndefined();
  });
});

describe('somarDias / somarMeses / somarAnos', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-28', 30)).toBe('2026-11-27');
    expect(somarDias('2026-12-20', 21)).toBe('2027-01-10');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('soma meses e prende no último dia do mês', () => {
    expect(somarMeses('2026-10-28', 6)).toBe('2027-04-28');
    expect(somarMeses('2026-08-31', 6)).toBe('2027-02-28');
    expect(somarMeses('2027-08-31', 6)).toBe('2028-02-29');
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('soma anos; 29/02 vira 28/02', () => {
    expect(somarAnos('2026-10-28', 1)).toBe('2027-10-28');
    expect(somarAnos('2028-02-29', 1)).toBe('2029-02-28');
  });
});

describe('lerDataRegistro', () => {
  it('lê a data e aceita hoje', () => {
    expect(lerDataRegistro('28/10/2026', HOJE)).toEqual({ iso: '2026-10-28' });
    expect(lerDataRegistro('01/03/2020', HOJE)).toEqual({ iso: '2020-03-01' });
  });
  it('vazia, inválida ou no futuro dá erro', () => {
    expect(lerDataRegistro('', HOJE).erro).toBe('Informe a data.');
    expect(lerDataRegistro('31/02/2026', HOJE).erro).toBe('Data inválida. Use DD/MM/AAAA.');
    expect(lerDataRegistro('29/10/2026', HOJE).erro).toBe('A data não pode ser depois de hoje.');
  });
  it('com futuro permitido, aceita depois de hoje', () => {
    expect(lerDataRegistro('29/10/2026', HOJE, { futuro: true })).toEqual({ iso: '2026-10-29' });
  });
});

describe('dataDoReforco', () => {
  it('calcula pelos atalhos', () => {
    expect(dataDoReforco('2026-10-28', '1a')).toBe('2027-10-28');
    expect(dataDoReforco('2026-10-28', '6m')).toBe('2027-04-28');
    expect(dataDoReforco('2026-10-28', '21d')).toBe('2026-11-18');
    expect(dataDoReforco('2026-10-28', 'sem')).toBeUndefined();
  });
});

describe('lerReforco', () => {
  it('vazio é "sem reforço"', () => {
    expect(lerReforco('', '2026-10-28')).toEqual({});
  });
  it('precisa ser depois da vacina', () => {
    expect(lerReforco('28/10/2027', '2026-10-28')).toEqual({ iso: '2027-10-28' });
    expect(lerReforco('28/10/2026', '2026-10-28').erro).toBe('O reforço precisa ser depois da vacina.');
    expect(lerReforco('01/10/2026', '2026-10-28').erro).toBe('O reforço precisa ser depois da vacina.');
  });
  it('inválido dá erro; sem data da vacina, só confere o formato', () => {
    expect(lerReforco('31/11/2027', '2026-10-28').erro).toBe('Data inválida. Use DD/MM/AAAA.');
    expect(lerReforco('01/10/2026', undefined)).toEqual({ iso: '2026-10-01' });
  });
});

describe('lerIntervaloDias', () => {
  it('aceita inteiros de 1 a 365', () => {
    expect(lerIntervaloDias('30')).toBe(30);
    expect(lerIntervaloDias(' 90 ')).toBe(90);
    expect(lerIntervaloDias('365')).toBe(365);
  });
  it('recusa o resto', () => {
    expect(lerIntervaloDias('')).toBeUndefined();
    expect(lerIntervaloDias('0')).toBeUndefined();
    expect(lerIntervaloDias('366')).toBeUndefined();
    expect(lerIntervaloDias('7,5')).toBeUndefined();
    expect(lerIntervaloDias('abc')).toBeUndefined();
  });
});

describe('plano de saúde', () => {
  const base: FormPlano = {
    pessoaId: 'ana', operadora: ' Bradesco  Saúde ', numero: '123', produto: 'Top', acomodacao: 'Enfermaria', segmentacao: 'Ambulatorial + hospitalar',
    abrangencia: 'Nacional', validade: '08/2028', vinculo: 'titular', titularNome: '', registroAns: '', central: '', cns: '', carencias: '', mensalidade: '', anotacao: '',
  };
  it('monta o plano com os opcionais vazios fora', () => {
    const { plano } = montarPlano(base);
    expect(plano).toMatchObject({ operadora: 'Bradesco Saúde', acomodacaoCurta: 'Enf.', validade: '08/2028', registroAns: '—', carencias: '—' });
    expect(plano).not.toHaveProperty('central', expect.anything());
  });
  it('exige operadora, número, validade MM/AAAA e titular do dependente', () => {
    expect(montarPlano({ ...base, operadora: ' ', numero: '' }).erros).toEqual({ operadora: 'Informe a operadora.', numero: 'Informe o número da carteirinha.' });
    expect(montarPlano({ ...base, validade: '13/2028' }).erros.validade).toBe('Use MM/AAAA.');
    expect(montarPlano({ ...base, vinculo: 'dependente' }).erros.titularNome).toBeDefined();
    expect(montarPlano({ ...base, validade: '' }).plano?.validade).toBe('—');
  });
  it('odontológico não tem acomodação', () => {
    expect(montarPlano({ ...base, segmentacao: 'Odontológico' }).plano).toMatchObject({ acomodacao: '—', acomodacaoCurta: '—' });
  });
  it('máscara da validade', () => {
    expect([mascaraValidade('0'), mascaraValidade('082'), mascaraValidade('082028'), mascaraValidade('08/20289')]).toEqual(['0', '08/2', '08/2028', '08/2028']);
  });
});

describe('dosagem do remédio', () => {
  it('separa o nome guardado', () => {
    expect(partesDoRemedio({ nome: 'Losartana 50 mg', dosagem: '50 mg' })).toEqual(['Losartana', '50 mg']);
    expect(partesDoRemedio({ nome: 'Levotiroxina 75 mcg' })).toEqual(['Levotiroxina', '75 mcg']);
    expect(partesDoRemedio({ nome: 'Vitamina D' })).toEqual(['Vitamina D', '']);
    expect(partesDoRemedio({ nome: 'Dipirona', dosagem: '20 gotas' })).toEqual(['Dipirona', '20 gotas']);
  });
  it('junta e arruma a unidade', () => {
    expect(nomeComDosagem('Losartana ', '50mg')).toBe('Losartana 50 mg');
    expect(nomeComDosagem('Amoxicilina', '250 mg/5 mL')).toBe('Amoxicilina 250 mg/5 mL');
    expect(nomeComDosagem('Vitamina D', '')).toBe('Vitamina D');
    expect(nomeComDosagem('Vitamina D', '2000ui')).toBe('Vitamina D 2000 UI');
  });
});
