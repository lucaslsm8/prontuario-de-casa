import { Fragment, useCallback, useState } from 'react';
import { ExportarPdf } from '../mobile/Config';
import { HOJE, MODO_REAL } from '../data/tempo';
import { RestaurarBackup, SenhaApp, SenhaBackup } from '../ui/Backup';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adesao, compartilhado, dosesHoje, editaveis, eu, pessoa, useStore } from '../data/store';
import { mostrarAviso, useInfoAtualizacao, verificarAtualizacao } from '../data/atualizacao';
import { addDias, diasDeEstoque, estoqueBaixo, nomeMes, parseISO, pastaCurta, pctEstoque, quando, quem, tamanhoArquivo, toISO } from '../data/format';
import { CATEGORIAS, type Categoria } from '../data/types';
import { Bar, ChipGroup, Label, Pill, SecaoLista, Segmented, Toggle, cx } from '../ui';
import { agruparFamiliaPets, familia, opcoesPessoas } from '../data/pets';
import type { Remedio } from '../data/types';
import { CarteirinhaBalcao } from '../mobile/Familia';
import { useAbrir } from './Shell';
import { GaleriaAnexos } from '../ui/Anexos';
import { AcoesRegistro } from './Acoes';
import { CardFamilia } from '../ui/Familia';
import { RedesCasa } from '../ui/RedesCasa';
import { DConfirmar } from './Formulario';
import { AgendaIcs } from '../ui/AgendaIcs';
import { FaixaNumeros } from '../ui/Numeros';
import { IcAgenda, IcCheck, IcEstoque, IcExame, IcRemedio } from '../ui/Icones';

// ── D04 Agenda (mês) ────────────────────────────────────────────────────────

