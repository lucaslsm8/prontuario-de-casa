// Crianças e adolescentes: curva de altura comparada à mediana da OMS e o calendário de vacinas do SUS.
// Funções puras, testadas em criancas.test.ts. Tabelas embutidas (o app é offline); nada é consultado.

import type { Medicao, Pessoa, Vacina } from './types';
import type { Ponto } from './medicoes';

const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Meses completos entre o nascimento e a data. */
export function idadeMeses(nasc: string, iso: string): number {
  const [y0, m0, d0] = nasc.split('-').map(Number);
  const [y1, m1, d1] = iso.slice(0, 10).split('-').map(Number);
  return (y1 - y0) * 12 + (m1 - m0) - (d1 < d0 ? 1 : 0);
}
const somarMeses = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return isoDe(Date.UTC(y, m - 1 + n, d)); };

/** Pessoa com nascimento e menos de 18 anos (pet não entra). */
export const ehCrianca = (p: Pick<Pessoa, 'tipo' | 'nascimento'>, hoje: string) => p.tipo !== 'pet' && !!p.nascimento && idadeMeses(p.nascimento, hoje) < 18 * 12;

// ── Altura × idade ──────────────────────────────────────────────────────────

/**
 * Mediana da altura (cm) por idade em anos completos, 0 a 18 anos: padrões de crescimento da OMS
 * (2006, até 5 anos) e referência OMS 2007 (5 a 19 anos). Entre os anos, interpolação linear.
 */
const MEDIANA_ALTURA: Record<'Masculino' | 'Feminino', number[]> = {
  Masculino: [49.9, 75.7, 87.8, 96.1, 103.3, 110.0, 116.0, 121.7, 127.3, 132.6, 137.8, 143.1, 149.1, 156.0, 163.2, 169.0, 172.9, 175.2, 176.1],
  Feminino: [49.1, 74.0, 86.4, 95.1, 102.7, 109.4, 115.1, 120.8, 126.6, 132.5, 138.6, 144.9, 151.2, 156.4, 159.8, 161.7, 162.5, 162.9, 163.1],
};

/** Mediana da OMS (cm) para a idade em meses; `undefined` sem sexo ou fora de 0–18 anos. */
export function medianaAltura(sexo: Pessoa['sexo'], meses: number): number | undefined {
  if (!sexo || meses < 0 || meses > 18 * 12) return undefined;
  const t = MEDIANA_ALTURA[sexo];
  const a = Math.floor(meses / 12);
  if (a >= 18) return t[18];
  const f = (meses - a * 12) / 12;
  return Math.round((t[a] + (t[a + 1] - t[a]) * f) * 10) / 10;
}

/** Alturas da criança (cm) ao longo do tempo e a mediana da OMS nas mesmas datas, para o gráfico. */
export function curvaAltura(p: Pick<Pessoa, 'id' | 'sexo' | 'nascimento'>, medicoes: Medicao[]): { crianca: Ponto[]; mediana: Ponto[] } {
  const crianca = medicoes
    .filter((m) => m.pessoaId === p.id && m.tipo === 'altura')
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((m) => ({ data: m.data, valor: Math.round(m.valor * 1000) / 10 }));
  if (!p.nascimento || !p.sexo || !crianca.length) return { crianca, mediana: [] };
  // A mediana de mês em mês entre a primeira e a última medida.
  const ini = crianca[0].data, fim = crianca[crianca.length - 1].data;
  const mediana: Ponto[] = [];
  for (let iso = ini, i = 0; iso <= fim && i < 240; iso = somarMeses(ini, ++i)) {
    const v = medianaAltura(p.sexo, idadeMeses(p.nascimento, iso));
    if (v != null) mediana.push({ data: iso, valor: v });
  }
  const ultimo = medianaAltura(p.sexo, idadeMeses(p.nascimento, fim));
  if (ultimo != null && mediana[mediana.length - 1]?.data !== fim) mediana.push({ data: fim, valor: ultimo });
  return { crianca, mediana };
}

// ── Calendário de vacinas do SUS (criança) ──────────────────────────────────

const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

interface Serie { chave: string; nome: string; re: RegExp; doses: { meses: number; rotulo: string }[] }

/**
 * Calendário Nacional de Vacinação da criança e do adolescente (PNI), sem gripe e covid (que mudam a cada ano).
 * A tetra viral conta como 2ª dose da tríplice viral e 1ª da varicela.
 */
