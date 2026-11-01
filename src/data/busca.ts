// Busca global e linha do tempo da pessoa. Funções puras, testadas em busca.test.ts.

import type { State } from './store';
import type { Categoria } from './types';
import { dataBR } from './format';
import { fmtResultado } from './resultados';
import { fmtMedicao, infoMedicao } from './medicoes';

export interface Achado { tipo: string; titulo: string; sub: string; rota: string; data?: string }

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Procura em pessoas, remédios, consultas, exames (inclusive valores), planos e vacinas.
 * `podeVer(pessoaId, categoria)` esconde o que a pessoa não compartilha.
 */
export function buscar(s: State, termo: string, podeVer: (pessoaId: string, c: Categoria) => boolean, limite = 30): Achado[] {
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  const casa = (...campos: (string | undefined)[]) => {
    const texto = norm(campos.filter(Boolean).join(' '));
    return palavras.every((p) => texto.includes(p));
  };
  const nome = (id: string) => s.pessoas.find((p) => p.id === id)?.curto ?? '';
  const out: Achado[] = [];

  for (const p of s.pessoas) {
    if (casa(p.nome, p.curto, p.parentesco, ...p.condicoes.map((c) => c.nome), ...p.alergias.map((a) => a.substancia))) {
      out.push({ tipo: p.tipo === 'pet' ? 'Pet' : 'Pessoa', titulo: p.nome, sub: p.parentesco ?? (p.souEu ? 'você' : ''), rota: `/pessoa/${p.id}` });
    }
  }
  for (const r of s.remedios) {
    if (podeVer(r.pessoaId, 'remedios') && casa(r.nome, r.indicacao, nome(r.pessoaId))) {
      out.push({ tipo: 'Remédio', titulo: r.nome, sub: `${nome(r.pessoaId)} · ${r.ativo ? r.horarios.join(', ') || 'se necessário' : 'encerrado'}`, rota: `/remedios/${r.id}` });
    }
  }
  for (const c of s.consultas) {
    if (podeVer(c.pessoaId, 'consultas') && casa(c.titulo, c.profissional, c.local, c.anotacaoPos, nome(c.pessoaId))) {
      out.push({ tipo: 'Consulta', titulo: c.titulo, sub: [nome(c.pessoaId), dataBR(c.data), c.profissional].filter(Boolean).join(' · '), rota: `/consulta/${c.id}/resumo`, data: c.data });
    }
  }
  for (const e of s.exames) {
    if (!podeVer(e.pessoaId, 'exames')) continue;
    const valor = (e.resultados ?? []).find((r) => casa(r.marcador));
    if (valor || casa(e.nome, e.laboratorio, e.solicitante, e.anotacao, e.categoria, nome(e.pessoaId))) {
      out.push({ tipo: 'Exame', titulo: e.nome, sub: [nome(e.pessoaId), dataBR(e.dataColeta), valor && `${valor.marcador} ${fmtResultado(valor)}`].filter(Boolean).join(' · '), rota: `/exames/${e.id}`, data: e.dataColeta });
    }
  }
  for (const pl of s.planos) {
    if (podeVer(pl.pessoaId, 'plano') && casa(pl.operadora, pl.produto, pl.numero, nome(pl.pessoaId))) {
      out.push({ tipo: 'Plano', titulo: `${pl.operadora} · ${pl.produto}`, sub: `${nome(pl.pessoaId)} · ${pl.numero}`, rota: `/pessoa/${pl.pessoaId}/plano` });
    }
  }
  for (const v of s.vacinas) {
    if (podeVer(v.pessoaId, 'perfil') && casa(v.nome, 'vacina', nome(v.pessoaId))) {
      out.push({ tipo: 'Vacina', titulo: v.nome, sub: `${nome(v.pessoaId)} · ${dataBR(v.data)}`, rota: `/pessoa/${v.pessoaId}`, data: v.data });
    }
  }
  return out.slice(0, limite);
}

export interface Evento { data: string; tipo: string; titulo: string; sub?: string; rota?: string }

/** Tudo da pessoa em ordem cronológica (mais recente primeiro). */
export function linhaDoTempo(s: State, pessoaId: string, podeVer: (c: Categoria) => boolean, hoje: string): Evento[] {
  const out: Evento[] = [];
  if (podeVer('consultas')) {
    for (const c of s.consultas.filter((x) => x.pessoaId === pessoaId)) {
      out.push({ data: c.data, tipo: c.data > hoje ? 'Marcado' : c.tipo === 'exame' ? 'Exame feito' : 'Consulta', titulo: c.titulo, sub: [c.hora, c.profissional, c.anotacaoPos].filter(Boolean).join(' · '), rota: `/consulta/${c.id}/resumo` });
    }
  }
  if (podeVer('exames')) {
    for (const e of s.exames.filter((x) => x.pessoaId === pessoaId)) {
      out.push({ data: e.dataColeta, tipo: 'Exame', titulo: e.nome, sub: [e.laboratorio, ...(e.resultados ?? []).slice(0, 3).map((r) => `${r.marcador} ${fmtResultado(r)}`)].filter(Boolean).join(' · '), rota: `/exames/${e.id}` });
    }
  }
  if (podeVer('remedios')) {
    for (const r of s.remedios.filter((x) => x.pessoaId === pessoaId)) {
      if (r.inicio) out.push({ data: r.inicio, tipo: 'Remédio', titulo: `Começou ${r.nome}`, sub: r.horarios.join(', ') || undefined, rota: `/remedios/${r.id}` });
      if (r.fim && r.fim <= hoje) {
        out.push({ data: r.fim, tipo: 'Remédio', titulo: `Terminou ${r.nome}`, rota: `/remedios/${r.id}` });
      }
    }
  }
  if (podeVer('perfil')) {
    for (const v of s.vacinas.filter((x) => x.pessoaId === pessoaId)) out.push({ data: v.data, tipo: 'Vacina', titulo: v.nome, sub: v.veterinario });
    for (const p of s.procedimentos.filter((x) => x.pessoaId === pessoaId)) out.push({ data: p.data, tipo: 'Procedimento', titulo: p.descricao || p.tipo, sub: p.clinica });
    for (const x of s.sintomas.filter((y) => y.pessoaId === pessoaId)) out.push({ data: x.data, tipo: 'Sintoma', titulo: x.sinais.join(', '), sub: x.nota });
    // Medições: só a pressão e o peso, que contam a história (o resto fica no gráfico).
    for (const m of s.medicoes.filter((y) => y.pessoaId === pessoaId && (y.tipo === 'pressao' || y.tipo === 'peso'))) {
      out.push({ data: m.data, tipo: 'Medição', titulo: `${infoMedicao(m.tipo).nome} ${fmtMedicao(m)} ${infoMedicao(m.tipo).unidade}` });
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}
