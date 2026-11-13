import { useAgendaCelular } from './agendaCelular';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import * as seed from './seed';
import { EM_TAURI, HOJE, MODO_EXEMPLO, MODO_REAL, horaAgora } from './tempo';
import { useLembretes } from './useLembretes';
import { useViradaDoDia } from './useViradaDoDia';
import { avisarMudanca, infoSync } from './sincronizacao';
import { persistencia, novoId, type Evento, type InfoBackup, type Inicio } from './persistencia';
import { fmtHlc, proximoHlc, type Hlc } from './hlc';
import { emCasaAgora } from './redeCasa';
import { eventosParaEnviar, migrarLog, novoAparelhoId, ordenarLog, resolverEu, ultimoHlc, type Identidade } from './log';
import type { PatchPessoa } from './perfil';
import { medicoesDoPatch, perfilDasMedicoes } from './medicoes';
import { qtdPorDose, somarEstoque } from './format';
import { noMeuCuidado, pedirPapel, podeEditar, podeMarcarDose, podeMudarResponsavel, removerPapel, responderPapel, veTudo, type NivelPapel, type Papel } from './papeis';
import type { Categoria, Config, Consulta, Dose, Exame, Pessoa, Plano, Remedio, Compartilhamento, Vacina, Prevencao, Sintoma, Procedimento, Pesagem, Medicao, Anexo, Aparelho } from './types';
import { vistoPorAparelho, nomePadraoAparelho, plataformaDoId } from './aparelhos';

// Estado do app = projeção do log de eventos.
// Toda mudança vira um evento; o evento é gravado (cifrado) no banco e aplicado
// pelo mesmo reducer que reconstrói o estado ao abrir o app.

