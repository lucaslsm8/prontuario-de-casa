import type { CategoriaExame, Plano } from './types';

// ── Listas compartilhadas ───────────────────────────────────────────────────

export interface Frequencia { id: string; nome: string; horarios: string[] }

export const FREQUENCIAS: Frequencia[] = [
  { id: '24', nome: '1x ao dia', horarios: ['08:00'] },
  { id: '12', nome: 'De 12 em 12 horas', horarios: ['08:00', '20:00'] },
  { id: '8', nome: 'De 8 em 8 horas', horarios: ['07:00', '15:00', '23:00'] },
  { id: '6', nome: 'De 6 em 6 horas', horarios: ['06:00', '12:00', '18:00', '00:00'] },
  { id: 'sn', nome: 'Se necessário', horarios: [] },
];
export const DOSES = ['1 cápsula', '2 cápsulas', '1 comprimido', '½ comprimido', '2 comprimidos'];
export const DURACOES = [7, 10, 14, 30, 0];
/** Dias antes de acabar para avisar; 0 = não avisar. */
export const AVISAR = [3, 5, 7, 10, 0];
export const nomeAvisar = (v: number) => (v ? `${v} dias antes` : 'Não avisar');
export const PARENTESCO = [
  { id: 'cônjuge', nome: 'Cônjuge' },
  { id: 'filho', nome: 'Filho(a)' },
  { id: 'pai ou mãe', nome: 'Pai ou mãe' },
  { id: 'outro', nome: 'Outro' },
];
export const SANGUE = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
export const CORES = ['#E2E0EE', '#EEE7D6', '#D6E8E9', '#E6EEDA', '#F0E1E4'];
export const CATEGORIAS_EXAME: CategoriaExame[] = [
  'Sangue', 'Urina', 'Fezes', 'Imagem', 'Coração', 'Hormônios', 'Ginecológico', 'Urológico', 'Oftalmológico', 'Pele', 'Sorologia', 'Laudo / atestado', 'Outro',
];
export const LEMBRAR = ['2 h antes', '1 dia antes', '1 semana'];

// ── Funções puras ───────────────────────────────────────────────────────────

export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}

export const RE_DATA_HORA = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\D+(\d{1,2})[:h](\d{2})/;

/** "18/11 · 14:00", "18/11/2026 14:00" ou "18/11 14h00" → data ISO e hora. Sem ano: o de `hoje`, ou o próximo se já passou. */
export function lerDataHora(texto: string, hoje: string): { data: string; hora: string } | null {
  const m = texto.match(RE_DATA_HORA);
  if (!m) return null;
  const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
  let ano = m[3] ? Number(m[3]) : Number(hoje.slice(0, 4));
  if (!m[3] && `${ano}-${mm}-${dd}` < hoje) ano++;
  return { data: `${ano}-${mm}-${dd}`, hora: `${m[4].padStart(2, '0')}:${m[5]}` };
}

/** "14", "1400", "930", "9:30" ou "14h30" → "HH:MM". O que não for uma hora válida volta como veio. */
export function normalizarHora(texto: string): string {
  const m = texto.trim().match(/^(\d{1,2})(?:[:h]?(\d{2}))?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return texto;
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
}

/** "DD/MM/AAAA" → ISO. Vazio → `{}`; inválido ou no futuro → `{ erro }`. */
export function lerNascimento(texto: string, hoje: string): { iso?: string; erro?: string } {
  if (!texto) return {};
  const [d, m, y] = texto.split('/');
  const iso = `${y}-${m}-${d}`;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (!y || y.length !== 4 || dt.getDate() !== Number(d) || dt.getMonth() !== Number(m) - 1 || iso > hoje) {
    return { erro: 'Data inválida. Use DD/MM/AAAA.' };
  }
  return { iso };
}

/** Data e hora em campos separados → texto de `quando` ("DD/MM/AAAA · HH:MM"). */
export function juntarDataHora(data: string, hora: string): string {
  return [data.trim(), hora.trim()].filter(Boolean).join(' · ');
}

// ── Datas dos registros (pets) ──────────────────────────────────────────────

/** "DD/MM/AAAA" → ISO. Incompleta ou inexistente (31/04, 29/02 fora de bissexto) → undefined. */
export function brParaISO(texto: string): string | undefined {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mes, y] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d)));
  if (dt.getUTCDate() !== Number(d) || dt.getUTCMonth() !== Number(mes) - 1) return undefined;
  return `${y}-${mes}-${d}`;
}

