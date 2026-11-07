// Modelo de dados — segue a sugestão do handoff. Na v1 real isso vem do SQLite
// criptografado; nesta etapa tudo vive em memória a partir de `seed.ts`.

export type PessoaId = string;
export type Categoria = 'perfil' | 'remedios' | 'consultas' | 'exames' | 'plano';

export const CATEGORIAS: { id: Categoria; nome: string; detalhe?: string }[] = [
  { id: 'perfil', nome: 'Perfil clínico', detalhe: 'Alergias, condições, tipo sanguíneo' },
  { id: 'remedios', nome: 'Remédios', detalhe: 'Inclui doses tomadas' },
  { id: 'consultas', nome: 'Consultas' },
  { id: 'exames', nome: 'Exames' },
  { id: 'plano', nome: 'Plano de saúde' },
];

export interface Alergia { substancia: string; reacao?: string; ano?: number }
export interface Condicao { nome: string; desde?: string; tipo: 'condicao' | 'cirurgia' | 'vacina'; nomeClinico?: string }

export interface Pessoa {
  id: PessoaId;
  nome: string;          // nome completo
  curto: string;         // como aparece nas listas
  nascimento?: string;   // ISO yyyy-mm-dd
  sexo?: 'Masculino' | 'Feminino';
  parentesco?: string;   // relação com quem está logado
  sangue?: string;
  peso?: number;         // kg
  altura?: number;       // m
  pressao?: { valor: string; data: string };
  cor: string;           // fundo do avatar
  alergias: Alergia[];
  condicoes: Condicao[];
  contatoEmergencia?: { nome: string; relacao: string; telefone: string };
  souEu?: boolean;
  foto?: string;         // data URL JPEG 384×384
  tipo?: 'pessoa' | 'pet'; // ausente = pessoa
  pet?: DadosPet;
}

export interface DadosPet {
  especie: 'cachorro';
  raca?: string;
  castrado?: boolean;
  microchip?: string;
  veterinario?: { nome: string; clinica?: string; telefone?: string };
  clinica24h?: { nome: string; telefone: string };
}

export interface Vacina { id: string; pessoaId: PessoaId; nome: string; data: string; lote?: string; veterinario?: string; proxima?: string }
export interface Prevencao { id: string; pessoaId: PessoaId; tipo: 'vermifugo' | 'antipulgas' | 'outro'; produto: string; data: string; intervaloDias: number }
export interface Sintoma { id: string; pessoaId: PessoaId; data: string; sinais: string[]; nota?: string }
/** Pets: Cirurgia, Castração, Limpeza de tártaro, Exame de imagem, Outro. Pessoas: Cirurgia, Endoscopia, Colonoscopia, Biópsia, Odontológico, Exame de imagem, Outro. */
export type TipoProcedimento = 'Cirurgia' | 'Castração' | 'Limpeza de tártaro' | 'Endoscopia' | 'Colonoscopia' | 'Biópsia' | 'Odontológico' | 'Exame de imagem' | 'Outro';
/** Procedimento de pessoa ou pet. `medico`: quem realizou (o veterinário, no pet); `anestesista`, se houve. */
export interface Procedimento { id: string; pessoaId: PessoaId; data: string; tipo: TipoProcedimento; descricao?: string; clinica?: string; medico?: string; anestesista?: string; nota?: string }
export interface Pesagem { id: string; pessoaId: PessoaId; data: string; kg: number }

/**
 * Arquivo anexado (foto ou PDF), guardado dentro do evento — cifrado no banco e no backup.
 * `donoId` é o exame, o remédio (receita) ou o plano (carteirinha).
 */
/** `foto`: álbum do pet (donoId = id do pet). */
export type TipoAnexo = 'exame' | 'receita' | 'carteirinha' | 'foto';
export interface Anexo { id: string; donoId: string; tipo: TipoAnexo; nome: string; mime: string; dados: string; tamanho: number; em: string; rotulo?: string }

/** Medição de uma pessoa. Pressão: valor = máxima, valor2 = mínima (mmHg). */
export type TipoMedicao = 'peso' | 'pressao' | 'glicemia' | 'altura' | 'temperatura' | 'saturacao';
export interface Medicao { id: string; pessoaId: PessoaId; tipo: TipoMedicao; data: string; hora?: string; valor: number; valor2?: number; contexto?: string; nota?: string }