export interface State {
  pessoas: Pessoa[];
  remedios: Remedio[];
  doses: Dose[];
  consultas: Consulta[];
  exames: Exame[];
  planos: Plano[];
  vacinas: Vacina[];
  prevencoes: Prevencao[];
  sintomas: Sintoma[];
  procedimentos: Procedimento[];
  pesagens: Pesagem[];
  medicoes: Medicao[];
  anexos: Anexo[];
  compartilhamentos: Compartilhamento[];
  /** Cuidador e administrador (pedido e aceito). O responsável fica na pessoa (`responsavelId`). */
  papeis: Papel[];
  aparelhos: Aparelho[];
  config: Config;
  bloqueado: boolean;
  temSenha: boolean;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const CONFIG_PADRAO: Config = {
  biometria: true,
  senhaAoAbrir: true,
  bloqueioMobile: '1 minuto',
  bloqueioDesktop: '5 minutos',
  esconderNomeNotif: true,
  fichaSemDesbloqueio: false,
  backup: { freq: 'semanal', pasta: 'Documentos / Arquivo da família', temSenha: false },
  update: { auto: true, freq: 'dia', backupAntes: true, ultimaVerificacao: '—', instalada: '0.5.0' },
  sync: {},
};

function estadoBase(): State {
  return { pessoas: [], remedios: [], doses: [], consultas: [], exames: [], planos: [], vacinas: [], prevencoes: [], sintomas: [], procedimentos: [], pesagens: [], medicoes: [], anexos: [], compartilhamentos: [], papeis: [], aparelhos: [], config: clone(CONFIG_PADRAO), bloqueado: false, temSenha: false };
}

export function estadoExemplo(): State {
  return {
    pessoas: clone(seed.pessoas).map((p) => ({ ...p, ...perfilDasMedicoes(p, seed.medicoes) })),
    remedios: clone(seed.remedios),
    doses: clone(seed.doses),
    consultas: clone(seed.consultas),
    exames: clone(seed.exames),
    planos: clone(seed.planos),
    vacinas: clone(seed.vacinas),
    prevencoes: clone(seed.prevencoes),
    sintomas: clone(seed.sintomas),
    procedimentos: clone(seed.procedimentos),
    pesagens: clone(seed.pesagens),
    medicoes: clone(seed.medicoes),
    anexos: [],
    compartilhamentos: clone(seed.compartilhamentos),
    papeis: clone(seed.papeis),
    aparelhos: [],
    config: clone(seed.config),
    bloqueado: false,
    temSenha: true,
  };
}

/** Primeiro uso nos dados de exemplo (M20/M21): só o perfil de quem instalou. */
export function estadoVazio(): State {
  const eu = clone(seed.pessoas.find((p) => p.souEu)!);
  eu.condicoes = [];
  return { ...estadoExemplo(), pessoas: [eu], remedios: [], doses: [], consultas: [], exames: [], planos: [], vacinas: [], prevencoes: [], sintomas: [], procedimentos: [], pesagens: [], medicoes: [], anexos: [], compartilhamentos: [], papeis: [] };
}

/** Coleções com edição/remoção genérica (registros com `id`). */
export type Colecao = 'remedios' | 'consultas' | 'exames' | 'planos' | 'vacinas' | 'prevencoes' | 'sintomas' | 'procedimentos' | 'pesagens' | 'medicoes';
type Item = { id: string } & Record<string, unknown>;

// Ações que viram eventos persistidos.
type Mudanca =
  | { type: 'dose'; dose: Dose }
  | { type: 'desfazerDose'; remedioId: string; previstoPara: string }
  | { type: 'comprei'; remedioId: string; qtd: number }
  | { type: 'encerrar'; remedioId: string; data: string }
  | { type: 'addRemedio'; remedio: Remedio }
  | { type: 'addConsulta'; consulta: Consulta }
  | { type: 'addExame'; exame: Exame }
  | { type: 'addPlano'; plano: Plano }
  | { type: 'addPessoa'; pessoa: Pessoa }
  | { type: 'addVacina'; vacina: Vacina }
  | { type: 'addPrevencao'; prevencao: Prevencao }
  | { type: 'desfazerPrevencao'; id: string }
  | { type: 'addSintoma'; sintoma: Sintoma }
  | { type: 'addProcedimento'; procedimento: Procedimento }
  | { type: 'addPesagem'; pesagem: Pesagem }
  | { type: 'addMedicao'; medicao: Medicao }
  | { type: 'desfazerMedicao'; id: string }
  | { type: 'addAnexo'; anexo: Anexo }
  | { type: 'editarRegistro'; colecao: Colecao; id: string; patch: Record<string, unknown> }
  | { type: 'removerRegistro'; colecao: Colecao; id: string }
  | { type: 'restaurarRegistro'; colecao: Colecao; item: Item }
  | { type: 'removerPessoa'; id: string }
  | { type: 'removerAnexo'; id: string }
  | { type: 'editarPessoa'; pessoaId: string; patch: PatchPessoa; por?: string }
  | { type: 'pedirPapel'; de: string; para: string; papel: NivelPapel; por?: string }
  | { type: 'responderPapel'; de: string; para: string; aceitar: boolean; por?: string }
  | { type: 'removerPapel'; de: string; para: string; por?: string }
  | { type: 'levar'; consultaId: string; idx: number }
  | { type: 'lembrete'; consultaId: string; lembrete: string }
  | { type: 'config'; patch: Partial<Config> }
  | { type: 'compartilhar'; de: string; para: string; categorias: Categoria[] }
  | { type: 'aparelho'; aparelhoId: string; nome: string; plataforma: 'pc' | 'cel'; chavePublica?: string; removido?: boolean; epoca?: number }
  | { type: 'removerAparelho'; aparelhoId: string; epoca?: number };

// Ações locais (não persistidas).
type Local =
  | { type: 'reset'; state: State }
  | { type: 'bloquear'; valor: boolean }
  | { type: 'eu'; pessoaId: string | null }
  | { type: 'sistema'; patch: Partial<Config>; temSenha?: boolean };

type Action = Mudanca | Local;

function mesclarConfig(c: Config, p: Partial<Config>): Config {
  return {
    ...c,
    ...p,
    backup: { ...c.backup, ...(p.backup ?? {}) },
    update: { ...c.update, ...(p.update ?? {}) },
    sync: { ...c.sync, ...(p.sync ?? {}) },
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'reset':
      return a.state;
    case 'eu':
      return marcarEu(s, a.pessoaId);
    case 'bloquear':
      return { ...s, bloqueado: a.valor };
    case 'sistema':
      return { ...s, config: mesclarConfig(s.config, a.patch), temSenha: a.temSenha ?? s.temSenha };
    case 'dose': {
      const remedios = s.remedios.map((r) =>
        r.id === a.dose.remedioId && r.estoque != null && a.dose.status === 'tomada' ? { ...r, estoque: somarEstoque(r.estoque, -(a.dose.qtd ?? 1)) } : r,
      );
      return { ...s, doses: [...s.doses, a.dose], remedios };
    }
    case 'desfazerDose': {
      const alvo = [...s.doses].reverse().find((d) => d.remedioId === a.remedioId && d.previstoPara === a.previstoPara);
      if (!alvo) return s;
      const remedios = s.remedios.map((r) =>
        r.id === a.remedioId && r.estoque != null && alvo.status === 'tomada' ? { ...r, estoque: somarEstoque(r.estoque, alvo.qtd ?? 1) } : r,
      );
      return { ...s, doses: s.doses.filter((d) => d !== alvo), remedios };
    }
    case 'comprei':
      return { ...s, remedios: s.remedios.map((r) => (r.id === a.remedioId ? { ...r, estoque: somarEstoque(r.estoque ?? 0, a.qtd), ultimaCompra: a.qtd } : r)) };
    case 'encerrar':
      return {
        ...s,
        remedios: s.remedios.map((r) => {
          if (r.id !== a.remedioId) return r;
          const ini = r.inicio ? `${r.inicio.slice(8, 10)}/${r.inicio.slice(5, 7)} a ` : 'até ';
          return { ...r, ativo: false, fim: a.data, encerradoResumo: `${ini}${a.data.slice(8, 10)}/${a.data.slice(5, 7)}` };
        }),
      };
    case 'addRemedio':
      return { ...s, remedios: [a.remedio, ...s.remedios] };
    case 'addConsulta':
      return { ...s, consultas: [...s.consultas, a.consulta].sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora)) };
    case 'addExame':
      return { ...s, exames: [a.exame, ...s.exames].sort((x, y) => y.dataColeta.localeCompare(x.dataColeta)) };
    case 'addPlano':
      return { ...s, planos: [...s.planos, a.plano] };
    case 'addPessoa':
      return { ...s, pessoas: [...s.pessoas, a.pessoa] };
    case 'addVacina':
      return { ...s, vacinas: [...s.vacinas, a.vacina] };
    case 'addPrevencao':
      return { ...s, prevencoes: [...s.prevencoes, a.prevencao] };
    case 'desfazerPrevencao':
      return { ...s, prevencoes: s.prevencoes.filter((x) => x.id !== a.id) };
    case 'addSintoma':
      return { ...s, sintomas: [...s.sintomas, a.sintoma] };
    case 'addProcedimento':
      return { ...s, procedimentos: [...s.procedimentos, a.procedimento] };
    case 'addPesagem':
      return { ...s, pesagens: [...s.pesagens, a.pesagem] };
    case 'editarRegistro':
    case 'removerRegistro':
    case 'restaurarRegistro': {
      const lista = s[a.colecao] as unknown as Item[] | undefined;
      if (!lista) return s;
      let nova: Item[];
      if (a.type === 'editarRegistro') {
        // `null` no patch apaga o campo opcional; `id` nunca muda.
        nova = lista.map((x) => {
          if (x.id !== a.id) return x;
          const r: Item = { ...x };
          for (const [k, v] of Object.entries(a.patch)) { if (k === 'id' || v === undefined) continue; if (v === null) delete r[k]; else r[k] = v; }
          return r;
        });
      } else if (a.type === 'removerRegistro') nova = lista.filter((x) => x.id !== a.id);
      else nova = lista.some((x) => x.id === a.item.id) ? lista : [...lista, a.item];
      const s2 = { ...s, [a.colecao]: nova } as State;
      // Medições alimentam o perfil: recalcula quem foi afetado.
      if (a.colecao !== 'medicoes') return s2;
      const pid = a.type === 'restaurarRegistro' ? (a.item.pessoaId as string) : lista.find((x) => x.id === a.id)?.pessoaId;
      return { ...s2, pessoas: s2.pessoas.map((p) => (p.id === pid ? { ...p, ...perfilDasMedicoes(p, s2.medicoes) } : p)) };
    }
    case 'removerPessoa': {
      // Remove a pessoa (ou pet) e tudo que é dela. A proteção de quem usa o app fica na api.
      const dela = <T extends { pessoaId: string }>(xs: T[]) => xs.filter((x) => x.pessoaId !== a.id);
      const remedios = dela(s.remedios);
      const exames = dela(s.exames);
      const planos = dela(s.planos);
      // Anexos que ficam: os de registros que ficam e as fotos de quem fica (donoId = pessoa ou pet).
      const donos = new Set([...remedios, ...exames, ...planos, ...s.pessoas.filter((p) => p.id !== a.id)].map((x) => x.id));
      return {
        ...s,
        pessoas: s.pessoas.filter((p) => p.id !== a.id),
        remedios, exames, planos,
        doses: s.doses.filter((d) => remedios.some((r) => r.id === d.remedioId)),
        consultas: dela(s.consultas), vacinas: dela(s.vacinas), prevencoes: dela(s.prevencoes), sintomas: dela(s.sintomas),
        procedimentos: dela(s.procedimentos), pesagens: dela(s.pesagens), medicoes: dela(s.medicoes),
        anexos: s.anexos.filter((x) => donos.has(x.donoId)),
        compartilhamentos: s.compartilhamentos.filter((c) => c.de !== a.id && c.para !== a.id),
        papeis: s.papeis.filter((c) => c.de !== a.id && c.para !== a.id),
      };
    }
    case 'addAnexo':
      return s.anexos.some((x) => x.id === a.anexo.id) ? s : { ...s, anexos: [...s.anexos, a.anexo] };
    case 'removerAnexo':
      return { ...s, anexos: s.anexos.filter((x) => x.id !== a.id) };
    case 'addMedicao':
    case 'desfazerMedicao': {
      const medicoes = a.type === 'addMedicao' ? [...s.medicoes, a.medicao] : s.medicoes.filter((m) => m.id !== a.id);
      const pid = a.type === 'addMedicao' ? a.medicao.pessoaId : s.medicoes.find((m) => m.id === a.id)?.pessoaId;
      // O perfil mostra sempre a medição mais recente de peso, altura e pressão.
      return { ...s, medicoes, pessoas: s.pessoas.map((p) => (p.id === pid ? { ...p, ...perfilDasMedicoes(p, medicoes) } : p)) };
    }
    case 'editarPessoa':
      return {
        ...s,
        pessoas: s.pessoas.map((p) => {
          if (p.id !== a.pessoaId) return p;
          const novo: Record<string, unknown> = { ...p };
          for (const [k, v] of Object.entries(a.patch)) {
            if (k === 'id' || k === 'souEu' || k === 'tipo' || v === undefined) continue;
            // Responsável: só a própria pessoa, o responsável atual, ou qualquer um quando está em branco.
            if (k === 'responsavelId' && (v === p.id || !podeMudarResponsavel(s, a.por, p.id))) continue;
            if (v === null) {
              // Obrigatórios não se removem; listas vazias voltam a [].
              if (k === 'nome' || k === 'curto' || k === 'cor') continue;
              if (k === 'alergias' || k === 'condicoes') novo[k] = [];
              else delete novo[k];
            }
            else novo[k] = v;
          }
          return novo as unknown as Pessoa;
        }),
      };
    case 'pedirPapel':
      return { ...s, papeis: pedirPapel(s, a) };
    case 'responderPapel':
      return { ...s, papeis: responderPapel(s, a) };
    case 'removerPapel':
      return { ...s, papeis: removerPapel(s, a) };
    case 'levar':
      return {
        ...s,
        consultas: s.consultas.map((c) => (c.id === a.consultaId ? { ...c, levar: c.levar.map((l, i) => (i === a.idx ? { ...l, ok: !l.ok } : l)) } : c)),
      };
    case 'lembrete':
      return {
        ...s,
        consultas: s.consultas.map((c) =>
          c.id === a.consultaId ? { ...c, lembretes: c.lembretes.includes(a.lembrete) ? c.lembretes.filter((l) => l !== a.lembrete) : [...c.lembretes, a.lembrete] } : c,
        ),
      };
    case 'config':
      return { ...s, config: mesclarConfig(s.config, a.patch) };
    case 'compartilhar': {
      const outros = s.compartilhamentos.filter((c) => !(c.de === a.de && c.para === a.para));
      return { ...s, compartilhamentos: [...outros, { de: a.de, para: a.para, categorias: a.categorias }] };
    }
    // Registro ou renomeação de aparelho: vale o mais recente (o log já vem na ordem do HLC). `visto` é calculado em `projetar`.
    // Aparelho removido continua removido: só volta se entrou de novo na família (registro numa época igual ou depois
    // da remoção). Assim um "renomear" atrasado do aparelho removido, ainda na chave velha, não o traz de volta.
    // Chave pública: vale a primeira (TOFU). Renomear não troca a chave e uma chave diferente é ignorada, para que
    // ninguém desvie a chave nova da família de "Remover aparelho". (Só o próprio aparelho se descreve: ver `acaoDoEvento`.)
    case 'aparelho': {
      const antigo = s.aparelhos.find((x) => x.id === a.aparelhoId);
      const segueRemovido = !!antigo?.removido && (a.epoca ?? 0) < (antigo.removidoEpoca ?? 0);
      const removido = a.removido || segueRemovido || undefined;
      const novo: Aparelho = { id: a.aparelhoId, nome: a.nome, plataforma: a.plataforma, chavePublica: antigo?.chavePublica ?? a.chavePublica, removido, removidoEpoca: segueRemovido ? antigo?.removidoEpoca : undefined, visto: antigo?.visto ?? '' };
      return { ...s, aparelhos: antigo ? s.aparelhos.map((x) => (x.id === a.aparelhoId ? novo : x)) : [...s.aparelhos, novo] };
    }
    // "Remover aparelho": a chave da família já foi trocada (época `epoca`) sem ele.
    case 'removerAparelho':
      return { ...s, aparelhos: s.aparelhos.map((x) => (x.id === a.aparelhoId ? { ...x, removido: true, removidoEpoca: a.epoca ?? 0 } : x)) };
    // Evento de outra versão (backup mais novo, sincronização): ignora em vez de perder o log.
    default:
      return s;
  }
}