/** ISO yyyy-mm-dd → "DD/MM/AAAA". */
export function isoParaBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** ISO yyyy-mm-dd + N dias (calendário UTC, sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** ISO + N meses; sem o dia no mês de destino, fica no último (31/08 + 6 meses = 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** ISO + N anos (29/02 vira 28/02 em ano não bissexto). */
export const somarAnos = (iso: string, anos: number) => somarMeses(iso, anos * 12);

/** Data de um registro (aplicação, pesagem…): obrigatória, válida e, sem `futuro`, até hoje. */
export function lerDataRegistro(texto: string, hoje: string, { futuro = false }: { futuro?: boolean } = {}): { iso?: string; erro?: string } {
  if (!texto.trim()) return { erro: 'Informe a data.' };
  const iso = brParaISO(texto);
  if (!iso) return { erro: 'Data inválida. Use DD/MM/AAAA.' };
  if (!futuro && iso > hoje) return { erro: 'A data não pode ser depois de hoje.' };
  return { iso };
}

export type AtalhoReforco = '1a' | '6m' | '21d' | 'sem';
export const ATALHOS_REFORCO: { id: AtalhoReforco; nome: string }[] = [
  { id: '1a', nome: '1 ano' },
  { id: '6m', nome: '6 meses' },
  { id: '21d', nome: '21 dias' },
  { id: 'sem', nome: 'Sem reforço' },
];

/** Próximo reforço pelo atalho, a partir da data da vacina ("Sem reforço" → undefined). */
export function dataDoReforco(iso: string, atalho: AtalhoReforco): string | undefined {
  if (atalho === '1a') return somarAnos(iso, 1);
  if (atalho === '6m') return somarMeses(iso, 6);
  if (atalho === '21d') return somarDias(iso, 21);
  return undefined;
}

/** Próximo reforço digitado: vazio = sem reforço; se houver data da vacina, precisa ser depois dela. */
export function lerReforco(texto: string, dataVacina: string | undefined): { iso?: string; erro?: string } {
  if (!texto.trim()) return {};
  const iso = brParaISO(texto);
  if (!iso) return { erro: 'Data inválida. Use DD/MM/AAAA.' };
  if (dataVacina && iso <= dataVacina) return { erro: 'O reforço precisa ser depois da vacina.' };
  return { iso };
}

/** "A cada N dias" da prevenção: inteiro de 1 a 365. */
export function lerIntervaloDias(texto: string): number | undefined {
  const t = texto.trim();
  if (!/^\d{1,3}$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= 365 ? n : undefined;
}

// ── Plano de saúde ──────────────────────────────────────────────────────────

export const ACOMODACOES = ['Apartamento', 'Enfermaria'] as const;
export const SEGMENTACOES = ['Ambulatorial + hospitalar', 'Ambulatorial', 'Hospitalar', 'Odontológico'] as const;
export const ABRANGENCIAS = ['Nacional', 'Estadual', 'Grupo de municípios', 'Municipal'] as const;

export interface FormPlano {
  pessoaId: string;
  operadora: string;
  numero: string;
  produto: string;
  acomodacao: string;
  segmentacao: string;
  abrangencia: string;
  validade: string;   // MM/AAAA
  vinculo: 'titular' | 'dependente';
  titularNome: string;
  registroAns: string;
  central: string;
  cns: string;
  carencias: string;
  mensalidade: string;
  anotacao: string;
}
export type ErrosPlano = Partial<Record<'operadora' | 'numero' | 'validade' | 'titularNome', string>>;

/** "082028" / "8/28" → "08/2028" enquanto digita. */
export function mascaraValidade(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 6);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Valida o formulário e monta o plano (sem id). Campos opcionais vazios ficam de fora. */
export function montarPlano(f: FormPlano): { plano?: Omit<Plano, 'id'>; erros: ErrosPlano } {
  const t = (s: string) => s.trim().replace(/\s+/g, ' ');
  const erros: ErrosPlano = {};
  if (!t(f.operadora)) erros.operadora = 'Informe a operadora.';
  if (!t(f.numero)) erros.numero = 'Informe o número da carteirinha.';
  const val = t(f.validade);
  if (val && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(val)) erros.validade = 'Use MM/AAAA.';
  if (f.vinculo === 'dependente' && !t(f.titularNome)) erros.titularNome = 'Informe o nome do titular.';
  if (Object.keys(erros).length) return { erros };
  const ou = (s: string) => t(s) || undefined;
  const odonto = f.segmentacao === 'Odontológico';
  return {
    erros,
    plano: {
      pessoaId: f.pessoaId,
      operadora: t(f.operadora),
      numero: t(f.numero),
      produto: t(f.produto),
      acomodacao: odonto ? '—' : f.acomodacao,
      acomodacaoCurta: odonto ? '—' : f.acomodacao === 'Apartamento' ? 'Apto' : 'Enf.',
      segmentacao: f.segmentacao,
      abrangencia: f.abrangencia,
      carencias: t(f.carencias) || '—',
      validade: val || '—',
      vinculo: f.vinculo,
      titularNome: t(f.titularNome),
      registroAns: t(f.registroAns) || '—',
      cns: ou(f.cns),
      central: ou(f.central),
      mensalidade: ou(f.mensalidade),
      anotacao: ou(f.anotacao),
    },
  };
}

// ── Edição de registros ─────────────────────────────────────────────────────

/** "06:30, 21h" → ["06:30", "21:00"] (ordenados, sem repetir). Algo inválido → undefined. */
export function lerHorarios(texto: string): string[] | undefined {
  const partes = texto.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const hs = partes.map((x) => normalizarHora(x.replace(/h$/i, '')));
  if (hs.some((h) => !/^\d{2}:\d{2}$/.test(h))) return undefined;
  return [...new Set(hs)].sort();
}

/** Só os campos que mudaram; campo que sumiu vira `null` (o reducer apaga). */
export function diffRegistro<T extends object>(antes: T, depois: T): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const a = antes as Record<string, unknown>;
  const d = depois as Record<string, unknown>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (k === 'id') continue;
    if (JSON.stringify(a[k]) === JSON.stringify(d[k])) continue;
    patch[k] = d[k] === undefined ? null : d[k];
  }
  return patch;
}

/** A frequência de um remédio salvo (as da lista ou "personalizada" com os horários dele). */
export function freqDoRemedio(r: { frequencia?: string; horarios: string[]; seNecessario?: boolean }): Frequencia {
  if (r.seNecessario) return FREQUENCIAS.find((f) => f.id === 'sn')!;
  return FREQUENCIAS.find((f) => f.nome === r.frequencia && f.horarios.join() === r.horarios.join())
    ?? FREQUENCIAS.find((f) => f.nome === r.frequencia)
    ?? { id: 'outra', nome: r.frequencia || `${r.horarios.length}x ao dia`, horarios: r.horarios };
}

/**
 * O nome do remédio guardado continua "Losartana 50 mg" (as telas e aparelhos com versão antiga mostram `nome`);
 * a dosagem também vai à parte, em `dosagem`. Para editar, separa de volta.
 */
export function partesDoRemedio(r: { nome: string; dosagem?: string }): [string, string] {
  const d = r.dosagem?.trim();
  if (d) {
    const nome = r.nome.trim();
    return [nome.toLowerCase().endsWith(` ${d.toLowerCase()}`) ? nome.slice(0, -d.length - 1).trim() : nome, d];
  }
  const m = r.nome.trim().match(/^(.*\S)\s+(\d[\d.,]*\s*(?:mcg|mg|g|ml|mL|UI|%)(?:\/\S+)?)$/);
  return m ? [m[1], m[2]] : [r.nome.trim(), ''];
}

/** "Losartana" + "50mg" → "Losartana 50 mg". */
export function nomeComDosagem(nome: string, dosagem: string) {
  const d = dosagem.trim().replace(/^(\d[\d.,]*)\s*(mcg|mg|g|ml|mL|UI)$/i, (_, n, u) => `${n} ${u.toLowerCase() === 'ui' ? 'UI' : u.toLowerCase() === 'ml' ? 'mL' : u.toLowerCase()}`);
  return [nome.trim(), d].filter(Boolean).join(' ');
}
