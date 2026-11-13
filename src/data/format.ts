import { HOJE } from './seed';
import type { Pessoa, Remedio } from './types';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const hoje = () => parseISO(HOJE);
const pad = (n: number) => String(n).padStart(2, '0');

/** "Quarta, 28 de outubro" */
export const dataLonga = (iso: string) => {
  const d = parseISO(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};
/** "QUINTA, 5 DE NOVEMBRO" (rótulo de grupo) */
export const dataGrupo = (iso: string) => dataLonga(iso).toUpperCase();
/** "28/10/2026" */
export const dataBR = (iso: string) => {
  const d = parseISO(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
/** "28/10" */
export const diaMes = (iso: string) => dataBR(iso).slice(0, 5);
/** "12/09/26" */
export const dataCurta = (iso: string) => dataBR(iso).slice(0, 6) + dataBR(iso).slice(8);
/** "NOV" */
export const mesSigla = (iso: string) => MESES[parseISO(iso).getMonth()].slice(0, 3).toUpperCase();
export const nomeMes = (m: number) => MESES[m];
export const mesAno = (iso: string) => {
  const d = parseISO(iso);
  return `${MESES[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
};
/** "qui, 05/11" */
export const diaSemanaCurto = (iso: string) => `${DIAS_CURTOS[parseISO(iso).getDay()]}, ${diaMes(iso)}`;
export const diaSemanaSigla = (d: Date) => DIAS_CURTOS[d.getDay()].toUpperCase();

export function diasEntre(aIso: string, bIso: string) {
  return Math.round((parseISO(bIso).getTime() - parseISO(aIso).getTime()) / 86400000);
}
export function addDias(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function idade(p: Pessoa) {
  if (!p.nascimento) return undefined;
  const n = parseISO(p.nascimento);
  const h = hoje();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

/** Nome como aparece para quem está logado: "Você" para si mesmo. */
export const quem = (p: Pessoa | undefined) => (p?.souEu ? 'Você' : p?.curto ?? '');
export const inicial = (p: Pessoa) => p.curto.charAt(0).toUpperCase();

/** Números em formato BR: 1.74 → "1,74" */
export const numBR = (n: number, casas = 2) => n.toFixed(casas).replace('.', ',');
/** "72" ou "72,5" (inteiro sem casas). */
export const numCurto = (n: number) => (Number.isInteger(n) ? String(n) : numBR(n, 1));

// ── Remédios ────────────────────────────────────────────────────────────────

export function dosesPorDia(r: Remedio) {
  return Math.max(1, r.horarios.length);
}
/** Quantas unidades saem do estoque por dose: "2 comprimidos" → 2, "½ comprimido" → 0,5, "1,5 comp." → 1,5. */
export function qtdPorDose(r: Pick<Remedio, 'dose' | 'doseLonga'>) {
  const t = (r.doseLonga ?? r.dose).trim();
  const fr = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fr && Number(fr[1]) && Number(fr[2])) return Number(fr[1]) / Number(fr[2]);
  const m = t.match(/^(\d+(?:[.,]\d+)?)?\s*(½)?/);
  const n = (m?.[1] ? Number(m[1].replace(',', '.')) : 0) + (m?.[2] ? 0.5 : 0);
  return n > 0 ? n : 1;
}
/** Soma ou tira do estoque sem resto de ponto flutuante e sem passar de zero. */
export const somarEstoque = (estoque: number, delta: number) => Math.max(0, Math.round((estoque + delta) * 100) / 100);
export function diasDeEstoque(r: Remedio) {
  if (r.estoque == null) return undefined;
  return Math.floor(r.estoque / (dosesPorDia(r) * qtdPorDose(r)) + 1e-9);
}
/** "21 comprimidos", "20,5 comprimidos". */
export const textoEstoque = (r: Remedio) => `${numCurto(r.estoque ?? 0)} ${r.unidade}`;
/** Estoque "baixo" quando os dias restantes são ≤ "Avisar para repor". */
export function estoqueBaixo(r: Remedio) {
  const d = diasDeEstoque(r);
  return d != null && r.avisarDias > 0 && d <= r.avisarDias;
}
/** Largura da barra de estoque (referência de 30 dias). */
export function pctEstoque(r: Remedio) {
  const d = diasDeEstoque(r);
  if (d == null) return 0;
  return Math.max(4, Math.min(100, Math.ceil((d / 30) * 100)));
}
/** "1 comp. às 06:30, em jejum" */
export function descricaoDose(r: Remedio) {
  if (r.seNecessario) return 'se necessário';
  const h = r.horarios.length ? ` às ${r.horarios.join(', ')}` : '';
  return `${r.dose}${h}${r.observacao ? `, ${r.observacao}` : ''}`;
}

// ── Backup ──────────────────────────────────────────────────────────────────

/** "agora", "hoje, 08:12", "ontem, 23:10", "27/10, 23:10" */
export function quando(iso?: string | null) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (Math.abs(Date.now() - d.getTime()) < 60_000 && iso.length > 19) return 'agora';
  const dia = toISO(d);
  if (dia === HOJE) return `hoje, ${hhmm}`;
  if (dia === addDias(HOJE, -1)) return `ontem, ${hhmm}`;
  return `${diaMes(dia)}, ${hhmm}`;
}

/** 18874368 → "18 MB" · 5300 → "6 KB" */
export function tamanhoArquivo(bytes?: number | null) {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : numBR(mb, 1)} MB`;
}

/** "C:\Users\voce\Documents\Arquivo da família" → "Documents / Arquivo da família" */
export function pastaCurta(p: string) {
  const partes = p.split(/[\\/]/).filter(Boolean);
  return partes.length <= 2 ? partes.join(' / ') : partes.slice(-2).join(' / ');
}

// ── Telefone ────────────────────────────────────────────────────────────────

/**
 * Máscara enquanto digita: "21991549211" → "(21) 99154-9211"; fixo "2134567890" → "(21) 3456-7890".
 * Centrais: "08009700500" → "0800 970 0500"; "40045900" → "4004 5900" (nenhum DDD começa ou termina em 0).
 * Números com "+" (estrangeiros) ou mais de 11 dígitos ficam como digitados.
 */
export function mascararTelefone(v: string) {
  if (v.trim().startsWith('+')) return v;
  const d = v.replace(/\D/g, '');
  if (d.length > 11) return v;
  if (d.length === 0) return '';
  if (d[0] === '0') return [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(' ');
  if (d[1] === '0') return d.length > 8 ? v : [d.slice(0, 4), d.slice(4)].filter(Boolean).join(' ');
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = resto.length > 8 ? 5 : 4;
  return resto.length <= corte ? `(${ddd}) ${resto}` : `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