const paraAcao = (ev: Evento) => ({ type: ev.tipo, ...ev.dados }) as Mudanca;

/** Preferências que valem para a família inteira; o resto do `config` é de cada aparelho. */
const CONFIG_DA_FAMILIA: readonly string[] = ['agenda'];

/** Evento → ação (null = ignorar); `config` de outro aparelho só traz as preferências da família.
 *  Evento `aparelho` só vale assinado pelo próprio aparelho (cada um só se descreve a si mesmo). */
function acaoDoEvento(ev: Evento, aparelhoId?: string): Mudanca | null {
  const a = paraAcao(ev);
  if (a.type === 'aparelho' && ev.aparelho !== a.aparelhoId) return null;
  // Papéis e responsável: quem fez é o autor do evento, nunca o que veio nos dados.
  if (a.type === 'pedirPapel' || a.type === 'responderPapel' || a.type === 'removerPapel' || a.type === 'editarPessoa') return { ...a, por: ev.autor };
  if (a.type !== 'config' || !aparelhoId || !ev.aparelho || ev.aparelho === aparelhoId) return a;
  return { ...a, patch: Object.fromEntries(Object.entries(a.patch).filter(([k]) => CONFIG_DA_FAMILIA.includes(k))) as Partial<Config> };
}

/** Reconstrói o estado aplicando o log na ordem do HLC. Com `euId`, "souEu" passa a ser só essa pessoa. `config` de outro aparelho (`aparelhoId` é o deste) só traz as preferências da família. */
export function projetar(eventos: Evento[], euId?: string | null, aparelhoId?: string): State {
  const bruto = ordenarLog(eventos).reduce((acc, ev) => {
    try {
      const a = acaoDoEvento(ev, aparelhoId);
      return a ? reducer(acc, a) : acc;
    } catch { return acc; }
  }, estadoBase());
  // "Visto por último" vem do log inteiro (cada aparelho assina os próprios eventos), não de um evento só.
  const vistos = vistoPorAparelho(eventos);
  const s = { ...bruto, aparelhos: bruto.aparelhos.map((x) => ({ ...x, visto: vistos.get(x.id) ?? x.visto })) };
  return euId === undefined ? s : marcarEu(s, euId);
}