export function DAgenda() {
  const { state } = useStore();
  const abrir = useAbrir();
  const nav = useNavigate();
  // Abre no mês da próxima consulta (nos dados de exemplo, novembro).
  const [mes, setMes] = useState(() => {
    const d = parseISO(state.consultas.find((c) => c.data >= HOJE)?.data ?? HOJE);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const primeiro = new Date(mes.y, mes.m, 1);
  const inicioGrade = addDias(toISO(primeiro), -((primeiro.getDay() + 6) % 7));
  const semanas = Math.ceil((((primeiro.getDay() + 6) % 7) + new Date(mes.y, mes.m + 1, 0).getDate()) / 7);
  const dias = Array.from({ length: semanas * 7 }, (_, i) => addDias(inicioGrade, i));
  const mover = (d: number) => setMes(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const titulo = `${nomeMes(mes.m).replace(/^./, (c) => c.toUpperCase())} ${mes.y}`;
  const dot = (cor: string) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />;
  const futuras = state.consultas.filter((c) => c.data >= HOJE).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  const prox = futuras[0];
  const em30 = futuras.filter((c) => c.data <= addDias(HOJE, 30));

  return (
    <div className="desk__page">
      <FaixaNumeros itens={[
        { rotulo: 'Próxima', valor: prox ? `${prox.data.slice(8, 10)}/${prox.data.slice(5, 7)}` : '—', det: prox ? `${prox.titulo} · ${quem(pessoa(state, prox.pessoaId))} · ${prox.hora}` : 'nada marcado', icone: <IcAgenda />, tom: 'sol', onClick: prox ? () => nav(`/consulta/${prox.id}/resumo`) : undefined },
        { rotulo: 'Próximos 30 dias', valor: em30.length, det: `${em30.filter((c) => c.tipo === 'consulta').length} consultas · ${em30.filter((c) => c.tipo === 'exame').length} exames`, icone: <IcCheck size={18} />, tom: 'neutro' },
        { rotulo: 'Retornos marcados', valor: futuras.filter((c) => c.retornoDe).length, det: 'criados depois da consulta', icone: <IcExame />, tom: 'neutro' },
      ]} />
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <div className="hstack" style={{ gap: 16 }}>
          <h1 className="desk-title" style={{ margin: 0 }}>{titulo}</h1>
          <span className="hstack" style={{ fontSize: 16, color: 'var(--text-2)' }}>
            <button type="button" aria-label="Mês anterior" style={{ width: 24, height: 32 }} onClick={() => mover(-1)}>‹</button>
            <button type="button" aria-label="Próximo mês" style={{ width: 24, height: 32 }} onClick={() => mover(1)}>›</button>
          </span>
        </div>
        <div className="hstack" style={{ gap: 12 }}>
          <div className="hstack" style={{ gap: 14, fontSize: 13, color: 'var(--text-2)' }}>
            <span className="hstack" style={{ gap: 6 }}>{dot('var(--teal)')}Consulta</span>
            <span className="hstack" style={{ gap: 6 }}>{dot('var(--warn-bar)')}Exame</span>
          </div>
          <AgendaIcs />
          <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('consulta')}>Nova consulta</button>
        </div>
      </div>
      <div className="card" style={{ flex: 1, minHeight: 560, display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gridTemplateRows: `32px repeat(${semanas},minmax(0,1fr))`, overflow: 'hidden', fontSize: 13 }}>
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((d) => (
          <span key={d} className="mono" style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: 11, borderBottom: '1px solid var(--divider)' }}>{d}</span>
        ))}
        {dias.map((iso, i) => {
          const d = parseISO(iso);
          const noMes = d.getMonth() === mes.m;
          // Família primeiro, pets depois (sem divisória: a célula é pequena demais).
          const evs = (() => { const g = agruparFamiliaPets(noMes ? state.consultas.filter((c) => c.data === iso) : [], state); return [...g.familia, ...g.pets]; })();
          return (
            <div key={iso} className="stack" style={{ padding: '8px 10px', gap: 4, minWidth: 0, borderRight: i % 7 < 6 ? '1px solid var(--divider)' : undefined, borderBottom: i < dias.length - 7 ? '1px solid var(--divider)' : undefined }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: noMes ? 'var(--ink)' : '#B8C3C8' }}>{d.getDate()}</span>
              {evs.map((e) => {
                const cons = e.tipo === 'consulta';
                const nome = e.titulo.replace('Exame ', '').replace(/^TSH e T4 livre$/, 'TSH').replace('Endocrinologista', 'Endocrino');
                const props = {
                  title: `${e.hora} ${e.titulo} · ${pessoa(state, e.pessoaId)?.curto}`,
                  style: { fontSize: 12, fontWeight: 500, padding: '4px 6px', borderRadius: 6, background: cons ? 'var(--teal-light)' : 'var(--warn-bg)', color: cons ? 'var(--teal-dark)' : 'var(--warn-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' } as const,
                };
                const texto = `${e.hora} ${nome} · ${pessoa(state, e.pessoaId)?.curto}`;
                // Consulta abre o resumo; exame continua só informativo.
                return cons
                  ? <button key={e.id} type="button" className="agenda-pill" {...props} onClick={() => nav(`/consulta/${e.id}/resumo`)}>{texto}</button>
                  : <span key={e.id} {...props}>{texto}</span>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── D05 Remédios ────────────────────────────────────────────────────────────

const COLS = '2fr 1fr 1.4fr 1.2fr 1.4fr';

export function DRemedios() {
  const { state } = useStore();
  const abrir = useAbrir();
  const nav = useNavigate();
  const [aba, setAba] = useState<'uso' | 'enc'>('uso');
  const [filtro, setFiltro] = useState('todos');
  const ativos = state.remedios.filter((r) => r.ativo);
  const encerrados = state.remedios.filter((r) => !r.ativo);
  const lista = (aba === 'uso' ? ativos : encerrados).filter((r) => filtro === 'todos' || r.pessoaId === filtro);
  const pessoas = opcoesPessoas(state.pessoas.filter((p) => state.remedios.some((r) => r.pessoaId === p.id)), quem);
  const grupos = agruparFamiliaPets(lista, state);
  const ordenada = [...grupos.familia, ...grupos.pets];
  const baixos = ativos.filter(estoqueBaixo);
  const adesoes = ativos.map((r) => adesao(state, r.id)).filter((x): x is number => x != null);
  const mediaAdesao = adesoes.length ? Math.round(adesoes.reduce((a, b) => a + b, 0) / adesoes.length) : undefined;

  return (
    <div className="desk__page">
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <h1 className="desk-title" style={{ margin: 0 }}>Remédios</h1>
        <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('remedio')}>Novo remédio</button>
      </div>
      <FaixaNumeros itens={[
        { rotulo: 'Em uso', valor: ativos.length, det: `${ativos.filter((r) => r.seNecessario).length} se necessário`, icone: <IcRemedio />, tom: 'teal' },
        { rotulo: 'Doses de hoje', valor: `${dosesHoje(state).filter((d) => d.dose?.status === 'tomada').length}/${dosesHoje(state).length}`, det: 'tomadas', icone: <IcCheck size={18} />, tom: 'neutro', para: '/' },
        { rotulo: 'Adesão média', valor: mediaAdesao == null ? '—' : `${mediaAdesao}%`, det: 'últimos 30 dias', icone: <IcAgenda />, tom: 'sol' },
        { rotulo: 'Estoque baixo', valor: baixos.length, det: baixos.length ? baixos.map((r) => r.nome.split(' ')[0]).join(', ') : 'tudo em dia', icone: <IcEstoque />, tom: baixos.length ? 'warn' : 'neutro', alerta: baixos.length > 0 },
      ]} />
      <div className="hstack" style={{ gap: 12 }}>
        <Segmented variante="desk" opcoes={[{ id: 'uso', nome: `Em uso · ${ativos.length}` }, { id: 'enc', nome: `Encerrados · ${encerrados.length}` }]} valor={aba} onChange={setAba} />
        <ChipGroup gap6 tamanho="xs" opcoes={[{ id: 'todos', nome: 'Todos' }, ...pessoas.opcoes]} separarAntes={pessoas.separarAntes && pessoas.separarAntes + 1} valor={filtro} onChange={setFiltro} />
      </div>

      {aba === 'uso' ? (
        <div className="card" style={{ fontSize: 14 }}>
          <div className="mono" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 20px', borderBottom: '1px solid var(--divider)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-2)' }}>
            <span>REMÉDIO</span><span>PESSOA</span><span>HORÁRIOS</span><span>ADESÃO 30 D</span><span>ESTOQUE</span>
          </div>
          {ordenada.map((r: Remedio, i) => {
            const baixo = estoqueBaixo(r);
            const dias = diasDeEstoque(r);
            return (
              <Fragment key={r.id}>
                {i === grupos.familia.length && <SecaoLista rotulo="Pets" style={{ padding: '14px 20px 6px', borderTop: i > 0 ? '1px solid var(--divider)' : undefined }} />}
                <button
                  type="button"
                  onClick={() => nav(`/remedios/${r.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: COLS, padding: '16px 20px', alignItems: 'center', textAlign: 'left', width: '100%', borderBottom: i < ordenada.length - 1 && i !== grupos.familia.length - 1 ? '1px solid var(--divider)' : undefined, background: baixo ? 'var(--warn-row)' : undefined, borderRadius: i === ordenada.length - 1 ? '0 0 var(--r-card) var(--r-card)' : undefined }}
                >
                  <span className="stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{r.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.seNecessario ? 'se necessário' : `${r.dose}${r.observacao ? ` ${r.observacao}` : ''} · ${r.continuo ? 'contínuo' : 'tratamento'}`}</span>
                  </span>
                  <span>{quem(pessoa(state, r.pessoaId))}</span>
                  <span className={r.horarios.length ? 'mono' : 'faint'}>{r.horarios.length ? r.horarios.join(' · ') : 'sem horário'}</span>
                  {(() => { const a = adesao(state, r.id); return <span className={a == null ? 'faint' : undefined}>{a != null ? `${a}%` : '—'}</span>; })()}
                  {dias != null ? (
                    <span className="hstack" style={{ gap: 10 }}>
                      <Bar pct={pctEstoque(r)} baixo={baixo} trilhoAlerta={baixo} />
                      <span style={{ fontWeight: baixo ? 600 : 400, color: baixo ? 'var(--warn-text)' : 'var(--text-2)' }}>{dias} dias</span>
                    </span>
                  ) : (
                    <span className="muted">{r.estoqueTexto ?? '—'}</span>
                  )}
                </button>
              </Fragment>
            );
          })}
          {lista.length === 0 && (
            <div className="stack" style={{ padding: '22px 20px', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{filtro === 'todos' ? 'Nenhum remédio em uso' : 'Nenhum remédio em uso para essa pessoa'}</span>
              <span className="muted" style={{ fontSize: 14, lineHeight: 1.45 }}>Cadastre o remédio com os horários: o Início mostra a dose da vez e o app lembra na hora certa.</span>
              <button type="button" className="btn btn--soft btn--h38" style={{ marginTop: 6 }} onClick={() => abrir('remedio')}>Cadastrar remédio</button>
            </div>
          )}
        </div>
      ) : null}

      <div className="stack" style={{ gap: 8 }}>
        <Label>{aba === 'uso' ? 'Encerrados recentemente' : 'Encerrados'}</Label>
        <div className="card" style={{ fontSize: 14 }}>
          {(() => {
            const g = agruparFamiliaPets(aba === 'uso' ? encerrados.slice(0, 2) : encerrados.filter((r) => filtro === 'todos' || r.pessoaId === filtro), state);
            const linha = (r: Remedio) => (
              <div key={r.id} className="row" style={{ padding: '14px 20px' }}>
                <span>{r.nome} · {quem(pessoa(state, r.pessoaId))}</span>
                <span className="muted">{r.encerradoResumo}</span>
              </div>
            );
            return <>{g.familia.map(linha)}{g.pets.length > 0 && <><SecaoLista rotulo="Pets" style={{ padding: '14px 20px 6px' }} />{g.pets.map(linha)}</>}</>;
          })()}
        </div>
      </div>
    </div>
  );
}

// ── D06 Planos de saúde ─────────────────────────────────────────────────────

export function DPlanos() {
  const { state, api } = useStore();
  const abrir = useAbrir();
  const [selId, setSel] = useState<string | undefined>(state.planos[0]?.id);
  const sel = state.planos.find((p) => p.id === selId) ?? state.planos[0];
  const [params] = useSearchParams();
  const [balcao, setBalcao] = useState(() => params.get('balcao') === '1');
  const fecharBalcao = useCallback(() => setBalcao(false), []);
  const cel = (k: string, v: React.ReactNode, i: number, total: number) => (
    <div className="stack" style={{ padding: '14px 20px', gap: 2, borderRight: i % 2 === 0 ? '1px solid var(--divider)' : undefined, borderBottom: i < total - 2 ? '1px solid var(--divider)' : undefined }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );

  if (!sel) {
    return (
      <div className="desk__page">
        <h1 className="desk-title" style={{ margin: 0 }}>Planos de saúde</h1>
        <div className="card card--dashed" style={{ padding: 24, gap: 6, alignItems: 'flex-start', maxWidth: 480 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Nenhum plano guardado</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Guarde a carteirinha para ter o número à mão no balcão.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => abrir('plano')}>Adicionar plano</button>
        </div>
      </div>
    );
  }

  const detalhes: [string, React.ReactNode][] = [
    ['Registro ANS', sel.registroAns],
    ['Segmentação', sel.segmentacao],
    ['Abrangência', sel.abrangencia],
    ['Acomodação', sel.acomodacao],
    ['Carências', sel.carencias],
    ['Cartão SUS (CNS)', sel.cns ? <span className="mono">{sel.cns}</span> : '—'],
    ['Central 24 h', sel.central ? <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{sel.central}</span> : '—'],
    ['Mensalidade', sel.mensalidade ?? (sel.vinculo === 'dependente' ? 'incluída no titular' : '—')],
  ];

  return (
    <div className="desk__page" style={{ gap: 20 }}>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <h1 className="desk-title" style={{ margin: 0 }}>Planos de saúde</h1>
        <div className="hstack" style={{ gap: 8 }}>
          <AcoesRegistro
            podeEditar={editaveis(state).some((x) => x.id === sel.pessoaId)}
            editar={`editar-plano:${sel.id}`}
            apagar={{
              titulo: `Apagar o plano ${sel.operadora} de ${quem(pessoa(state, sel.pessoaId))}?`,
              texto: 'A carteirinha e as fotos dela saem do arquivo. Se foi engano, use “Desfazer” no aviso.',
              onConfirm: () => { api.remover('planos', sel, 'Plano apagado'); setSel(undefined); },
            }}
          />
          <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('plano')}>Adicionar plano</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        {state.planos.map((p, i) => {
          const on = p.id === sel.id;
          const odonto = p.segmentacao === 'Odontológico';
          const dark = !odonto;
          const sub = dark ? 'var(--tab-inactive)' : 'var(--text-2)';
          return (
            // Cartão = div simples; um botão transparente cobre o cartão para selecionar, e "Mostrar no balcão" é irmão dele.
            <div
              key={p.id}
              className="stack plano-card"
              style={{
                borderRadius: 8, padding: 20, gap: 18, textAlign: 'left',
                background: dark ? (i === 0 ? 'var(--ink)' : 'var(--ink-2)') : '#fff', color: dark ? '#fff' : undefined,
                border: dark ? undefined : '1px solid var(--border-card)',
                outline: on ? '2px solid var(--teal)' : '2px solid transparent', outlineOffset: 3, transition: 'outline-color 180ms',
              }}
            >
              <button type="button" className="plano-card__sel" aria-pressed={on} aria-label={`${p.operadora} · ${quem(pessoa(state, p.pessoaId))}`} onClick={() => setSel(p.id)} />
              <span className="hstack" style={{ justifyContent: 'space-between', pointerEvents: 'none' }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{p.operadora}</span>
                <span style={{ fontSize: 12, color: sub }}>{quem(pessoa(state, p.pessoaId))} · {p.vinculo}</span>
              </span>
              <span className="mono" style={{ fontSize: 17, pointerEvents: 'none' }}>{p.numero}</span>
              <span className="hstack" style={{ justifyContent: 'space-between', fontSize: 13, color: sub, pointerEvents: 'none' }}>
                <span>{odonto ? p.produto : `${p.produto} · ${p.acomodacaoCurta}`}</span>
                <span>val. {p.validade}</span>
              </span>
              {on && (
                <button
                  type="button"
                  className={cx('btn btn--h36 plano-card__acao', dark ? 'btn--on-dark' : 'btn--soft')}
                  onClick={() => setBalcao(true)}
                >
                  Mostrar no balcão
                </button>
              )}
            </div>
          );
        })}
      </div>
      {balcao && <CarteirinhaBalcao desktop plano={sel} nome={pessoa(state, sel.pessoaId)?.nome ?? sel.titularNome} onClose={fecharBalcao} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ fontSize: 14 }}>
          <div className="card-head card-head--20"><Label>Detalhes · {sel.operadora.split(' ')[0]} · {pessoa(state, sel.pessoaId)?.curto}</Label></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {detalhes.map(([k, v], i) => <div key={k}>{cel(k, v, i, detalhes.length)}</div>)}
          </div>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ fontSize: 14 }}>
            <div className="card-head card-head--20"><Label>Imagens da carteirinha</Label></div>
            <div style={{ padding: '16px 20px' }}>
              <GaleriaAnexos key={sel.id} donoId={sel.id} tipo="carteirinha" camera={false} />
            </div>
          </div>
          <div className="card" style={{ padding: '16px 20px', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Anotação</span>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: sel.anotacao ? undefined : 'var(--text-3)' }}>{sel.anotacao ?? 'Sem anotação.'}</span>
          </div>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Informações digitadas por você. O app não se conecta às operadoras.</span>
    </div>
  );
}

// ── D07 Privacidade e backup ────────────────────────────────────────────────

const BLOQ = ['1 minuto', '5 minutos', '15 minutos', '30 minutos'];

const ESTADO_ATUALIZACAO = { parado: '', verificando: 'Procurando…', 'em-dia': 'Em dia', disponivel: '', baixando: 'Baixando…', erro: 'Sem conexão com o GitHub' };

/** Versão instalada, "Procurar atualizações" e as opções (GitHub Releases, instalador assinado). */
function CardAtualizacoes() {
  const store = useStore();
  const { state, api } = store;
  const u = state.config.update;
  const at = useInfoAtualizacao();
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className="card-head card-head--20"><Label>Atualizações</Label></div>
      <div className="row" style={{ padding: '14px 20px' }}>
        <span className="stack" style={{ gap: 2 }}>
          <span>Versão {u.instalada}</span>
          <span style={{ fontSize: 13, color: at.disponivel ? 'var(--teal)' : 'var(--text-2)' }}>{at.disponivel ? `Versão ${at.disponivel.versao} disponível` : ESTADO_ATUALIZACAO[at.estado] || 'Novas versões chegam pelo GitHub Releases, com assinatura conferida.'}</span>
        </span>
        {at.disponivel
          ? <button type="button" className="btn btn--teal btn--h38" onClick={mostrarAviso}>Ver e instalar</button>
          : <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} disabled={at.estado === 'verificando'} onClick={() => void verificarAtualizacao(store, { manual: true })}>Procurar atualizações</button>}
      </div>
      <div className="row" style={{ padding: '14px 20px' }}><span>Procurar ao abrir o app</span><Toggle small on={u.auto} onChange={(v) => api.setConfig({ update: { ...u, auto: v } })} label="Procurar atualizações ao abrir o app" /></div>
      <div className="row" style={{ padding: '14px 20px' }}><span>Fazer backup antes de instalar</span><Toggle small on={u.backupAntes} onChange={(v) => api.setConfig({ update: { ...u, backupAntes: v } })} label="Fazer backup antes de instalar" /></div>
    </div>
  );
}

/** Confirmação de remoção (rede de casa) no diálogo do desktop. */
function ConfirmarPerigo(p: { titulo: string; texto: string; confirmar: string; onConfirm: () => void; onClose: () => void }) {
  return <DConfirmar perigo {...p} />;
}

export function DPrivacidade() {
  const [pdf, setPdf] = useState(false);
  const { state, api } = useStore();
  const nav = useNavigate();
  const c = state.config;
  const me = eu(state);
  const [editando, setEditando] = useState<string | null>(null);
  const [apagar, setApagar] = useState(false);
  const [folha, setFolha] = useState<null | 'senha' | 'trocar' | 'restaurar' | 'senhaApp'>(null);
  const b = c.backup;
  const escolherPasta = async () => {
    try {
      const p = await api.escolherPasta();
      if (p) { await api.configurarBackup({ pasta: p }); api.toast({ texto: `Backups em ${pastaCurta(p)}` }); }
    } catch (e) { api.toast({ texto: String(e) }); }
  };
  const [palavra, setPalavra] = useState('');
  // Pets são da casa: ficam fora da matriz de compartilhamento.
  const outros = familia(state).filter((p) => !p.souEu);
  const cols = '1.2fr repeat(5,minmax(0,1fr)) 120px';

  const celula = (on: boolean, editavel: boolean, onClick: () => void) =>
    editavel ? (
      <button type="button" onClick={onClick} aria-pressed={on} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-input)', color: on ? 'var(--teal)' : 'var(--border-input)', background: on ? 'var(--teal-light)' : '#fff' }}>
        {on ? '✓' : '—'}
      </button>
    ) : (
      <span style={{ color: on ? 'var(--teal)' : 'var(--border-input)' }}>{on ? '✓' : '—'}</span>
    );

  const alternar = (para: string, cat: Categoria) => {
    const atual = compartilhado(state, me.id, para);
    api.compartilhar(para, atual.includes(cat) ? atual.filter((x) => x !== cat) : [...atual, cat]);
  };

  return (
    <div className="desk__page" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6, maxWidth: 640 }}>
        <h1 className="desk-title" style={{ margin: 0 }}>Privacidade e backup</h1>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>Seus dados ficam neste computador. Nada é enviado para servidores; o backup é um arquivo criptografado que fica com você.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <div className="card" style={{ fontSize: 14 }}>
          <div className="card-head card-head--20"><Label>Bloqueio</Label></div>
          <div className="row" style={{ padding: '14px 20px' }}>
            <span>Pedir senha ao abrir</span>
            <Toggle small on={c.senhaAoAbrir && state.temSenha} onChange={(v) => (v && !state.temSenha ? setFolha('senhaApp') : api.setConfig({ senhaAoAbrir: v }))} label="Pedir senha ao abrir" />
          </div>
          {MODO_REAL && state.temSenha && (
            <button type="button" className="row" style={{ padding: '14px 20px' }} onClick={() => setFolha('senhaApp')}>
              <span>Senha do app</span><span className="muted">trocar ›</span>
            </button>
          )}
          <button type="button" className="row" style={{ padding: '14px 20px' }} onClick={() => api.setConfig({ bloqueioDesktop: BLOQ[(BLOQ.indexOf(c.bloqueioDesktop) + 1) % BLOQ.length] })}>
            <span>Bloquear após inatividade</span><span className="muted">{c.bloqueioDesktop} ›</span>
          </button>
          <RedesCasa desktop Confirmar={ConfirmarPerigo} />
          <div className="row" style={{ padding: '14px 20px' }}><span>Esconder nomes de remédios nas notificações</span><Toggle small on={c.esconderNomeNotif} onChange={(v) => api.setConfig({ esconderNomeNotif: v })} label="Esconder nomes de remédios" /></div>
        </div>
        <div className="card" style={{ fontSize: 14 }}>
          <div className="card-head card-head--20"><Label>Backup criptografado</Label></div>
          <div className="stack" style={{ padding: '16px 20px', gap: 14 }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{b.ultimo ? `Último backup: ${quando(b.ultimo)}` : 'Nenhum backup ainda'}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {b.arquivo ? `${b.arquivo}${b.tamanho ? ` · ${tamanhoArquivo(b.tamanho)}` : ''}` : b.temSenha ? 'Senha definida' : 'Crie uma senha para o primeiro backup'}
                </span>
              </div>
              <button type="button" onClick={() => api.configurarBackup({ freq: b.freq === 'semanal' ? 'manual' : 'semanal' })} title="Mudar frequência">
                <Pill>{b.freq === 'semanal' ? 'Semanal' : 'Manual'}</Pill>
              </button>
            </div>
            <button type="button" className="hstack" style={{ justifyContent: 'space-between', width: '100%' }} onClick={escolherPasta} title={b.pasta}>
              <span className="muted">Pasta de destino</span><span>{pastaCurta(b.pasta)} ›</span>
            </button>
            <div className="hstack" style={{ gap: 8 }}>
              <button type="button" className="btn btn--ink btn--h38" onClick={() => (b.temSenha ? api.backupAgora() : setFolha('senha'))}>Fazer backup agora</button>
              <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} onClick={() => setFolha('restaurar')}>Restaurar</button>
              <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} onClick={() => setFolha(b.temSenha ? 'trocar' : 'senha')}>{b.temSenha ? 'Trocar senha' : 'Criar senha'}</button>
            </div>
          </div>
        </div>
      </div>

      <CardFamilia desktop />

      <CardAtualizacoes />

      <div className="card" style={{ fontSize: 14 }}>
        <div className="row" style={{ padding: '16px 20px', gap: 16 }}>
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }}>Exportar perfil em PDF</span>
            <span className="muted" style={{ fontSize: 13 }}>Tudo de uma pessoa ou pet num arquivo, para levar a um profissional.</span>
          </span>
          <button type="button" className="btn btn--outline btn--h38" onClick={() => setPdf(true)}>Exportar PDF</button>
        </div>
      </div>
      {pdf && <ExportarPdf desktop onClose={() => setPdf(false)} />}

      <div className="card" style={{ fontSize: 14 }}>
        <div className="card-head card-head--20"><Label>Compartilhamento</Label></div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 20px', borderBottom: '1px solid var(--divider)', fontSize: 12, color: 'var(--text-2)' }}>
          <span>Pessoa</span>{CATEGORIAS.map((k) => <span key={k.id}>{k.id === 'plano' ? 'Plano' : k.nome}</span>)}<span />
        </div>
        {outros.map((p) => {
          const cats = compartilhado(state, me.id, p.id);
          const ed = editando === p.id;
          return (
            <div key={`eu-${p.id}`} style={{ display: 'grid', gridTemplateColumns: cols, padding: '14px 20px', borderBottom: '1px solid var(--divider)', alignItems: 'center', minHeight: 50 }}>
              <span style={{ fontWeight: 600 }}>Você → {p.curto}</span>
              {CATEGORIAS.map((k) => <span key={k.id}>{celula(cats.includes(k.id), ed, () => alternar(p.id, k.id))}</span>)}
              <button type="button" style={{ color: 'var(--teal)', fontWeight: 600, textAlign: 'right' }} onClick={() => setEditando(ed ? null : p.id)}>{ed ? 'Pronto' : 'Editar'}</button>
            </div>
          );
        })}
        {outros.map((p, i) => {
          const cats = compartilhado(state, p.id, me.id);
          return (
            <div key={`de-${p.id}`} style={{ display: 'grid', gridTemplateColumns: cols, padding: '14px 20px', borderBottom: i < outros.length - 1 ? '1px solid var(--divider)' : undefined, alignItems: 'center' }}>
              <span>{p.curto} → você</span>
              {CATEGORIAS.map((k) => <span key={k.id}>{celula(cats.includes(k.id), false, () => {})}</span>)}
              <span style={{ color: 'var(--text-3)', textAlign: 'right' }}>definido por {p.sexo === 'Feminino' ? 'ela' : 'ele'}</span>
            </div>
          );
        })}
      </div>

      <div className="hstack" style={{ justifyContent: 'space-between', fontSize: 14 }}>
        <span className="muted">{c.sync.ultima ? `Última sincronização entre aparelhos: ${c.sync.ultima} · ${c.sync.via}` : 'Sincronização entre aparelhos: ainda não configurada'}</span>
        <span className="hstack" style={{ gap: 16 }}>
          <button type="button" style={{ color: 'var(--danger)', fontWeight: 500 }} onClick={() => setApagar(true)}>Apagar todos os dados deste computador</button>
        </span>
      </div>

      {apagar && (
        <div className="overlay overlay--fixed" onClick={() => setApagar(false)}>
          <div className="dialog" style={{ padding: 28, gap: 14 }} onClick={(e) => e.stopPropagation()} role="alertdialog">
            <span style={{ fontSize: 22, fontWeight: 600 }}>Apagar tudo deste computador?</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>Remédios, consultas, exames e planos somem deste computador. O que foi compartilhado com outras pessoas continua com elas. Para confirmar, digite <b>APAGAR</b>.</span>
            <input className="input" value={palavra} onChange={(e) => setPalavra(e.target.value)} placeholder="APAGAR" autoFocus aria-label="Palavra de confirmação" />
            <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--outline btn--h40d" onClick={() => setApagar(false)}>Cancelar</button>
              <button type="button" className="btn btn--h40d" style={{ background: 'var(--danger)', color: '#fff' }} disabled={palavra.trim().toUpperCase() !== 'APAGAR'} onClick={async () => { await api.apagarTudo(); setApagar(false); nav('/'); }}>
                Apagar todos os dados
              </button>
            </div>
          </div>
        </div>
      )}
      {folha === 'senha' && <SenhaBackup desktop fazerBackup onClose={() => setFolha(null)} />}
      {folha === 'trocar' && <SenhaBackup desktop troca onClose={() => setFolha(null)} />}
      {folha === 'restaurar' && <RestaurarBackup desktop onClose={() => setFolha(null)} />}
      {folha === 'senhaApp' && <SenhaApp desktop onClose={() => setFolha(null)} onPronto={() => api.setConfig({ senhaAoAbrir: true })} />}
    </div>
  );
}
