import type { State } from './store';
import type { Consulta, Pessoa, Prevencao, Pesagem, Procedimento, Sintoma, TipoProcedimento, Vacina } from './types';
import { HOJE } from './tempo';
import { dataBR, diaMes, diasEntre, idade, numBR, numCurto } from './format';
import { somarDias } from './formularios-puro';

export const ehPet = (p: Pessoa) => p.tipo === 'pet';

/** Pessoas da família (sem os pets), na ordem de cadastro. */
export const familia = (s: State) => s.pessoas.filter((p) => !ehPet(p));
/** Pets, na ordem de cadastro. */
export const pets = (s: State) => s.pessoas.filter(ehPet);

/** Consultas e exames só das pessoas (sem os pets), em ordem de data e hora. */
export function consultasDaFamilia(s: State): Consulta[] {
  const ids = new Set(pets(s).map((p) => p.id));
  return s.consultas.filter((c) => !ids.has(c.pessoaId)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}

/** Próxima consulta (não exame) da família a partir de `hoje`. Pets não contam. */
export const proximaConsultaDaFamilia = (s: State, hoje = HOJE) =>
  consultasDaFamilia(s).find((c) => c.tipo === 'consulta' && c.data >= hoje);

export const SINAIS = ['Vômito', 'Diarreia', 'Coceira', 'Apatia', 'Falta de apetite', 'Tosse', 'Mancando', 'Outro'];
export const TIPOS_PROCEDIMENTO = ['Cirurgia', 'Castração', 'Limpeza de tártaro', 'Exame de imagem', 'Outro'] as const;
export const TIPOS_PROCEDIMENTO_PESSOA = ['Cirurgia', 'Endoscopia', 'Colonoscopia', 'Biópsia', 'Odontológico', 'Exame de imagem', 'Outro'] as const;
/** Tipos de procedimento do pet ou da pessoa (o tipo já salvo entra na lista, para a edição não perdê-lo). */
export function tiposProcedimento(p: Pessoa, atual?: TipoProcedimento): TipoProcedimento[] {
  const base: readonly TipoProcedimento[] = ehPet(p) ? TIPOS_PROCEDIMENTO : TIPOS_PROCEDIMENTO_PESSOA;
  return atual && !base.includes(atual) ? [...base.slice(0, -1), atual, 'Outro'] : [...base];
}
/** Rótulos do formulário de procedimento: no pet, quem fez é o veterinário e o lugar é a clínica. */
export function rotulosProcedimento(dono: Pessoa) {
  const animal = ehPet(dono);
  return {
    medico: animal ? 'Veterinário' : 'Médico',
    clinica: animal ? 'Clínica' : 'Hospital ou clínica',
    descricao: animal ? 'Ex.: Retirada de nódulo' : 'Ex.: Retirada da vesícula',
  };
}
/** "Cirurgia · Retirada de nódulo". */
export const tituloProcedimento = (x: Procedimento) => `${x.tipo}${x.descricao ? ` · ${x.descricao}` : ''}`;
/** "Dr. Paulo · anestesia: Dra. Lia" (quem fez e o anestesista, se houver). */
export const equipeProcedimento = (x: Procedimento) => [x.medico, x.anestesista && `anestesia: ${x.anestesista}`].filter(Boolean).join(' · ') || undefined;
export const SUGESTOES_VACINA = ['V8', 'V10', 'Antirrábica', 'Gripe canina', 'Giárdia', 'Leishmaniose'];

/** Última pesagem (data mais recente; em empate, a registrada depois). */
export function pesoAtual(s: State, petId: string): Pesagem | undefined {
  return s.pesagens.filter((x) => x.pessoaId === petId).reduce<Pesagem | undefined>((a, x) => (!a || x.data >= a.data ? x : a), undefined);
}

// somarDias mora em formularios-puro.ts (com somarMeses/somarAnos); reexportada aqui.
export { somarDias };

/** Data da próxima aplicação: data + intervaloDias. */
export const proximaPrevencao = (p: Prevencao) => somarDias(p.data, p.intervaloDias);

/**
 * A aplicação mais recente de cada tipo (vermífugo, antipulgas). Trocar de produto
 * substitui o anterior; em "outro", cada produto conta à parte.
 */
export function ultimasPrevencoes(s: State, petId: string): Prevencao[] {
  const por = new Map<string, Prevencao>();
  for (const p of s.prevencoes) {
    if (p.pessoaId !== petId) continue;
    const k = p.tipo === 'outro' ? `outro|${p.produto.trim().toLowerCase()}` : p.tipo;
    const atual = por.get(k);
    if (!atual || p.data >= atual.data) por.set(k, p);
  }
  return [...por.values()];
}

/** Vacinas do pet, da mais recente para a mais antiga. */
export const vacinasDoPet = (s: State, petId: string): Vacina[] =>
  s.vacinas.filter((v) => v.pessoaId === petId).sort((a, b) => b.data.localeCompare(a.data));

/** Sintomas dos últimos `dias` dias (até `hoje`), do mais recente para o mais antigo. */
export function sintomasRecentes(s: State, petId: string, dias: number, hoje = HOJE): Sintoma[] {
  const desde = somarDias(hoje, -dias);
  return s.sintomas.filter((x) => x.pessoaId === petId && x.data >= desde && x.data <= hoje).sort((a, b) => b.data.localeCompare(a.data));
}

/**
 * Separa os itens da família dos itens dos pets, mantendo a ordem de cada grupo.
 * As listas mostram a família primeiro e, se houver, a divisória "Pets" e os itens deles.
 */
export function agruparFamiliaPets<T>(
  itens: T[],
  s: State,
  pessoaDe: (x: T) => string = (x) => (x as unknown as { pessoaId: string }).pessoaId,
): { familia: T[]; pets: T[] } {
  const ids = new Set(pets(s).map((p) => p.id));
  const out = { familia: [] as T[], pets: [] as T[] };
  for (const x of itens) (ids.has(pessoaDe(x)) ? out.pets : out.familia).push(x);
  return out;
}

/** Pessoas e pets separados, para os seletores "Para quem" (chips com separador). */
export function opcoesPessoas(lista: Pessoa[], nome: (p: Pessoa) => string): { opcoes: { id: string; nome: string }[]; separarAntes?: number } {
  const gente = lista.filter((p) => !ehPet(p));
  const bichos = lista.filter(ehPet);
  const opcoes = [...gente, ...bichos].map((p) => ({ id: p.id, nome: nome(p) }));
  return { opcoes, separarAntes: gente.length && bichos.length ? gente.length : undefined };
}

/** "Cachorro · Border Collie · 4 anos". */
export function descricaoPet(p: Pessoa): string {
  const anos = idade(p);
  return ['Cachorro', p.pet?.raca, anos != null && `${anos} ${anos === 1 ? 'ano' : 'anos'}`].filter(Boolean).join(' · ');
}

export const NOMES_PREVENCAO = { vermifugo: 'Vermífugo', antipulgas: 'Antipulgas', outro: 'Outro' } as const;

/** A dose mais recente de cada vacina (por nome), da mais recente para a mais antiga. */
export function ultimasVacinas(s: State, petId: string): Vacina[] {
  const por = new Map<string, Vacina>();
  for (const v of s.vacinas) {
    if (v.pessoaId !== petId) continue;
    const chave = v.nome.trim().toLowerCase();
    const atual = por.get(chave);
    if (!atual || v.data >= atual.data) por.set(chave, v);
  }
  return [...por.values()].sort((a, b) => b.data.localeCompare(a.data));
}

/** Reforço vencido: é a dose mais recente daquela vacina e a data já passou. */
export function reforcoVencido(s: State, v: Vacina, hoje = HOJE): boolean {
  return !!v.proxima && v.proxima < hoje && ultimasVacinas(s, v.pessoaId).some((x) => x.id === v.id);
}

export interface Cuidado { chave: string; titulo: string; sub: string; data: string; vencido: boolean }

/** Próximos reforços de vacina e próximas prevenções do pet, por data (vencidos primeiro). */
export function proximosCuidados(s: State, petId: string, hoje = HOJE): Cuidado[] {
  const vacinas = ultimasVacinas(s, petId)
    .filter((v) => v.proxima)
    .map((v) => ({ chave: `vacina|${v.id}`, titulo: v.nome, sub: 'Reforço de vacina', data: v.proxima! }));
  const prevencoes = ultimasPrevencoes(s, petId).map((p) => ({
    chave: `prevencao|${p.id}`,
    titulo: p.produto.trim() || NOMES_PREVENCAO[p.tipo],
    sub: p.tipo === 'outro' ? 'Prevenção' : NOMES_PREVENCAO[p.tipo],
    data: proximaPrevencao(p),
  }));
  return [...vacinas, ...prevencoes].map((c) => ({ ...c, vencido: c.data < hoje })).sort((a, b) => a.data.localeCompare(b.data));
}

/** "vencida há 3 dias" / "vencida há 1 dia". */
export function vencidaHa(data: string, hoje = HOJE): string {
  const n = diasEntre(data, hoje);
  return `vencida há ${n} ${n === 1 ? 'dia' : 'dias'}`;
}

/** Nova aplicação a partir da última: mesmo tipo, produto e intervalo, na data de hoje. */
export function novaAplicacao(ultima: Prevencao, id: string, hoje = HOJE): Prevencao {
  return { id, pessoaId: ultima.pessoaId, tipo: ultima.tipo, produto: ultima.produto, data: hoje, intervaloDias: ultima.intervaloDias };
}

/** Pesagens da mais recente para a mais antiga, com a diferença para a anterior ("+0,4 kg", "−0,2 kg"). */
export function historicoPeso(s: State, petId: string): { pesagem: Pesagem; delta?: string }[] {
  const asc = s.pesagens.filter((x) => x.pessoaId === petId).map((x, i) => ({ x, i })).sort((a, b) => a.x.data.localeCompare(b.x.data) || a.i - b.i).map((o) => o.x);
  return asc
    .map((pesagem, i) => {
      if (i === 0) return { pesagem };
      const d = Math.round((pesagem.kg - asc[i - 1].kg) * 10) / 10;
      return { pesagem, delta: d === 0 ? 'sem mudança' : `${d > 0 ? '+' : '−'}${numBR(Math.abs(d), 1)} kg` };
    })
    .reverse();
}

/** "Macho" / "Fêmea" a partir do sexo guardado na pessoa. */
export const sexoPet = (p: Pessoa) => (p.sexo === 'Feminino' ? 'Fêmea' : p.sexo === 'Masculino' ? 'Macho' : undefined);
/** "Castrada" / "Castrado" / "Castrado(a)" conforme o sexo. */
export const rotuloCastrado = (p: { sexo?: string }) => (p.sexo === 'Feminino' ? 'Castrada' : p.sexo === 'Masculino' ? 'Castrado' : 'Castrado(a)');
/** Link de ligação: só dígitos e "+". */
export const telHref = (tel: string) => `tel:${tel.replace(/[^\d+]/g, '')}`;

/** Cabeçalho do perfil: "Cachorro · Border Collie · Fêmea · 4 anos" (+ " · nasc. DD/MM/AAAA" com `nascimento`). */
export function linhaPet(p: Pessoa, nascimento = false): string {
  const anos = idade(p);
  return [
    'Cachorro',
    p.pet?.raca,
    sexoPet(p),
    anos != null && `${anos} ${anos === 1 ? 'ano' : 'anos'}`,
    nascimento && p.nascimento && `nasc. ${dataBR(p.nascimento)}`,
  ].filter(Boolean).join(' · ');
}

// ── Resumo para consulta veterinária ────────────────────────────────────────

export type SecaoPet = 'identificacao' | 'peso' | 'alergias' | 'remedios' | 'vacinas' | 'prevencao' | 'sintomas' | 'procedimentos';
export const SECOES_PET: { id: SecaoPet; nome: string }[] = [
  { id: 'identificacao', nome: 'Identificação do pet' },
  { id: 'peso', nome: 'Peso' },
  { id: 'alergias', nome: 'Alergias' },
  { id: 'remedios', nome: 'Remédios em uso' },
  { id: 'vacinas', nome: 'Vacinas' },
  { id: 'prevencao', nome: 'Prevenção' },
  { id: 'sintomas', nome: 'Sintomas (30 dias)' },
  { id: 'procedimentos', nome: 'Procedimentos' },
];

/** "Dipirona (coceira, inchaço)" — o mesmo formato das alergias no resumo das pessoas. */
export const linhaAlergia = (a: { substancia: string; reacao?: string }) =>
  `${a.substancia}${a.reacao ? ` (${a.reacao.toLowerCase().replace(' e ', ', ')})` : ''}`;

/**
 * Linhas de cada seção do resumo do pet (os remédios ficam com o documento, que mostra a adesão).
 * Vacinas: a última de cada uma, com o reforço. Prevenção: a última de cada tipo, pela próxima data.
 */
export function resumoPet(s: State, p: Pessoa, hoje = HOJE): Record<Exclude<SecaoPet, 'remedios'>, string[]> {
  const d = p.pet;
  const castracao = d?.castrado == null ? undefined : d.castrado ? rotuloCastrado(p) : `Não ${rotuloCastrado(p).toLowerCase()}`;
  const extra = [castracao, d?.microchip && `microchip ${d.microchip}`].filter(Boolean).join(' · ');
  const prazo = (data: string, rotulo: string) => (data < hoje ? `${rotulo} vencida em ${dataBR(data)}` : `${rotulo} ${dataBR(data)}`);
  return {
    identificacao: [linhaPet(p), extra].filter(Boolean),
    peso: historicoPeso(s, p.id).slice(0, 3).map(({ pesagem: x }) => `${numCurto(x.kg)} kg · ${dataBR(x.data)}`),
    alergias: p.alergias.map(linhaAlergia),
    vacinas: ultimasVacinas(s, p.id).map((v) =>
      [v.nome, `aplicada em ${dataBR(v.data)}`, v.proxima && (v.proxima < hoje ? `reforço vencido em ${dataBR(v.proxima)}` : `reforço ${dataBR(v.proxima)}`)].filter(Boolean).join(' · '),
    ),
    prevencao: ultimasPrevencoes(s, p.id)
      .sort((a, b) => proximaPrevencao(a).localeCompare(proximaPrevencao(b)))
      .map((x) => {
        const produto = x.produto.trim();
        const nome = produto ? `${produto}${x.tipo !== 'outro' ? ` (${NOMES_PREVENCAO[x.tipo].toLowerCase()})` : ''}` : NOMES_PREVENCAO[x.tipo];
        return `${nome} · aplicado em ${dataBR(x.data)} · ${prazo(proximaPrevencao(x), 'próxima')}`;
      }),
    sintomas: sintomasRecentes(s, p.id, 30, hoje).map((x) => [diaMes(x.data), x.sinais.join(', '), x.nota].filter(Boolean).join(' · ')),
    procedimentos: s.procedimentos
      .filter((x) => x.pessoaId === p.id)
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((x) => [tituloProcedimento(x), dataBR(x.data), x.clinica, equipeProcedimento(x)].filter(Boolean).join(' · ')),
  };
}