/** "souEu" é deste aparelho (identidade local), não do evento que criou a pessoa. */
export function marcarEu(s: State, euId: string | null): State {
  return { ...s, pessoas: s.pessoas.map((p) => ({ ...p, souEu: p.id === euId || undefined })) };
}

/** Identidade e último carimbo deste aparelho na sessão (só no modo real). */
const sessao: {
  identidade: Identidade | null; ultimo: Hlc | null; registrandoAparelho?: boolean;
  /** Eventos emitidos cuja gravação ainda não terminou. */
  emVoo: Map<string, Evento>;
  /** Durante um `recarregar`: os eventos emitidos enquanto o log era lido (entram por cima da leitura). */
  durante: Evento[] | null;
} = { identidade: null, ultimo: null, emVoo: new Map(), durante: null };

const plataforma = (): 'pc' | 'cel' | 'web' => (!EM_TAURI ? 'web' : /Android/i.test(navigator.userAgent) ? 'cel' : 'pc');

/** Abre o log lido do banco: dá HLC aos eventos antigos, resolve "eu" e guarda a identidade se mudou. */
async function abrirLog(ini: Inicio): Promise<State> {
  const aparelhoId = ini.identidade?.aparelhoId ?? novoAparelhoId(plataforma());
  const eventos = migrarLog(ini.eventos, aparelhoId);
  const bruto = projetar(eventos, undefined, aparelhoId);
  const pessoaId = resolverEu(bruto.pessoas, ini.identidade ?? null);
  const identidade: Identidade = { aparelhoId, pessoaId };
  if (ini.identidade?.aparelhoId !== aparelhoId || ini.identidade?.pessoaId !== pessoaId) {
    try {
      await persistencia.definirIdentidade(identidade);
    } catch (e) {
      // Segue com a identidade em memória; a próxima abertura tenta de novo (a comparação continuará diferente).
      console.warn('Não foi possível guardar a identidade do aparelho', e);
    }
  }
  sessao.identidade = identidade;
  sessao.ultimo = ultimoHlc(eventos);
  return marcarEu(bruto, pessoaId);
}

/** O que da configuração é preferência do usuário (vai para o log). */
function soPreferencias(p: Partial<Config>): Partial<Config> {
  const { backup: _b, sync: _s, update, ...resto } = p;
  void _b; void _s;
  if (!update) return resto;
  const { auto, freq, backupAntes } = update;
  return { ...resto, update: Object.fromEntries(Object.entries({ auto, freq, backupAntes }).filter(([, v]) => v !== undefined)) as unknown as Config['update'] };
}

function backupParaConfig(b: InfoBackup): Config['backup'] {
  return { pasta: b.pasta, freq: b.freq === 'manual' ? 'manual' : 'semanal', temSenha: b.temSenha, ultimo: b.ultimo, arquivo: b.arquivo, tamanho: b.tamanho };
}

interface Toast { id: number; texto: string; desfazer?: () => void }
export type Status = 'carregando' | 'pronto' | 'erro';

