// Despesas de saúde e o resumo para o Imposto de Renda (IRPF, ficha "Pagamentos efetuados").
// Funções puras, testadas em despesas.test.ts. Nada é enviado: o resumo sai como texto ou CSV que a pessoa salva.

import type { Consulta, Despesa, Pessoa, TipoDespesa } from './types';

/**
 * Tipos e se entram como dedução médica no IRPF. Dedutíveis: médicos, dentistas, psicólogos,
 * fisioterapeutas, fonoaudiólogos, terapeutas ocupacionais, hospitais, exames e plano de saúde.
 * Remédio comprado na farmácia não é dedutível (só quando vem na conta do hospital).
 */
export const TIPOS_DESPESA: { id: TipoDespesa; nome: string; dedutivel: boolean }[] = [
  { id: 'consulta', nome: 'Consulta médica', dedutivel: true },
  { id: 'exame', nome: 'Exame', dedutivel: true },
  { id: 'dentista', nome: 'Dentista', dedutivel: true },
  { id: 'terapia', nome: 'Psicólogo, fisio, fono ou TO', dedutivel: true },
  { id: 'hospital', nome: 'Hospital ou cirurgia', dedutivel: true },
  { id: 'plano', nome: 'Plano de saúde', dedutivel: true },
  { id: 'remedio', nome: 'Remédio (farmácia)', dedutivel: false },
  { id: 'outro', nome: 'Outro', dedutivel: false },
];
export const nomeTipoDespesa = (t: TipoDespesa) => TIPOS_DESPESA.find((x) => x.id === t)?.nome ?? 'Outro';

/** Entra no IR: tipo dedutível e de pessoa (gasto com pet não se deduz). */
export const dedutivel = (d: Pick<Despesa, 'tipo'>, p?: Pick<Pessoa, 'tipo'>) =>
  p?.tipo !== 'pet' && !!TIPOS_DESPESA.find((x) => x.id === d.tipo)?.dedutivel;

// ── CPF e CNPJ ──────────────────────────────────────────────────────────────

const so = (t: string) => t.replace(/\D/g, '');

/** Máscara enquanto digita: até 11 dígitos vira CPF (000.000.000-00), depois CNPJ (00.000.000/0000-00). */
export function mascararDocumento(t: string): string {
  const d = so(t).slice(0, 14);
  if (d.length <= 11) {
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.') + (d.length > 9 ? `-${d.slice(9)}` : '');
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}${d.length > 12 ? `-${d.slice(12)}` : ''}`;
}

function cpfValido(d: string) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
function cnpjValido(d: string) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, p, i) => a + p * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}
/** "cpf", "cnpj" ou `undefined` (vazio ou dígitos que não conferem). */
export function tipoDocumento(t: string): 'cpf' | 'cnpj' | undefined {
  const d = so(t);
  if (cpfValido(d)) return 'cpf';
  if (cnpjValido(d)) return 'cnpj';
  return undefined;
}

// ── Resumo do ano ───────────────────────────────────────────────────────────

/** Uma linha da ficha "Pagamentos efetuados": por pessoa e prestador (o mesmo CPF/CNPJ junta). */
export interface LinhaIR { pessoaId: string; prestador: string; documento?: string; tipo: TipoDespesa; pago: number; reembolsado: number; qtd: number }
export interface ResumoPessoaIR { pessoaId: string; pago: number; reembolsado: number; dedutivel: number; naoDedutivel: number; linhas: LinhaIR[] }

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Despesas do ano, por pessoa: total pago, reembolsado, o que entra no IR (pago − reembolso) e as linhas por prestador. */
export function resumoIR(despesas: Despesa[], pessoas: Pessoa[], ano: number): ResumoPessoaIR[] {
  const doAno = despesas.filter((d) => d.data.startsWith(`${ano}-`));
  const out: ResumoPessoaIR[] = [];
  for (const p of pessoas) {
    const dela = doAno.filter((d) => d.pessoaId === p.id);
    if (!dela.length) continue;
    const r: ResumoPessoaIR = { pessoaId: p.id, pago: 0, reembolsado: 0, dedutivel: 0, naoDedutivel: 0, linhas: [] };
    const mapa = new Map<string, LinhaIR>();
    for (const d of dela) {
      const reemb = Math.min(d.valor, d.reembolso ?? 0);
      r.pago += d.valor;
      r.reembolsado += reemb;
      if (!dedutivel(d, p)) { r.naoDedutivel += d.valor - reemb; continue; }
      r.dedutivel += d.valor - reemb;
      const doc = so(d.documento ?? '');
      const chave = doc || `${d.prestador.trim().toLowerCase()}|${d.tipo}`;
      const l = mapa.get(chave) ?? { pessoaId: p.id, prestador: d.prestador.trim(), documento: d.documento ? mascararDocumento(d.documento) : undefined, tipo: d.tipo, pago: 0, reembolsado: 0, qtd: 0 };
      l.pago += d.valor;
      l.reembolsado += reemb;
      l.qtd += 1;
      mapa.set(chave, l);
    }
    r.linhas = [...mapa.values()].map((l) => ({ ...l, pago: centavos(l.pago), reembolsado: centavos(l.reembolsado) })).sort((a, b) => b.pago - a.pago);
    out.push({ ...r, pago: centavos(r.pago), reembolsado: centavos(r.reembolsado), dedutivel: centavos(r.dedutivel), naoDedutivel: centavos(r.naoDedutivel) });
  }
  return out;
}

/** Anos com despesa, do mais recente; sempre inclui o ano atual. */
export const anosComDespesa = (despesas: Despesa[], hoje: string) =>
  [...new Set([Number(hoje.slice(0, 4)), ...despesas.map((d) => Number(d.data.slice(0, 4)))])].sort((a, b) => b - a);

/** Linhas dedutíveis sem CPF/CNPJ: a Receita pede o documento de cada prestador. */
export const semDocumento = (r: ResumoPessoaIR[]) => r.flatMap((p) => p.linhas).filter((l) => !l.documento);

const valorCsv = (n: number) => n.toFixed(2).replace('.', ',');
const campoCsv = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);

/** CSV (separado por ponto e vírgula, como o Excel em pt-BR abre) com uma linha por pessoa e prestador. */
export function csvIR(resumo: ResumoPessoaIR[], pessoas: Pessoa[], ano: number): string {
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? '';
  const linhas = [['Ano', 'Pessoa', 'Prestador', 'CPF/CNPJ', 'Tipo', 'Valor pago', 'Reembolsado', 'Parcela dedutível', 'Pagamentos'].join(';')];
  for (const p of resumo) {
    for (const l of p.linhas) {
      linhas.push([String(ano), nome(p.pessoaId), l.prestador, l.documento ?? '', nomeTipoDespesa(l.tipo), valorCsv(l.pago), valorCsv(l.reembolsado), valorCsv(centavos(l.pago - l.reembolsado)), String(l.qtd)].map(campoCsv).join(';'));
    }
  }
  return `${linhas.join('\r\n')}\r\n`;
}

/** Começo de uma despesa a partir da consulta (botão "Registrar pagamento" na ficha). */
export function despesaDaConsulta(c: Pick<Consulta, 'id' | 'pessoaId' | 'data' | 'tipo' | 'profissional' | 'local'>, hoje: string): Partial<Despesa> {
  return { pessoaId: c.pessoaId, data: c.data <= hoje ? c.data : hoje, tipo: c.tipo === 'exame' ? 'exame' : 'consulta', prestador: c.profissional ?? c.local ?? '', consultaId: c.id };
}