export interface Remedio {
  id: string;
  pessoaId: PessoaId;
  nome: string;           // "Levotiroxina 75 mcg"
  dose: string;           // "1 comp."
  doseLonga?: string;     // "1 comprimido"
  unidade: string;        // "comprimidos", "cápsulas"
  frequencia?: string;
  horarios: string[];
  observacao?: string;    // "em jejum"
  continuo: boolean;
  seNecessario?: boolean;
  inicio?: string;
  fim?: string;
  estoque?: number;       // unidades
  estoqueTexto?: string;  // quando não é contado em unidades ("1 cartela")
  avisarDias: number;
  receitadoPor?: string;
  indicacao?: string;
  lembrete: boolean;
  ativo: boolean;
  encerradoResumo?: string;
}

export type DoseStatus = 'tomada' | 'pulada' | 'perdida';
export interface Dose {
  remedioId: string;
  previstoPara: string;   // ISO date + hora "2026-10-28T06:30"
  status: DoseStatus;
  registradoEm: string;   // "06:34"
}

export interface Consulta {
  id: string;
  tipo: 'consulta' | 'exame';
  pessoaId: PessoaId;
  titulo: string;           // especialidade ou nome do exame
  profissional?: string;
  local?: string;
  endereco?: string;
  data: string;             // ISO yyyy-mm-dd
  hora: string;             // HH:MM
  duracaoMin?: number;
  preparo?: string;         // "jejum de 4 h"
  peloPlano?: string;
  levar: { item: string; ok: boolean }[];
  lembretes: string[];
  perguntas?: string[];
  /** Depois da consulta: o que o médico disse. */
  anotacaoPos?: string;
  /** Esta consulta é o retorno da consulta `retornoDe`. */
  retornoDe?: string;
}

export type CategoriaExame =
  | 'Sangue' | 'Urina' | 'Fezes' | 'Imagem' | 'Coração' | 'Hormônios' | 'Ginecológico' | 'Urológico'
  | 'Oftalmológico' | 'Pele' | 'Sorologia' | 'Laudo / atestado' | 'Outro';
/** Valor de um marcador no exame (ex.: LDL 138 mg/dL). `min`/`max`: faixa do laudo, se a pessoa digitou. */
export interface Resultado { marcador: string; valor: number; unidade: string; min?: number; max?: number }

export interface Exame {
  id: string;
  pessoaId: PessoaId;
  nome: string;
  categoria: CategoriaExame;
  dataColeta: string;   // ISO
  laboratorio: string;
  solicitante?: string;
  consultaId?: string;
  arquivo: 'PDF' | 'FOTO';
  paginas: number;
  anotacao?: string;
  /** Texto do resultado (laudo), digitado ou lido do PDF. */
  laudo?: string;
  resultados?: Resultado[];
}

export interface Plano {
  id: string;
  pessoaId: PessoaId;
  operadora: string;
  registroAns: string;
  numero: string;
  produto: string;
  acomodacao: string;
  acomodacaoCurta: string;
  segmentacao: string;
  abrangencia: string;
  carencias: string;
  validade: string;
  vinculo: 'titular' | 'dependente';
  titularNome: string;
  cns?: string;
  central?: string;
  mensalidade?: string;
  anotacao?: string;
}

/** Aparelho da família (evento `aparelho`). `visto` é o ISO do último evento dele no log. */
export interface Aparelho { id: string; nome: string; plataforma: 'pc' | 'cel'; chavePublica?: string; removido?: boolean; /** Época da chave em que saiu da família. */ removidoEpoca?: number; visto: string }

export interface Compartilhamento { de: PessoaId; para: PessoaId; categorias: Categoria[] }

export interface Config {
  /** Agenda conectada: endereço iCal secreto (fica cifrado no log) e de quem são as consultas. */
  agenda?: { url: string; pessoaId: string } | null;
  biometria: boolean;
  senhaAoAbrir: boolean;
  bloqueioMobile: string;
  bloqueioDesktop: string;
  esconderNomeNotif: boolean;
  fichaSemDesbloqueio: boolean;
  /** Celular: menu inferior só com ícones (padrão: texto). Vale para este aparelho. */
  menuIcones?: boolean;
  /** Vem do armazenamento (Rust), não do log de eventos. */
  backup: { ultimo?: string | null; tamanho?: number | null; freq: 'semanal' | 'manual'; arquivo?: string | null; pasta: string; temSenha: boolean };
  update: {
    auto: boolean;
    freq: 'dia' | 'semana';
    backupAntes: boolean;
    ultimaVerificacao: string;
    instalada: string;
    disponivel?: { versao: string; notas: string[]; tamanho: string; publicada: string; publicadaData: string };
  };
  sync: { ultima?: string; via?: string };
}