function useApi(state: State, dispatch: (a: Action) => void, mostrarToast: (t: Omit<Toast, 'id'>) => void) {
  const ref = useRef(state);
  ref.current = state;

  return useMemo(() => {
    const autor = () => ref.current.pessoas.find((p) => p.souEu)?.id;
    /** Aplica a mudança na tela na hora e grava o evento em seguida. */
    const emitir = (m: Mudanca) => {
      dispatch(m);
      if (!MODO_REAL) return;
      const { type, ...dados } = m;
      const h = proximoHlc(sessao.ultimo, Date.now(), sessao.identidade?.aparelhoId ?? 'web-000000');
      sessao.ultimo = h;
      const ev: Evento = { id: novoId(), em: new Date().toISOString(), autor: autor(), aparelho: h.aparelho, hlc: fmtHlc(h), tipo: type, dados };
      sessao.emVoo.set(ev.id, ev);
      sessao.durante?.push(ev);
      persistencia.gravar(ev)
        .catch((e) => mostrarToast({ texto: `Não foi possível salvar: ${String(e)}` }))
        .finally(() => sessao.emVoo.delete(ev.id));
      avisarMudanca();
    };
    /** "Eu" deste aparelho: marca na tela e guarda na identidade local (kv cifrado). */
    const definirEu = (pessoaId: string) => {
      dispatch({ type: 'eu', pessoaId });
      if (!MODO_REAL || !sessao.identidade) return;
      sessao.identidade = { ...sessao.identidade, pessoaId };
      persistencia.definirIdentidade(sessao.identidade).catch((e) => mostrarToast({ texto: `Não foi possível salvar: ${String(e)}` }));
    };
    const erroTexto = (e: unknown) => (e instanceof Error ? e.message : String(e));

    // Um registro feito enquanto o log é lido (ou ainda sendo gravado) não pode sumir da tela com o reset:
    // entra por cima do que veio do banco (a vacina registrada no meio de uma sincronização sumia até reabrir o app).
    const recarregar = async () => {
      const durante: Evento[] = [];
      sessao.durante = durante;
      let ini: Inicio;
      let s: State;
      try {
        const lido = await persistencia.iniciar();
        const ids = new Set(lido.eventos.map((e) => e.id));
        const extras = [...sessao.emVoo.values(), ...durante].filter((e, i, xs) => !ids.has(e.id) && xs.findIndex((x) => x.id === e.id) === i);
        ini = extras.length ? { ...lido, eventos: [...lido.eventos, ...extras] } : lido;
        s = await abrirLog(ini);
        // O que foi emitido durante o abrirLog também entra.
        const tarde = durante.filter((e) => !ini.eventos.some((x) => x.id === e.id));
        if (tarde.length) s = await abrirLog({ ...ini, eventos: [...ini.eventos, ...tarde] });
      } finally {
        sessao.durante = null;
      }
      // Mantém o bloqueio atual: o bloqueio por inatividade pode ter entrado durante a sincronização.
      dispatch({ type: 'reset', state: { ...s, bloqueado: ref.current.bloqueado, temSenha: ini.temSenha, config: mesclarConfig(s.config, { backup: backupParaConfig(ini.backup), update: { ...s.config.update, instalada: ini.versao } }) } });
    };

    return {
      /** `dia` vem da notificação, que pode ser de ontem (lembrete das 23:45 respondido à 00:10). */
      marcarDose(remedioId: string, horario: string, status: Dose['status'] = 'tomada', dia = HOJE) {
        const registradoEm = horaAgora();
        const previstoPara = `${dia}T${horario}`;
        const rem = ref.current.remedios.find((x) => x.id === remedioId);
        emitir({ type: 'dose', dose: { remedioId, previstoPara, status, registradoEm, ...(status === 'tomada' && rem ? { qtd: qtdPorDose(rem) } : {}) } });
        // Bloqueado (ação vinda da notificação): sem toast, que mostraria o nome do remédio
        // por cima do desbloqueio e deixaria "Desfazer" mudar dados sem desbloquear.
        if (ref.current.bloqueado) return;
        const r = ref.current.remedios.find((x) => x.id === remedioId);
        mostrarToast({
          texto: status === 'tomada' ? `${r?.nome ?? 'Dose'} marcado às ${registradoEm}` : 'Dose pulada',
          desfazer: () => emitir({ type: 'desfazerDose', remedioId, previstoPara }),
        });
      },
      /** Remédio "se necessário": registra uma dose agora, com o motivo (opcional). */
      tomeiAgora(remedioId: string, motivo?: string) {
        const r = ref.current.remedios.find((x) => x.id === remedioId);
        const registradoEm = horaAgora();
        const previstoPara = `${HOJE}T${registradoEm}`;
        emitir({ type: 'dose', dose: { remedioId, previstoPara, status: 'tomada', registradoEm, qtd: r ? qtdPorDose(r) : 1, ...(motivo?.trim() ? { motivo: motivo.trim() } : {}) } });
        mostrarToast({ texto: `${r?.nome ?? 'Dose'} registrado às ${registradoEm}`, desfazer: () => emitir({ type: 'desfazerDose', remedioId, previstoPara }) });
      },
      /** Desfaz a dose registrada na lista do Início (evento novo, append-only). */
      desfazerDose: (remedioId: string, horario: string) => emitir({ type: 'desfazerDose', remedioId, previstoPara: `${HOJE}T${horario}` }),
      comprei: (remedioId: string, qtd: number) => {
        emitir({ type: 'comprei', remedioId, qtd });
        mostrarToast({ texto: `Estoque atualizado: +${qtd}` });
      },
      encerrar: (remedioId: string) => emitir({ type: 'encerrar', remedioId, data: HOJE }),
      addRemedio: (remedio: Remedio) => emitir({ type: 'addRemedio', remedio }),
      addConsulta: (consulta: Consulta) => emitir({ type: 'addConsulta', consulta }),
      addExame: (exame: Exame) => emitir({ type: 'addExame', exame }),
      addPlano: (plano: Plano) => emitir({ type: 'addPlano', plano }),
      /** Quem cria o próprio perfil (primeiro uso) vira o "eu" deste aparelho; o log não guarda souEu. */
      addPessoa: (pessoa: Pessoa) => {
        const { souEu, ...semEu } = pessoa;
        emitir({ type: 'addPessoa', pessoa: semEu as Pessoa });
        if (souEu) definirEu(pessoa.id);
      },
      definirEu: (pessoaId: string) => definirEu(pessoaId),
      addVacina: (vacina: Vacina) => emitir({ type: 'addVacina', vacina }),
      addPrevencao: (prevencao: Prevencao) => emitir({ type: 'addPrevencao', prevencao }),
      /** "Apliquei hoje": registra e oferece desfazer (evento novo, append-only). */
      aplicarPrevencao: (prevencao: Prevencao) => {
        emitir({ type: 'addPrevencao', prevencao });
        mostrarToast({ texto: 'Aplicação registrada', desfazer: () => emitir({ type: 'desfazerPrevencao', id: prevencao.id }) });
      },
      addSintoma: (sintoma: Sintoma) => emitir({ type: 'addSintoma', sintoma }),
      addProcedimento: (procedimento: Procedimento) => emitir({ type: 'addProcedimento', procedimento }),
      addPesagem: (pesagem: Pesagem) => emitir({ type: 'addPesagem', pesagem }),
      editarPessoa: (pessoaId: string, patch: PatchPessoa) => {
        emitir({ type: 'editarPessoa', pessoaId, patch, por: autor() });
        // Peso, altura e pressão do perfil também entram no histórico (gráficos de progresso).
        for (const m of medicoesDoPatch(pessoaId, patch, HOJE)) emitir({ type: 'addMedicao', medicao: { id: `med-${novoId()}`, ...m } });
      },
      /** Salva só os campos alterados (evento novo; o log continua append-only). */
      editar: (colecao: Colecao, id: string, patch: Record<string, unknown>, texto = 'Alterações salvas') => {
        if (!Object.keys(patch).length) return;
        emitir({ type: 'editarRegistro', colecao, id, patch });
        if (texto) mostrarToast({ texto });
      },
      /** Remove vários sem aviso (ex.: consultas canceladas na agenda conectada). */
      removerVarios: (colecao: Colecao, ids: string[]) => { for (const id of ids) emitir({ type: 'removerRegistro', colecao, id }); },
      /** Remove e oferece desfazer (o mesmo registro volta como evento novo). */
      remover: (colecao: Colecao, item: { id: string }, texto: string) => {
        emitir({ type: 'removerRegistro', colecao, id: item.id });
        mostrarToast({ texto, desfazer: () => emitir({ type: 'restaurarRegistro', colecao, item: item as Item }) });
      },
      removerPessoa: (id: string) => {
        if (ref.current.pessoas.find((p) => p.id === id)?.souEu) return; // quem usa o app não se remove
        emitir({ type: 'removerPessoa', id });
      },
      addAnexos: (lista: Anexo[]) => { for (const anexo of lista) emitir({ type: 'addAnexo', anexo }); },
      /** Remove o anexo e oferece desfazer (o mesmo anexo volta como evento novo). */
      removerAnexo: (anexo: Anexo) => {
        emitir({ type: 'removerAnexo', id: anexo.id });
        mostrarToast({ texto: `${anexo.nome} removido`, desfazer: () => emitir({ type: 'addAnexo', anexo }) });
      },
      addMedicao: (m: Omit<Medicao, 'id'>) => {
        const id = `med-${novoId()}`;
        emitir({ type: 'addMedicao', medicao: { id, ...m } });
        mostrarToast({ texto: 'Medição registrada', desfazer: () => emitir({ type: 'desfazerMedicao', id }) });
      },
      toggleLevar: (consultaId: string, idx: number) => emitir({ type: 'levar', consultaId, idx }),
      toggleLembrete: (consultaId: string, lembrete: string) => emitir({ type: 'lembrete', consultaId, lembrete }),
      setConfig: (patch: Partial<Config>) => {
        // Preferências vão para o log; o resto (versão instalada etc.) só para a tela.
        const pref = soPreferencias(patch);
        if (Object.keys(pref).length) emitir({ type: 'config', patch: pref });
        dispatch({ type: 'sistema', patch });
      },
      /** Pets não entram em compartilhamento: nunca se emite `compartilhar` para um pet. */
      /** Eu peço para ser cuidador ou administrador de `de`; `de` (ou o responsável dele) aceita. */
      pedirPapel: (de: string, papel: NivelPapel) => {
        const eu = autor();
        if (!eu) return;
        emitir({ type: 'pedirPapel', de, para: eu, papel, por: eu });
        mostrarToast({ texto: 'Pedido enviado' });
      },
      responderPapel: (de: string, para: string, aceitar: boolean) => {
        emitir({ type: 'responderPapel', de, para, aceitar, por: autor() });
        mostrarToast({ texto: aceitar ? 'Pedido aceito' : 'Pedido recusado' });
      },
      /** Tira o papel de `para` sobre `de` (ou cancela o pedido / deixa de cuidar). */
      removerPapel: (de: string, para: string) => emitir({ type: 'removerPapel', de, para, por: autor() }),
      compartilhar: (para: string, categorias: Categoria[]) => {
        if (ref.current.pessoas.find((p) => p.id === para)?.tipo === 'pet') return;
        emitir({ type: 'compartilhar', de: autor() ?? '', para, categorias });
      },
      bloquear: (valor: boolean) => dispatch({ type: 'bloquear', valor }),
      toast: mostrarToast,

      // ── Senha / PIN ──
      async definirSenha(senha: string) {
        if (MODO_EXEMPLO) return;
        await persistencia.definirSenha(senha);
        dispatch({ type: 'sistema', patch: {}, temSenha: true });
      },
      async desbloquear(senha: string) {
        const ok = MODO_EXEMPLO ? senha.length > 0 : await persistencia.verificarSenha(senha);
        if (ok) dispatch({ type: 'bloquear', valor: false });
        return ok;
      },

      // ── Backup ──
      async configurarBackup(o: { senha?: string; pasta?: string; freq?: 'semanal' | 'manual' }) {
        if (MODO_EXEMPLO) {
          dispatch({ type: 'sistema', patch: { backup: { ...ref.current.config.backup, ...(o.freq ? { freq: o.freq } : {}), ...(o.pasta ? { pasta: o.pasta } : {}), temSenha: true } } });
          return true;
        }
        try {
          const sobrenome = ref.current.pessoas.find((p) => p.souEu)?.nome.split(' ').slice(-1)[0];
          const b = await persistencia.backupConfigurar({ ...o, nome: sobrenome ? `familia-${sobrenome}` : undefined });
          dispatch({ type: 'sistema', patch: { backup: backupParaConfig(b) } });
          return true;
        } catch (e) {
          mostrarToast({ texto: erroTexto(e) });
          return false;
        }
      },
      async backupAgora() {
        if (MODO_EXEMPLO) {
          dispatch({ type: 'sistema', patch: { backup: { ...ref.current.config.backup, ultimo: new Date().toISOString() } } });
          mostrarToast({ texto: 'Backup criptografado salvo' });
          return true;
        }
        try {
          const b = await persistencia.backupAgora();
          dispatch({ type: 'sistema', patch: { backup: backupParaConfig(b) } });
          mostrarToast({ texto: `Backup salvo: ${b.arquivo}` });
          return true;
        } catch (e) {
          mostrarToast({ texto: erroTexto(e) });
          return false;
        }
      },
      escolherPasta: () => persistencia.escolherPasta(ref.current.config.backup.pasta),
      escolherArquivoBackup: () => persistencia.escolherArquivoBackup(),
      /** Lança erro com mensagem legível se a senha estiver errada. */
      async restaurar(caminho: string, senha: string) {
        await persistencia.backupRestaurar(caminho, senha);
        await recarregar();
        mostrarToast({ texto: 'Backup restaurado' });
      },
      async apagarTudo() {
        if (MODO_EXEMPLO) {
          dispatch({ type: 'reset', state: estadoBase() });
          return;
        }
        await persistencia.apagarTudo();
        await recarregar();
      },
      recarregar,
      /** O que a sincronização sobe agora: já com HLC, na ordem local, depois do último enviado (src/data/log.ts). */
      async eventosParaEnviar(): Promise<Evento[]> {
        const id = sessao.identidade?.aparelhoId;
        if (!MODO_REAL || !id) return [];
        const [ini, cursor] = await Promise.all([persistencia.iniciar(), persistencia.syncCursor()]);
        return eventosParaEnviar(migrarLog(ini.eventos, id), cursor);
      },
      aparelhoId: () => sessao.identidade?.aparelhoId ?? null,
      /** Registra este aparelho na família (evento `aparelho`) uma vez: só depois de saber quem é o "eu" (o nome padrão usa o primeiro nome). */
      async registrarAparelho() {
        const id = sessao.identidade?.aparelhoId;
        const eu = ref.current.pessoas.find((p) => p.souEu);
        // Removido e de volta à família (convite novo): registra de novo, na época atual.
        const registrado = () => ref.current.aparelhos.some((x) => x.id === id && !x.removido);
        if (!MODO_REAL || !id || !eu || sessao.registrandoAparelho || registrado()) return;
        sessao.registrandoAparelho = true;
        try {
          const plat = plataformaDoId(id);
          const chavePublica = (await persistencia.chavePublicaAparelho().catch(() => '')) || undefined;
          if (registrado()) return;
          const antigo = ref.current.aparelhos.find((x) => x.id === id);
          emitir({ type: 'aparelho', aparelhoId: id, nome: antigo?.nome ?? nomePadraoAparelho(plat, eu.nome), plataforma: plat, chavePublica, epoca: infoSync().familia?.epoca ?? 0 });
        } finally { sessao.registrandoAparelho = false; }
      },
      /** Renomeia este aparelho (novo evento `aparelho` com o mesmo id; vale o mais recente). */
      renomearAparelho(nome: string) {
        const id = sessao.identidade?.aparelhoId;
        const atual = ref.current.aparelhos.find((x) => x.id === id);
        const novo = nome.trim().slice(0, 40);
        if (!id || !atual || !novo || novo === atual.nome) return;
        emitir({ type: 'aparelho', aparelhoId: id, nome: novo, plataforma: atual.plataforma, chavePublica: atual.chavePublica, epoca: infoSync().familia?.epoca ?? 0 });
      },
      /** Depois que `familiaRemoverAparelho` trocou a chave: registra a remoção no log (vai na chave nova). */
      removerAparelho(aparelhoId: string, epoca: number) {
        if (aparelhoId === sessao.identidade?.aparelhoId) return;
        emitir({ type: 'removerAparelho', aparelhoId, epoca });
      },

      // Só para o navegador de telas em desenvolvimento.
      carregarExemplo: () => dispatch({ type: 'reset', state: estadoExemplo() }),
      carregarVazio: () => dispatch({ type: 'reset', state: estadoVazio() }),
    };
  }, [dispatch, mostrarToast]);
}