export const CALENDARIO_SUS: Serie[] = [
  { chave: 'bcg', nome: 'BCG', re: /\bbcg\b/, doses: [{ meses: 0, rotulo: 'dose única' }] },
  { chave: 'hepb', nome: 'Hepatite B', re: /hepatite b|\bhep\.?\s?b\b/, doses: [{ meses: 0, rotulo: '1ª dose' }] },
  { chave: 'penta', nome: 'Pentavalente', re: /pentavalente|\bpenta\b/, doses: [{ meses: 2, rotulo: '1ª dose' }, { meses: 4, rotulo: '2ª dose' }, { meses: 6, rotulo: '3ª dose' }] },
  { chave: 'polio', nome: 'Poliomielite (VIP)', re: /\bvip\b|\bvop\b|polio/, doses: [{ meses: 2, rotulo: '1ª dose' }, { meses: 4, rotulo: '2ª dose' }, { meses: 6, rotulo: '3ª dose' }, { meses: 15, rotulo: 'reforço' }] },
  { chave: 'pneumo', nome: 'Pneumocócica 10-valente', re: /pneumo/, doses: [{ meses: 2, rotulo: '1ª dose' }, { meses: 4, rotulo: '2ª dose' }, { meses: 12, rotulo: 'reforço' }] },
  { chave: 'rota', nome: 'Rotavírus', re: /rota/, doses: [{ meses: 2, rotulo: '1ª dose' }, { meses: 4, rotulo: '2ª dose' }] },
  { chave: 'menc', nome: 'Meningocócica C', re: /meningoc\w*\s*c\b|\bmen\s?c\b|meningo\s?c\b|meningoc\w*\s*conjugada/, doses: [{ meses: 3, rotulo: '1ª dose' }, { meses: 5, rotulo: '2ª dose' }, { meses: 12, rotulo: 'reforço' }] },
  { chave: 'fa', nome: 'Febre amarela', re: /febre amarela/, doses: [{ meses: 9, rotulo: '1ª dose' }, { meses: 48, rotulo: 'reforço' }] },
  { chave: 'scr', nome: 'Tríplice viral', re: /triplice viral|\bscr\b|sarampo|tetra\s?viral|\bscrv\b/, doses: [{ meses: 12, rotulo: '1ª dose' }, { meses: 15, rotulo: '2ª dose (ou tetra viral)' }] },
  { chave: 'hepa', nome: 'Hepatite A', re: /hepatite a|\bhep\.?\s?a\b/, doses: [{ meses: 15, rotulo: 'dose única' }] },
  { chave: 'dtp', nome: 'DTP (tríplice bacteriana)', re: /\bdtp\b|triplice bacteriana/, doses: [{ meses: 15, rotulo: '1º reforço' }, { meses: 48, rotulo: '2º reforço' }] },
  { chave: 'varicela', nome: 'Varicela', re: /varicela|catapora|tetra\s?viral|\bscrv\b/, doses: [{ meses: 15, rotulo: '1ª dose (ou tetra viral)' }, { meses: 48, rotulo: '2ª dose' }] },
  { chave: 'hpv', nome: 'HPV', re: /\bhpv\b/, doses: [{ meses: 9 * 12, rotulo: 'dose única, de 9 a 14 anos' }] },
  { chave: 'acwy', nome: 'Meningocócica ACWY', re: /acwy/, doses: [{ meses: 11 * 12, rotulo: 'de 11 a 14 anos' }] },
];

export type EstadoVacinaSUS = 'feita' | 'atrasada' | 'agora' | 'depois';
export interface ItemCalendario { chave: string; nome: string; rotulo: string; meses: number; quando: string; estado: EstadoVacinaSUS; data?: string }

/** "Ao nascer", "2 meses", "1 ano e 3 meses", "4 anos". */
export function textoIdade(meses: number): string {
  if (meses === 0) return 'Ao nascer';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const a = Math.floor(meses / 12), m = meses % 12;
  const anos = `${a} ${a === 1 ? 'ano' : 'anos'}`;
  return m ? `${anos} e ${m} ${m === 1 ? 'mês' : 'meses'}` : anos;
}

/**
 * Cada dose do calendário com o estado para a criança hoje. As vacinas registradas de mesmo nome
 * (pelo apelido: "Penta", "VIP", "Tetra viral"…) preenchem as doses na ordem das datas.
 * Atrasada: passou 1 mês da idade (6 meses no HPV e na ACWY, que têm faixa) e não há registro.
 */
export function calendarioSUS(nasc: string, vacinas: Pick<Vacina, 'nome' | 'data'>[], hoje: string): ItemCalendario[] {
  const idade = idadeMeses(nasc, hoje);
  const out: ItemCalendario[] = [];
  for (const s of CALENDARIO_SUS) {
    // Polio: a VOP/VIP do reforço e as doses entram na mesma série; DTP não conta a pentavalente.
    const feitas = vacinas.filter((v) => s.re.test(sem(v.nome)) && !(s.chave === 'dtp' && /penta/.test(sem(v.nome)))).map((v) => v.data).sort();
    s.doses.forEach((d, i) => {
      const data = feitas[i];
      const folga = d.meses >= 9 * 12 ? 6 : 1;
      const estado: EstadoVacinaSUS = data ? 'feita' : idade > d.meses + folga ? 'atrasada' : idade >= d.meses ? 'agora' : 'depois';
      out.push({ chave: `${s.chave}-${i}`, nome: s.nome, rotulo: d.rotulo, meses: d.meses, quando: textoIdade(d.meses), estado, ...(data ? { data } : {}) });
    });
  }
  return out.sort((a, b) => a.meses - b.meses || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Resumo para o topo do cartão: atrasadas e as da idade de agora. */
export const pendenciasSUS = (itens: ItemCalendario[]) => ({
  atrasadas: itens.filter((i) => i.estado === 'atrasada').length,
  agora: itens.filter((i) => i.estado === 'agora').length,
});
