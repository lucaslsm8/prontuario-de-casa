// "Exportar perfil em PDF": tudo de uma pessoa (ou pet) num PDF para levar a um profissional.
// Só entram as categorias que quem exporta pode ver. O conteúdo é puro (testado em relatorio.test.ts).

import type { State } from './store';
import type { Categoria, Pessoa } from './types';
import { dataBR, idade, numBR, numCurto } from './format';
import { fmtMedicao, infoMedicao } from './medicoes';
import { fmtResultado } from './resultados';
import { NOMES_PREVENCAO, ehPet, linhaPet, proximaPrevencao } from './pets';
import { gerarPdf, type Bloco } from './pdfTexto';

const juntar = (...xs: unknown[]) => xs.filter((x): x is string => typeof x === 'string' && !!x).join(' · ');

/** Blocos do relatório de `p`. `ver` diz se a categoria pode entrar (compartilhamento). */
export function blocosDoPerfil(s: State, p: Pessoa, ver: (c: Categoria) => boolean, hoje: string): Bloco[] {
  const b: Bloco[] = [];
  const secao = (texto: string) => b.push({ tipo: 'secao', texto });
  const item = (texto: string, detalhe?: string) => b.push({ tipo: 'item', texto, ...(detalhe ? { detalhe } : {}) });
  const vazio = (texto: string) => b.push({ tipo: 'texto', texto });
  const dela = <T extends { pessoaId: string }>(xs: T[]) => xs.filter((x) => x.pessoaId === p.id);
  const pet = ehPet(p);

  b.push({ tipo: 'titulo', texto: p.nome });
  b.push({ tipo: 'sub', texto: `Resumo de saúde gerado em ${dataBR(hoje)} pelo Prontuário de Casa` });

  if (ver('perfil')) {
    secao(pet ? 'Identificação' : 'Dados pessoais');
    if (pet) {
      item(linhaPet(p, true) || 'Pet');
      if (p.pet?.microchip) item(`Microchip: ${p.pet.microchip}`);
      if (p.pet?.veterinario) item(`Veterinário: ${p.pet.veterinario.nome}`, juntar(p.pet.veterinario.clinica, p.pet.veterinario.telefone));
      if (p.pet?.clinica24h) item(`Clínica 24 h: ${p.pet.clinica24h.nome}`, p.pet.clinica24h.telefone);
    } else {
      const anos = idade(p);
      if (p.nascimento) item(`Nascimento: ${dataBR(p.nascimento)}${anos != null ? ` (${anos} anos)` : ''}`);
      if (p.sexo) item(`Sexo: ${p.sexo}`);
      if (p.sangue) item(`Tipo sanguíneo: ${p.sangue}`);
      if (p.altura) item(`Altura: ${numBR(p.altura)} m`);
      if (p.peso) item(`Peso: ${numCurto(p.peso)} kg`);
      if (p.pressao) item(`Pressão: ${p.pressao.valor} mmHg`, `medida em ${dataBR(p.pressao.data)}`);
      if (p.contatoEmergencia) item(`Contato de emergência: ${p.contatoEmergencia.nome}`, juntar(p.contatoEmergencia.relacao, p.contatoEmergencia.telefone));
    }

    secao('Alergias');
    p.alergias.forEach((a) => item(a.substancia, juntar(a.reacao, a.ano && `desde ${a.ano}`)));
    if (!p.alergias.length) vazio('Nenhuma alergia registrada.');

    const historico = p.condicoes.filter((c) => c.tipo !== 'vacina');
    if (!pet || historico.length) {
      secao('Condições e cirurgias');
      historico.forEach((c) => item(c.nome, juntar(c.tipo === 'cirurgia' && 'cirurgia', c.nomeClinico, c.desde && `desde ${c.desde}`)));
      if (!historico.length) vazio('Nada registrado.');
    }

    secao('Vacinas');
    const vacinas = dela(s.vacinas).sort((x, y) => y.data.localeCompare(x.data));
    vacinas.forEach((v) => item(`${v.nome} — ${dataBR(v.data)}`, juntar(v.lote && `lote ${v.lote}`, v.veterinario, v.proxima && `reforço ${dataBR(v.proxima)}`)));
    p.condicoes.filter((c) => c.tipo === 'vacina').forEach((c) => item(c.nome, c.desde));
    if (!vacinas.length && !p.condicoes.some((c) => c.tipo === 'vacina')) vazio('Nenhuma vacina registrada.');

    // Pessoa: só quando houver algum (as cirurgias antigas ficam em "Condições e cirurgias").
    const procs = dela(s.procedimentos).sort((x, y) => y.data.localeCompare(x.data));
    if (pet || procs.length) {
      secao('Procedimentos');
      procs.forEach((x) => item(
        `${x.tipo}${x.descricao ? ` · ${x.descricao}` : ''} — ${dataBR(x.data)}`,
        juntar(x.clinica, x.medico && `realizado por ${x.medico}`, x.anestesista && `anestesista: ${x.anestesista}`, x.nota),
      ));
      if (!procs.length) vazio('Nenhum procedimento registrado.');
    }

    if (pet) {
      const prev = dela(s.prevencoes).sort((x, y) => y.data.localeCompare(x.data));
      secao('Prevenção');
      prev.forEach((x) => item(`${x.produto.trim() || NOMES_PREVENCAO[x.tipo]} — ${dataBR(x.data)}`, juntar(NOMES_PREVENCAO[x.tipo], `a cada ${x.intervaloDias} dias`, `próxima ${dataBR(proximaPrevencao(x))}`)));
      if (!prev.length) vazio('Nenhuma prevenção registrada.');

      const sint = dela(s.sintomas).sort((x, y) => y.data.localeCompare(x.data));
      secao('Sintomas');
      sint.forEach((x) => item(`${x.sinais.join(', ')} — ${dataBR(x.data)}`, x.nota));
      if (!sint.length) vazio('Nenhum sintoma registrado.');

      const pesos = dela(s.pesagens).sort((x, y) => y.data.localeCompare(x.data));
      secao('Peso');
      pesos.forEach((x) => item(`${numCurto(x.kg)} kg — ${dataBR(x.data)}`));
      if (!pesos.length) vazio('Nenhuma pesagem registrada.');
    } else {
      const meds = dela(s.medicoes).sort((x, y) => (y.data + (y.hora ?? '')).localeCompare(x.data + (x.hora ?? '')));
      if (meds.length) {
        secao('Medições');
        meds.slice(0, 40).forEach((m) => {
          const i = infoMedicao(m.tipo);
          item(`${i.nome}: ${fmtMedicao(m)} ${i.unidade} — ${dataBR(m.data)}${m.hora ? ` ${m.hora}` : ''}`, juntar(m.contexto, m.nota));
        });
      }
    }
  }

  if (ver('remedios')) {
    const rem = dela(s.remedios);
    const ativos = rem.filter((r) => r.ativo);
    const antigos = rem.filter((r) => !r.ativo);
    secao('Remédios em uso');
    ativos.forEach((r) => item(
      `${r.nome} — ${r.seNecessario ? 'se necessário' : `${r.doseLonga ?? r.dose}${r.horarios.length ? ` às ${r.horarios.join(', ')}` : ''}`}`,
      juntar(r.observacao, r.indicacao && `para ${r.indicacao}`, r.receitadoPor && `receitado por ${r.receitadoPor}`, r.inicio && `desde ${dataBR(r.inicio)}`, r.continuo && 'uso contínuo'),
    ));
    if (!ativos.length) vazio('Nenhum remédio em uso.');
    if (antigos.length) {
      secao('Remédios que já usou');
      antigos.forEach((r) => item(r.nome, juntar(r.inicio && `de ${dataBR(r.inicio)}`, r.fim && `até ${dataBR(r.fim)}`, r.indicacao, r.encerradoResumo)));
    }
  }

  if (ver('consultas')) {
    const cs = dela(s.consultas);
    const prox = cs.filter((c) => c.data >= hoje).sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));
    const passadas = cs.filter((c) => c.data < hoje).sort((x, y) => (y.data + y.hora).localeCompare(x.data + x.hora));
    const linha = (c: (typeof cs)[number]) => `${c.tipo === 'exame' ? 'Exame: ' : ''}${c.titulo} — ${dataBR(c.data)} ${c.hora}`;
    if (prox.length) {
      secao('Próximas consultas');
      prox.forEach((c) => item(linha(c), juntar(c.profissional, c.local, c.preparo && `preparo: ${c.preparo}`)));
    }
    secao('Consultas anteriores');
    passadas.forEach((c) => item(linha(c), juntar(c.profissional, c.local, c.anotacaoPos && `anotação: ${c.anotacaoPos}`)));
    if (!passadas.length) vazio('Nenhuma consulta anterior registrada.');
  }

  if (ver('exames')) {
    const ex = dela(s.exames).sort((x, y) => y.dataColeta.localeCompare(x.dataColeta));
    secao('Exames');
    ex.forEach((e) => {
      item(`${e.nome} — ${dataBR(e.dataColeta)}`, juntar(e.categoria, e.laboratorio, e.solicitante && `pedido por ${e.solicitante}`));
      if (e.resultados?.length) {
        b.push({ tipo: 'texto', texto: e.resultados.map((r) => `${r.marcador}: ${fmtResultado(r)}${r.min != null || r.max != null ? ` (ref. ${r.min ?? '…'}–${r.max ?? '…'})` : ''}`).join('; ') });
      }
      if (e.anotacao) b.push({ tipo: 'texto', texto: `Anotação: ${e.anotacao}` });
      if (e.laudo) b.push({ tipo: 'texto', texto: e.laudo });
    });
    if (!ex.length) vazio('Nenhum exame arquivado.');
  }

  if (ver('plano') && !pet) {
    const pls = dela(s.planos);
    if (pls.length) {
      secao('Plano de saúde');
      pls.forEach((pl) => item(`${pl.operadora}${pl.produto ? ` · ${pl.produto}` : ''}`, juntar(pl.numero && `carteirinha ${pl.numero}`, pl.validade && `validade ${pl.validade}`, pl.acomodacao, pl.cns && `CNS ${pl.cns}`)));
    }
  }
  return b;
}

/** Nome do arquivo: "Prontuario - Helena Almeida - 28-10-2026.pdf". */
export const nomeDoPdf = (p: Pessoa, hoje: string) => `Prontuario - ${p.nome.replace(/[\\/:*?"<>|]/g, '')} - ${dataBR(hoje).replace(/\//g, '-')}.pdf`;

/** Os bytes do PDF do perfil. */
export const pdfDoPerfil = (s: State, p: Pessoa, ver: (c: Categoria) => boolean, hoje: string) =>
  gerarPdf(blocosDoPerfil(s, p, ver, hoje), `${p.nome} · Prontuário de Casa`);