type Api = ReturnType<typeof useApi>;
/** `perfil`: no celular, a pessoa cujo recorte do estado as telas mostram (ver `EscopoPerfil`). */
type ValorStore = { state: State; api: Api; toast: Toast | null; fecharToast: () => void; status: Status; erro: string | null; perfil?: string };
const Ctx = createContext<ValorStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => (MODO_REAL ? estadoBase() : estadoExemplo()));
  const [status, setStatus] = useState<Status>(MODO_REAL ? 'carregando' : 'pronto');
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();
  const mostrarToast = useCallback((t: Omit<Toast, 'id'>) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  const fecharToast = useCallback(() => setToast(null), []);
  const api = useApi(state, dispatch, mostrarToast);
  useLembretes(state, status === 'pronto', api.marcarDose);
  useAgendaCelular(state, status === 'pronto', HOJE);
  useViradaDoDia();

  useEffect(() => {
    if (!MODO_REAL) return;
    let vivo = true;
    (async () => {
      try {
        // A rede de casa é consultada junto com a abertura (até 1,5 s); qualquer falha = fora de casa.
        const [ini, emCasa] = await Promise.all([persistencia.iniciar(), emCasaAgora()]);
        if (!vivo) return;
        if (ini.erro) {
          setErro(ini.erro);
          setStatus('erro');
          return;
        }
        const s = await abrirLog(ini);
        if (!vivo) return;
        const config = mesclarConfig(s.config, { backup: backupParaConfig(ini.backup), update: { ...s.config.update, instalada: ini.versao } });
        // Com senha, abre bloqueado, tenha ou não "eu" (o "Quem é você?" só aparece depois de desbloquear).
        // Na rede de casa cadastrada, abre sem senha nem biometria.
        dispatch({ type: 'reset', state: { ...s, config, temSenha: ini.temSenha, bloqueado: ini.temSenha && !emCasa } });
        setStatus('pronto');
        // Backup semanal automático, se estiver na hora.
        const feito = await persistencia.backupSeDevido().catch(() => null);
        if (feito && vivo) {
          dispatch({ type: 'sistema', patch: { backup: backupParaConfig(feito) } });
          mostrarToast({ texto: 'Backup semanal feito' });
        }
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : String(e));
        setStatus('erro');
      }
    })();
    return () => { vivo = false; };
  }, [mostrarToast]);

  return <Ctx.Provider value={{ state, api, toast, fecharToast, status, erro }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore fora do StoreProvider');
  return c;
}

