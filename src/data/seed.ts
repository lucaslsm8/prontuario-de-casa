import type { Compartilhamento, Config, Consulta, Dose, Exame, Medicao, Pesagem, Pessoa, Plano, Prevencao, Procedimento, Remedio, Sintoma, Vacina } from './types';
import { HOJE } from './tempo';

// Dados de exemplo dos mockups (hoje = quarta, 28 de outubro de 2026).
export { HOJE };

// Todos os números de carteirinha, ANS e telefones são fictícios.

export const pessoas: Pessoa[] = [
  {
    id: 'helena',
    nome: 'Helena Almeida',
    curto: 'Helena',
    nascimento: '1970-03-22',
    sexo: 'Feminino',
    sangue: 'O+',
    cor: '#D6E8E9',
    alergias: [],
    condicoes: [{ nome: 'Hipotireoidismo', desde: '2021', tipo: 'condicao' }],
    souEu: true,
  },
  {
    id: 'roberto',
    nome: 'Roberto Carlos Almeida',
    curto: 'Roberto',
    nascimento: '1965-02-14',
    sexo: 'Masculino',
    parentesco: 'cônjuge',
    sangue: 'A+',
    peso: 82,
    altura: 1.74,
    pressao: { valor: '130/80', data: '2026-10-20' },
    cor: '#E2E0EE',
    alergias: [{ substancia: 'Penicilina', reacao: 'Urticária e falta de ar', ano: 2009 }],
    condicoes: [
      { nome: 'Hipertensão arterial', nomeClinico: 'Hipertensão', desde: '2017', tipo: 'condicao' },
      { nome: 'Colesterol alto', desde: '2020', tipo: 'condicao' },
      { nome: 'Cirurgia de vesícula', nomeClinico: 'Colecistectomia', desde: '2015', tipo: 'cirurgia' },
      { nome: 'Vacina gripe', desde: 'abr 2026', tipo: 'vacina' },
    ],
    contatoEmergencia: { nome: 'Helena', relacao: 'Esposa', telefone: '(11) 98765-4321' },
  },
  {
    id: 'pedro',
    nome: 'Pedro Almeida',
    curto: 'Pedro',
    parentesco: 'filho',
    cor: '#EEE7D6',
    alergias: [],
    condicoes: [],
  },
  {
    id: 'mel',
    nome: 'Mel',
    curto: 'Mel',
    nascimento: '2020-03-15',
    sexo: 'Feminino',
    cor: '#E6EEDA',
    alergias: [],
    condicoes: [],
    tipo: 'pet',
    pet: {
      especie: 'cachorro',
      raca: 'Vira-lata caramelo',
      castrado: true,
      microchip: '985 112 004 218 733',
      veterinario: { nome: 'Dra. Camila Prado', clinica: 'Clínica Vida Animal', telefone: '(11) 3456-7890' },
      clinica24h: { nome: 'Pronto Pet 24 h', telefone: '(11) 3555-0100' },
    },
  },
  {
    id: 'thor',
    nome: 'Thor',
    curto: 'Thor',
    nascimento: '2022-08-09',
    sexo: 'Masculino',
    cor: '#F0E1E4',
    alergias: [],
    condicoes: [],
    tipo: 'pet',
    pet: {
      especie: 'cachorro',
      raca: 'Shiba inu',
      castrado: true,
      microchip: '985 112 004 902 417',
      veterinario: { nome: 'Dra. Camila Prado', clinica: 'Clínica Vida Animal', telefone: '(11) 3456-7890' },
      clinica24h: { nome: 'Pronto Pet 24 h', telefone: '(11) 3555-0100' },
    },
  },
];