/** Só os registros de uma pessoa (remédios e doses, consultas, exames, planos, registros do pet e medições). Pessoas, anexos e configuração ficam inteiros. */
export function recortarPerfil(s: State, pessoaId: string): State {
  const dela = <T extends { pessoaId: string }>(xs: T[]) => xs.filter((x) => x.pessoaId === pessoaId);
  const remedios = dela(s.remedios);
  const ids = new Set(remedios.map((r) => r.id));
  return {
    ...s,
    remedios,
    doses: s.doses.filter((d) => ids.has(d.remedioId)),
    consultas: dela(s.consultas),
    exames: dela(s.exames),
    planos: dela(s.planos),
    vacinas: dela(s.vacinas),
    prevencoes: dela(s.prevencoes),
    sintomas: dela(s.sintomas),
    procedimentos: dela(s.procedimentos),
    pesagens: dela(s.pesagens),
    medicoes: dela(s.medicoes),
  };
}

/**
 * Celular: as telas dentro deste escopo veem só o recorte do perfil (`useStore().state`) e os
 * formulários começam com ele em "De quem". As ações (`api`) continuam valendo para o arquivo inteiro.
 */
export function EscopoPerfil({ pessoaId, children }: { pessoaId?: string; children: ReactNode }) {
  const c = useStore();
  const state = useMemo(() => (pessoaId ? recortarPerfil(c.state, pessoaId) : c.state), [c.state, pessoaId]);
  const valor = useMemo(() => ({ ...c, state, perfil: pessoaId }), [c, state, pessoaId]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

// ── Seletores ───────────────────────────────────────────────────────────────

export const eu = (s: State) => s.pessoas.find((p) => p.souEu)!;
export const temEu = (s: State) => s.pessoas.some((p) => p.souEu);
export const pessoa = (s: State, id: string) => s.pessoas.find((p) => p.id === id);

export interface DoseHoje { remedio: Remedio; pessoa: Pessoa; horario: string; dose?: Dose }
export function dosesHoje(s: State): DoseHoje[] {
  const out: DoseHoje[] = [];
  for (const r of s.remedios) {
    if (!r.ativo || r.seNecessario) continue;
    const p = pessoa(s, r.pessoaId);
    if (!p) continue;
    for (const h of r.horarios) {
      const dose = s.doses.find((d) => d.remedioId === r.id && d.previstoPara === `${HOJE}T${h}`);
      out.push({ remedio: r, pessoa: p, horario: h, dose });
    }
  }
  return out.sort((a, b) => a.horario.localeCompare(b.horario));
}

const addDiasISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const proximos = (s: State, dias = 30) => {
  const lim = addDiasISO(HOJE, dias);
  return s.consultas.filter((c) => c.data >= HOJE && c.data <= lim);
};

export type DiaAdesao = { iso: string; estado: 'tomada' | 'perdida' | 'pendente' | 'fora'; tomadas: number; previstas: number };

/** Histórico dia a dia de um remédio (inclui hoje). */
export function historicoAdesao(s: State, remedioId: string, dias: number): DiaAdesao[] {
  const r = s.remedios.find((x) => x.id === remedioId);
  if (!r || r.seNecessario || !r.horarios.length) return [];
  return Array.from({ length: dias }, (_, i) => {
    const iso = addDiasISO(HOJE, i - dias + 1);
    const fora = (r.inicio && iso < r.inicio) || (r.fim && iso > r.fim);
    const tomadas = s.doses.filter((d) => d.remedioId === r.id && d.status === 'tomada' && d.previstoPara.startsWith(iso)).length;
    const previstas = fora ? 0 : r.horarios.length;
    const estado: DiaAdesao['estado'] = fora ? 'fora' : tomadas >= previstas ? 'tomada' : iso === HOJE ? 'pendente' : 'perdida';
    return { iso, estado, tomadas, previstas };
  });
}

/** % de doses tomadas nos últimos 30 dias (sem contar o que ainda vai ser tomado hoje). */
export function adesao(s: State, remedioId: string, dias = 30): number | undefined {
  const h = historicoAdesao(s, remedioId, dias + 1).filter((d) => d.iso !== HOJE);
  const prev = h.reduce((a, d) => a + d.previstas, 0);
  if (!prev) return undefined;
  return Math.round((h.reduce((a, d) => a + Math.min(d.tomadas, d.previstas), 0) / prev) * 100);
}

/** O que `de` compartilha com `para`. Para si mesmo, tudo. */
export function compartilhado(s: State, de: string, para: string): Categoria[] {
  // Pets são da casa: todo mundo vê e edita tudo.
  const tudo: Categoria[] = ['perfil', 'remedios', 'consultas', 'exames', 'plano'];
  const dono = s.pessoas.find((p) => p.id === de);
  if (de === para || dono?.tipo === 'pet') return tudo;
  // Responsável, administrador e cuidador veem tudo da pessoa.
  if (veTudo(s, para, de)) return tudo;
  // Dependente (cadastrado por alguém, sem aparelho próprio): nunca definiu compartilhamento, então a família vê tudo.
  if (dono && !dono.souEu && !s.compartilhamentos.some((c) => c.de === de)) return tudo;
  return s.compartilhamentos.find((c) => c.de === de && c.para === para)?.categorias ?? [];
}
export function podeVer(s: State, pessoaId: string, cat: Categoria) {
  return compartilhado(s, pessoaId, eu(s).id).includes(cat);
}

/** Consultas seguem a regra dos outros registros (desde 13/11/2026): só a pessoa, o responsável e administradores. */
export const paraConsultas = (s: State) => editaveis(s);
export const editaConsulta = (s: State, pessoaId: string) => podeEditar(s, eu(s)?.id, pessoaId);

/** Pessoas para quem você pode cadastrar e editar coisas: você, os pets, quem você é responsável e quem te aceitou como administrador. */
export function editaveis(s: State) {
  const meuId = eu(s)?.id;
  return s.pessoas.filter((p) => podeEditar(s, meuId, p.id));
}
/** Pode marcar Tomei/Pular nas doses da pessoa (inclui o cuidador). */
export const marcaDose = (s: State, pessoaId: string) => podeMarcarDose(s, eu(s)?.id, pessoaId);
/** Pessoas que aparecem no Início: você, os pets e de quem você cuida. */
export const doMeuCuidado = (s: State, pessoaId: string) => noMeuCuidado(s, eu(s)?.id, pessoaId);