export const remedios: Remedio[] = [
  {
    id: 'levotiroxina',
    pessoaId: 'helena',
    nome: 'Levotiroxina 75 mcg',
    dose: '1 comp.',
    doseLonga: '1 comprimido',
    unidade: 'comprimidos',
    frequencia: '1x ao dia',
    horarios: ['06:30'],
    observacao: 'em jejum',
    continuo: true,
    inicio: '2021-05-10',
    estoque: 4,
    avisarDias: 5,
    receitadoPor: 'Dra. Marta Lins',
    indicacao: 'Hipotireoidismo',
    aparencia: { forma: 'redondo', cor: 'branco', sulco: true },
    cartela: { porCartela: 14, fileiras: 2 },
    lembrete: true,
    ativo: true,
  },
  {
    id: 'losartana',
    pessoaId: 'roberto',
    nome: 'Losartana 50 mg',
    dose: '1 comp.',
    doseLonga: '1 comprimido',
    unidade: 'comprimidos',
    frequencia: '1x ao dia',
    horarios: ['08:00'],
    continuo: true,
    inicio: '2017-06-01',
    estoque: 12,
    avisarDias: 3,
    receitadoPor: 'Dr. Paulo Mendes',
    indicacao: 'Hipertensão arterial',
    lembrete: true,
    ativo: true,
  },
  {
    id: 'sinvastatina',
    pessoaId: 'roberto',
    nome: 'Sinvastatina 20 mg',
    dose: '1 comp.',
    doseLonga: '1 comprimido',
    unidade: 'comprimidos',
    frequencia: '1x ao dia',
    horarios: ['21:00'],
    continuo: true,
    inicio: '2020-03-01',
    estoque: 26,
    avisarDias: 3,
    receitadoPor: 'Dr. Paulo Mendes',
    indicacao: 'Colesterol alto',
    aparencia: { forma: 'oblongo', cor: 'rosa', sulco: true },
    cartela: { porCartela: 10, fileiras: 2 },
    lembrete: true,
    ativo: true,
  },
  {
    id: 'loratadina',
    pessoaId: 'pedro',
    nome: 'Loratadina 10 mg',
    dose: '1 comp.',
    unidade: 'comprimidos',
    horarios: [],
    continuo: false,
    seNecessario: true,
    estoqueTexto: '1 cartela',
    avisarDias: 0,
    lembrete: false,
    ativo: true,
  },
  {
    id: 'apoquel-thor',
    pessoaId: 'thor',
    nome: 'Apoquel 16 mg',
    dose: '½ comp.',
    doseLonga: '½ comprimido',
    unidade: 'comprimidos',
    frequencia: '1x ao dia',
    horarios: ['08:00'],
    observacao: 'com a ração',
    continuo: true,
    inicio: '2026-09-15',
    estoque: 18,
    avisarDias: 5,
    receitadoPor: 'Dra. Camila Prado',
    indicacao: 'Dermatite atópica',
    lembrete: true,
    ativo: true,
  },
  // Encerrados (o desktop mostra "Encerrados · 7"; aqui ficam os dois recentes + histórico)
  { id: 'amoxicilina-1', pessoaId: 'helena', nome: 'Amoxicilina 500 mg', dose: '1 cáps.', unidade: 'cápsulas', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, inicio: '2026-10-21', fim: '2026-10-28', encerradoResumo: '21/10 a 28/10 · 21 de 21 doses' },
  { id: 'ibuprofeno-1', pessoaId: 'roberto', nome: 'Ibuprofeno 400 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, inicio: '2026-09-02', fim: '2026-09-05', encerradoResumo: '02/09 a 05/09' },
  { id: 'enc-3', pessoaId: 'helena', nome: 'Dipirona 500 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, fim: '2026-07-12', encerradoResumo: '10/07 a 12/07' },
  { id: 'enc-4', pessoaId: 'roberto', nome: 'Omeprazol 20 mg', dose: '1 cáps.', unidade: 'cápsulas', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, fim: '2026-05-30', encerradoResumo: '01/05 a 30/05' },
  { id: 'enc-5', pessoaId: 'helena', nome: 'Prednisona 20 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, fim: '2026-04-08', encerradoResumo: '03/04 a 08/04' },
  { id: 'enc-6', pessoaId: 'roberto', nome: 'Azitromicina 500 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, fim: '2026-02-14', encerradoResumo: '10/02 a 14/02' },
  { id: 'enc-7', pessoaId: 'helena', nome: 'Cefalexina 500 mg', dose: '1 cáps.', unidade: 'cápsulas', horarios: [], continuo: false, avisarDias: 0, lembrete: false, ativo: false, fim: '2026-01-20', encerradoResumo: '13/01 a 20/01' },
];

// Histórico de doses dos últimos 30 dias (append-only), com algumas perdidas,
// mais as duas já tomadas hoje. A adesão das telas é calculada daqui.
const PERDIDAS: Record<string, string[]> = {
  levotiroxina: ['2026-10-24'],
  losartana: ['2026-10-09'],
  sinvastatina: ['2026-10-03', '2026-10-12', '2026-10-19'],
};
function historico(): Dose[] {
  const out: Dose[] = [];
  const base = new Date(2026, 9, 28);
  for (let i = 30; i >= 1; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const [id, h, atraso] of [['levotiroxina', '06:30', 3], ['losartana', '08:00', 6], ['sinvastatina', '21:00', 2]] as const) {
      if (PERDIDAS[id].includes(iso)) continue;
      const [hh, mm] = h.split(':').map(Number);
      out.push({ remedioId: id, previstoPara: `${iso}T${h}`, status: 'tomada', registradoEm: `${String(hh).padStart(2, '0')}:${String(mm + atraso).padStart(2, '0')}` });
    }
  }
  return out;
}
export const doses: Dose[] = [
  ...historico(),
  { remedioId: 'levotiroxina', previstoPara: `${HOJE}T06:30`, status: 'tomada', registradoEm: '06:34' },
  { remedioId: 'losartana', previstoPara: `${HOJE}T08:00`, status: 'tomada', registradoEm: '08:05' },
];

export const consultas: Consulta[] = [
  {
    id: 'cardio-0511',
    tipo: 'consulta',
    pessoaId: 'roberto',
    titulo: 'Cardiologista',
    profissional: 'Dr. Paulo Mendes',
    local: 'Clínica Coração Paulista',
    endereco: 'Av. Paulista 1200',
    data: '2026-11-05',
    hora: '10:00',
    duracaoMin: 45,
    peloPlano: 'Vitalis · sim',
    levar: [
      { item: 'Eletrocardiograma de 12/09', ok: true },
      { item: 'Lista de remédios em uso', ok: false },
      { item: 'Carteirinha Vitalis', ok: false },
    ],
    lembretes: ['1 dia antes'],
    perguntas: ['Posso trocar o horário da sinvastatina?'],
  },
  {
    id: 'vet-mel-0611',
    tipo: 'consulta',
    pessoaId: 'mel',
    titulo: 'Veterinário',
    profissional: 'Dra. Camila Prado',
    local: 'Clínica Vida Animal',
    data: '2026-11-06',
    hora: '17:30',
    duracaoMin: 30,
    levar: [{ item: 'Carteira de vacinação', ok: false }],
    lembretes: ['1 dia antes'],
  },
  {
    id: 'tsh-1011',
    tipo: 'exame',
    pessoaId: 'helena',
    titulo: 'Exame TSH e T4 livre',
    local: 'Laboratório Central',
    data: '2026-11-10',
    hora: '07:30',
    preparo: 'jejum de 4 h',
    levar: [],
    lembretes: ['1 dia antes'],
  },
  {
    id: 'endo-2411',
    tipo: 'consulta',
    pessoaId: 'helena',
    titulo: 'Endocrinologista',
    profissional: 'Dra. Marta Lins',
    local: 'Consultório Dra. Marta Lins',
    data: '2026-11-24',
    hora: '15:00',
    duracaoMin: 30,
    peloPlano: 'Vitalis · sim',
    levar: [{ item: 'Resultado TSH e T4 livre', ok: false }],
    lembretes: ['1 dia antes'],
  },
  {
    id: 'usg-2711',
    tipo: 'exame',
    pessoaId: 'roberto',
    titulo: 'Ultrassom',
    local: 'Imagem Diagnóstica Sul',
    data: '2026-11-27',
    hora: '08:00',
    preparo: 'jejum de 8 h',
    levar: [],
    lembretes: ['1 dia antes'],
  },
];

export const exames: Exame[] = [
  { id: 'lipidico', pessoaId: 'roberto', nome: 'Perfil lipídico', categoria: 'Sangue', dataColeta: '2026-09-12', laboratorio: 'Lab. Central', solicitante: 'Dr. Paulo Mendes', consultaId: 'cardio-0511', arquivo: 'PDF', paginas: 2, anotacao: 'Mostrar ao cardiologista. Ele pediu para repetir em 6 meses.',
    resultados: [{ marcador: 'Colesterol total', valor: 212, unidade: 'mg/dL' }, { marcador: 'LDL', valor: 138, unidade: 'mg/dL' }, { marcador: 'HDL', valor: 44, unidade: 'mg/dL' }, { marcador: 'Triglicerídeos', valor: 152, unidade: 'mg/dL' }] },
  { id: 'lipidico-mar', pessoaId: 'roberto', nome: 'Perfil lipídico', categoria: 'Sangue', dataColeta: '2026-03-02', laboratorio: 'Lab. Central', solicitante: 'Dr. Paulo Mendes', arquivo: 'PDF', paginas: 2,
    resultados: [{ marcador: 'Colesterol total', valor: 238, unidade: 'mg/dL' }, { marcador: 'LDL', valor: 161, unidade: 'mg/dL' }, { marcador: 'HDL', valor: 41, unidade: 'mg/dL' }, { marcador: 'Triglicerídeos', valor: 181, unidade: 'mg/dL' }, { marcador: 'Glicose', valor: 118, unidade: 'mg/dL' }] },
  { id: 'ecg', pessoaId: 'roberto', nome: 'Eletrocardiograma', categoria: 'Coração', dataColeta: '2026-09-12', laboratorio: 'Clínica Coração Paulista', solicitante: 'Dr. Paulo Mendes', consultaId: 'cardio-0511', arquivo: 'FOTO', paginas: 1 },
  { id: 'tsh', pessoaId: 'helena', nome: 'TSH e T4 livre', categoria: 'Sangue', dataColeta: '2026-06-03', laboratorio: 'Lab. Central', solicitante: 'Dra. Marta Lins', arquivo: 'PDF', paginas: 1,
    resultados: [{ marcador: 'TSH', valor: 2.1, unidade: 'mUI/L' }, { marcador: 'T4 livre', valor: 1.2, unidade: 'ng/dL' }] },
  { id: 'glicemia', pessoaId: 'roberto', nome: 'Glicemia de jejum', categoria: 'Sangue', dataColeta: '2026-06-03', laboratorio: 'Lab. Central', arquivo: 'PDF', paginas: 1, resultados: [{ marcador: 'Glicose', valor: 109, unidade: 'mg/dL' }, { marcador: 'Hemoglobina glicada', valor: 5.9, unidade: '%' }] },
  { id: 'mamografia', pessoaId: 'helena', nome: 'Mamografia', categoria: 'Imagem', dataColeta: '2026-02-18', laboratorio: 'Imagem Diagnóstica Sul', arquivo: 'PDF', paginas: 3 },
  { id: 'hemograma', pessoaId: 'helena', nome: 'Hemograma completo', categoria: 'Sangue', dataColeta: '2026-02-18', laboratorio: 'Lab. Central', arquivo: 'PDF', paginas: 2 },
];

export const planos: Plano[] = [
  {
    id: 'vitalis-roberto',
    pessoaId: 'roberto',
    operadora: 'Vitalis Saúde',
    registroAns: '000000',
    numero: '0 123 4567 8901 2345',
    produto: 'Essencial',
    acomodacao: 'Apartamento',
    acomodacaoCurta: 'Apto',
    segmentacao: 'Ambulatorial + hospitalar',
    abrangencia: 'Estadual · SP',
    carencias: 'Todas cumpridas',
    validade: '08/2028',
    vinculo: 'titular',
    titularNome: 'Roberto C. Almeida',
    cns: '700 0012 3456 7890',
    central: '0800 000 0000',
    mensalidade: 'R$ 1.240,00 · vence dia 10',
    anotacao: 'Autorização prévia para ressonância: ligar na central com o pedido médico em mãos.',
  },
  {
    id: 'vitalis-helena',
    pessoaId: 'helena',
    operadora: 'Vitalis Saúde',
    registroAns: '000000',
    numero: '0 123 4567 8901 2346',
    produto: 'Essencial',
    acomodacao: 'Apartamento',
    acomodacaoCurta: 'Apto',
    segmentacao: 'Ambulatorial + hospitalar',
    abrangencia: 'Estadual · SP',
    carencias: 'Todas cumpridas',
    validade: '08/2028',
    vinculo: 'dependente',
    titularNome: 'Roberto C. Almeida',
    cns: '700 0012 3456 7891',
    central: '0800 000 0000',
  },
  {
    id: 'orbe-pedro',
    pessoaId: 'pedro',
    operadora: 'Orbe Odonto',
    registroAns: '000001',
    numero: '88 0042 1177 5',
    produto: 'Odontológico',
    acomodacao: '—',
    acomodacaoCurta: '',
    segmentacao: 'Odontológico',
    abrangencia: 'Nacional',
    carencias: 'Todas cumpridas',
    validade: '03/2027',
    vinculo: 'titular',
    titularNome: 'Pedro Almeida',
    central: '0800 000 0001',
  },
];

export const compartilhamentos: Compartilhamento[] = [
  { de: 'helena', para: 'roberto', categorias: ['perfil', 'remedios', 'consultas', 'exames', 'plano'] },
  { de: 'helena', para: 'pedro', categorias: ['plano'] },
  { de: 'roberto', para: 'helena', categorias: ['perfil', 'remedios', 'consultas', 'exames', 'plano'] },
  { de: 'pedro', para: 'helena', categorias: ['remedios', 'plano'] },
];

export const config: Config = {
  biometria: true,
  senhaAoAbrir: true,
  bloqueioMobile: '1 minuto',
  bloqueioDesktop: '5 minutos',
  esconderNomeNotif: true,
  fichaSemDesbloqueio: true,
  backup: { ultimo: '2026-10-27T23:10:00', tamanho: 18 * 1024 * 1024, freq: 'semanal', arquivo: 'familia-almeida-2026-10-27.fsaude', pasta: 'Documentos / Saúde', temSenha: true },
  update: {
    auto: true,
    freq: 'dia',
    backupAntes: true,
    ultimaVerificacao: 'hoje, 08:00',
    instalada: '1.4.2',
    disponivel: {
      versao: '1.5.0',
      notas: ['Resumo para consulta exporta em PDF', 'Lembrete de reposição mais cedo', 'Correção no horário de verão'],
      tamanho: '14 MB',
      publicada: 'ontem',
      publicadaData: '27/10',
    },
  },
  sync: { ultima: 'hoje, 08:12', via: 'conexão direta' },
};

// ── Pets (Mel e Thor) ─────────────────────────────────────────────────────

export const vacinas: Vacina[] = [
  { id: 'vac-mel-1', pessoaId: 'mel', nome: 'V10', data: '2025-11-20', lote: 'V10-2231', veterinario: 'Dra. Camila Prado', proxima: '2026-11-20' },
  { id: 'vac-mel-2', pessoaId: 'mel', nome: 'Antirrábica', data: '2026-03-12', lote: 'AR-0457', veterinario: 'Dra. Camila Prado', proxima: '2027-03-12' },
  { id: 'vac-thor-1', pessoaId: 'thor', nome: 'V10', data: '2026-02-20', lote: 'V10-2308', veterinario: 'Dra. Camila Prado', proxima: '2027-02-20' },
  { id: 'vac-thor-2', pessoaId: 'thor', nome: 'Gripe canina', data: '2025-10-30', lote: 'GC-1180', veterinario: 'Dra. Camila Prado', proxima: '2026-11-02' },
];

export const prevencoes: Prevencao[] = [
  { id: 'prev-mel-1', pessoaId: 'mel', tipo: 'antipulgas', produto: 'NexGard', data: '2026-10-10', intervaloDias: 30 },
  { id: 'prev-thor-1', pessoaId: 'thor', tipo: 'vermifugo', produto: 'Drontal Plus', data: '2026-08-15', intervaloDias: 90 },
];

export const sintomas: Sintoma[] = [
  { id: 'sint-mel-1', pessoaId: 'mel', data: '2026-10-26', sinais: ['Vômito', 'Apatia'], nota: 'Comeu grama no passeio; melhorou à noite.' },
];

export const procedimentos: Procedimento[] = [
  { id: 'proc-thor-1', pessoaId: 'thor', data: '2023-03-18', tipo: 'Castração', clinica: 'Clínica Vida Animal', medico: 'Dra. Camila Prado', anestesista: 'Dr. Felipe Nunes', nota: 'Sem intercorrências.' },
  { id: 'proc-roberto-1', pessoaId: 'roberto', data: '2025-08-14', tipo: 'Colonoscopia', descricao: 'Rastreamento', clinica: 'Hospital Vila Serena', medico: 'Dr. Marcelo Tavares', anestesista: 'Dra. Lúcia Moreira', nota: 'Sem pólipos. Repetir em 5 anos.' },
];

export const pesagens: Pesagem[] = [
  { id: 'pes-mel-1', pessoaId: 'mel', data: '2026-04-10', kg: 18.6 },
  { id: 'pes-mel-2', pessoaId: 'mel', data: '2026-10-10', kg: 19.2 },
  { id: 'pes-thor-1', pessoaId: 'thor', data: '2026-04-10', kg: 10.4 },
  { id: 'pes-thor-2', pessoaId: 'thor', data: '2026-10-10', kg: 10.8 },
];

// Medições (gráficos de progresso). Roberto controla pressão e glicemia; os últimos valores batem com o perfil.
const med = (id: string, pessoaId: string, tipo: Medicao['tipo'], data: string, valor: number, extra: Partial<Medicao> = {}): Medicao => ({ id, pessoaId, tipo, data, valor, ...extra });
export const medicoes: Medicao[] = [
  ...([['2026-05-12', 142, 92], ['2026-06-10', 140, 90], ['2026-07-08', 136, 88], ['2026-08-11', 135, 86], ['2026-09-12', 132, 84], ['2026-10-20', 130, 80]] as const)
    .map(([d, a, b], i) => med(`pa-a${i}`, 'roberto', 'pressao', d, a, { valor2: b })),
  ...([['2026-05-12', 85.4], ['2026-06-10', 84.8], ['2026-07-08', 84.1], ['2026-08-11', 83.5], ['2026-09-12', 82.6], ['2026-10-20', 82]] as const)
    .map(([d, kg], i) => med(`peso-a${i}`, 'roberto', 'peso', d, kg)),
  ...([['2026-03-02', 118], ['2026-06-03', 109], ['2026-09-12', 104], ['2026-10-20', 99]] as const)
    .map(([d, v], i) => med(`gli-a${i}`, 'roberto', 'glicemia', d, v, { contexto: 'Jejum' })),
  ...([['2026-02-18', 63.2], ['2026-06-03', 62.5], ['2026-10-05', 61.8]] as const)
    .map(([d, kg], i) => med(`peso-r${i}`, 'helena', 'peso', d, kg)),
];
