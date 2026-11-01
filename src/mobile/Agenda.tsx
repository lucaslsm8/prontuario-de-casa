import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { LEMBRAR, useFormConsulta } from '../data/formularios';
import { adesao, editaveis, pessoa, useStore } from '../data/store';
import { addDias, dataBR, dataGrupo, diaMes, diaSemanaSigla, idade, nomeMes, numBR, numCurto, parseISO, quem } from '../data/format';
import type { Consulta, Pessoa } from '../data/types';
import { ChipGroup, Field, FieldGroup, Label, Row, SecaoLista, Toggle, TopNav, cx, InlineInput } from '../ui';
import { SECOES_PET, agruparFamiliaPets, ehPet, linhaAlergia, opcoesPessoas, resumoPet, type SecaoPet } from '../data/pets';
import { MScreen, TabHeader } from './Shell';
import { ConfirmarSheet } from '../ui/Confirmar';
import { PosConsulta } from '../ui/PosConsulta';
import { AgendaIcs } from '../ui/AgendaIcs';
import { SugestoesConsulta } from '../ui/Sugestoes';

const segunda = (iso: string) => {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7;
  return addDias(iso, -dow);
};

/** M07 — Agenda. */
export function Agenda() {
  const { state } = useStore();
  const nav = useNavigate();
  const primeiro = state.consultas.find((c) => c.data >= HOJE)?.data ?? HOJE;
  const [sel, setSel] = useState(primeiro);
  const inicioSemana = segunda(sel);
  const semana = Array.from({ length: 7 }, (_, i) => addDias(inicioSemana, i));
  const mes = parseISO(sel);
  // Por dia: primeiro a família; depois a divisória "Pets" e os dias com itens deles.
  const { grupos, gruposPets } = useMemo(() => {
    const porDia = (xs: Consulta[]) => {
      const m = new Map<string, Consulta[]>();
      xs.forEach((c) => m.set(c.data, [...(m.get(c.data) ?? []), c]));
      return [...m.entries()];
    };
    const g = agruparFamiliaPets(state.consultas.filter((c) => c.data >= sel), state);
    return { grupos: porDia(g.familia), gruposPets: porDia(g.pets) };
  }, [state, sel]);
  const dia = ([data, itens]: [string, Consulta[]]) => (
    <div key={data} className="stack" style={{ gap: 8 }}>
      <Label>{dataGrupo(data)}</Label>
      {itens.map((c) => (c.tipo === 'consulta' ? <CartaoConsulta key={c.id} c={c} /> : <CartaoExame key={c.id} c={c} />))}
    </div>
  );

  return (
    <MScreen tabs>
      <TabHeader titulo="Agenda" onAdd={() => nav('/agenda/nova')} />
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}><AgendaIcs compacto /></div>
      <div className="hstack" style={{ justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
        <span>{nomeMes(mes.getMonth()).replace(/^./, (c) => c.toUpperCase())} {mes.getFullYear()}</span>
        <span className="hstack" style={{ color: 'var(--text-2)', fontWeight: 500, gap: 2 }}>
          <button type="button" aria-label="Semana anterior" style={{ width: 28, height: 44, margin: '-11px 0' }} onClick={() => setSel(addDias(sel, -7))}>‹</button>
          <button type="button" aria-label="Próxima semana" style={{ width: 28, height: 44, margin: '-11px 0' }} onClick={() => setSel(addDias(sel, 7))}>›</button>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4, textAlign: 'center' }}>
        {semana.map((iso) => {
          const d = parseISO(iso);
          const on = iso === sel;
          const fim = d.getDay() === 0 || d.getDay() === 6;
          const evs = state.consultas.filter((c) => c.data === iso);
          const dot = evs.some((e) => e.tipo === 'consulta') ? (on ? 'var(--teal-on-dark)' : 'var(--teal)') : evs.length ? 'var(--warn-bar)' : 'transparent';
          return (
            <button
              type="button"
              key={iso}
              onClick={() => setSel(iso)}
              className="stack"
              style={{ alignItems: 'center', gap: 6, padding: '8px 0', borderRadius: 6, background: on ? 'var(--ink)' : undefined, color: on ? '#fff' : undefined, transition: 'background 180ms' }}
            >
              <span style={{ fontSize: 11, color: on ? undefined : 'var(--text-3)', opacity: on ? 0.7 : 1 }}>{diaSemanaSigla(d)}</span>
              <span style={{ fontSize: 16, fontWeight: on ? 600 : 500, color: !on && fim ? 'var(--text-3)' : undefined }}>{d.getDate()}</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot }} />
            </button>
          );
        })}
      </div>
      {grupos.map(dia)}
      {gruposPets.length > 0 && <><SecaoLista rotulo="Pets" />{gruposPets.map(dia)}</>}
      {grupos.length + gruposPets.length === 0 && (
        <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Nada marcado daqui pra frente</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Registre consultas e exames para receber o lembrete.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => nav('/agenda/nova')}>Nova consulta</button>
        </div>
      )}
    </MScreen>
  );
}

function CartaoConsulta({ c }: { c: Consulta }) {
  const { state, api } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, c.pessoaId);
  const lembrete = c.lembretes.includes('1 dia antes');
  return (
    <div className="card" style={{ padding: 16, gap: 12 }}>
      <button type="button" className="hstack" style={{ gap: 14, alignItems: 'flex-start', textAlign: 'left' }} onClick={() => nav(`/consulta/${c.id}/resumo`)}>
        <div className="stack" style={{ alignItems: 'center', gap: 2, width: 48 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{c.hora}</span>
          {c.duracaoMin && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.duracaoMin} min</span>}
        </div>
        <div className="stack" style={{ flex: 1, gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{c.titulo}</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{[c.profissional, quem(p)].filter(Boolean).join(' · ')}</span>
          {c.local && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{[c.local, c.endereco].filter(Boolean).join(', ')}</span>}
        </div>
      </button>
      {c.levar.length > 0 && (
        <div className="stack" style={{ borderRadius: 6, background: 'var(--bg)', padding: 12, gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Levar</span>
          {c.levar.map((l, i) => (
            <button type="button" key={l.item} style={{ fontSize: 14, textAlign: 'left' }} onClick={() => api.toggleLevar(c.id, i)} aria-pressed={l.ok}>
              {l.ok ? '✓' : '○'}{'  '}{l.item}
            </button>
          ))}
        </div>
      )}
      <div className="hstack" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn btn--h36"
          aria-pressed={lembrete}
          style={{ background: lembrete ? 'var(--teal-light)' : '#fff', border: lembrete ? undefined : '1px solid var(--border-card)', color: 'var(--teal)' }}
          onClick={() => api.toggleLembrete(c.id, '1 dia antes')}
        >
          Lembrar 1 dia antes
        </button>
        {c.local && (
          <a className="btn btn--soft btn--h36" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.local, c.endereco].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer">
            Como chegar
          </a>
        )}
      </div>
    </div>
  );
}

function CartaoExame({ c }: { c: Consulta }) {
  const { state } = useStore();
  return (
    <div className="card" style={{ padding: '14px 16px', flexDirection: 'row', gap: 14 }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 500, width: 48, textAlign: 'center' }}>{c.hora}</span>
      <div className="stack" style={{ flex: 1, gap: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{c.titulo}</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {[quem(pessoa(state, c.pessoaId)), c.local, c.preparo?.replace('jejum de', 'jejum')].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  );
}

// ── M18 Nova consulta ───────────────────────────────────────────────────────

/** /consulta/:id/editar — o mesmo formulário, preenchido. */
export function EditarConsulta() {
  const { id } = useParams();
  const { state } = useStore();
  const nav = useNavigate();
  const c = state.consultas.find((x) => x.id === id);
  if (!c) return <Navigate to="/agenda" replace />;
  return <NovaConsulta consulta={c} onDone={() => nav(`/consulta/${c.id}/resumo`, { replace: true })} />;
}

export function NovaConsulta({ onDone, consulta }: { onDone?: () => void; consulta?: Consulta }) {
  const { state } = useStore();
  const nav = useNavigate();
  const fechar = onDone ?? (() => nav('/agenda'));
  const pessoas = editaveis(state);
  const { titulo, setTitulo, para, setPara, quando, setQuando, prof, setProf, local, setLocal, plano, setPlano, levar, setLevar, novoItem, setNovoItem, lembrar, setLembrar, paraPet, editando, valido, salvar } = useFormConsulta(fechar, { inicial: consulta });

  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" titulo={editando ? 'Editar consulta' : 'Nova consulta'} />
      <Field label="Especialidade">
        <input className="input input--50" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={paraPet ? 'Veterinário' : undefined} autoFocus />
      </Field>
      <FieldGroup label="Para quem">
        <ChipGroup largo {...opcoesPessoas(pessoas, quem)} valor={para} onChange={setPara} />
      </FieldGroup>
      <div className="card" style={{ fontSize: 15 }}>
        <Row compact style={{ padding: '12px 16px' }} label="Data e hora" valor={<InlineInput className="mono" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Data e hora" />} />
        <Row compact style={{ padding: '12px 16px' }} label="Profissional" valor={<InlineInput style={{ fontWeight: 400 }} list="sug-prof" value={prof} onChange={(e) => setProf(e.target.value)} aria-label="Profissional" />} />
        <SugestoesConsulta />
        <Row compact style={{ padding: '12px 16px' }} label="Local" valor={<InlineInput style={{ fontWeight: 400 }} list="sug-local" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Local" />} />
        <Row compact style={{ padding: '12px 16px' }} label="Pelo plano" valor={<button type="button" onClick={() => setPlano(!plano)}>{plano ? 'Vitalis · sim' : 'Não'}</button>} />
      </div>
      <FieldGroup label="Levar">
        <div className="card" style={{ fontSize: 15 }}>
          {levar.map((l, i) => (
            <button
              type="button"
              key={l.item}
              className="row"
              style={{ padding: '12px 16px', justifyContent: 'flex-start', gap: 10 }}
              onClick={() => setLevar(levar.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}
            >
              <span style={{ color: 'var(--teal)', width: 12 }}>{l.ok ? '✓' : '○'}</span>
              {l.item}
            </button>
          ))}
          {novoItem !== null ? (
            <div className="row" style={{ padding: '8px 16px' }}>
              <input
                className="inline-input"
                style={{ textAlign: 'left', width: '100%', fontWeight: 400 }}
                autoFocus
                placeholder="Ex.: Pedido médico"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && novoItem.trim()) { setLevar([...levar, { item: novoItem.trim(), ok: true }]); setNovoItem(null); }
                  if (e.key === 'Escape') setNovoItem(null);
                }}
                onBlur={() => { if (novoItem.trim()) setLevar([...levar, { item: novoItem.trim(), ok: true }]); setNovoItem(null); }}
              />
            </div>
          ) : (
            <button type="button" className="row" style={{ padding: '12px 16px', color: 'var(--teal)', fontWeight: 500, justifyContent: 'flex-start' }} onClick={() => setNovoItem('')}>
              + Adicionar item
            </button>
          )}
        </div>
      </FieldGroup>
      <FieldGroup label="Lembrar">
        <ChipGroup gap6 tom="teal" tamanho="md" opcoes={LEMBRAR.map((x) => ({ id: x, nome: x }))} valor={lembrar} onChange={setLembrar} />
      </FieldGroup>
      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!valido} onClick={salvar}>
        Salvar consulta
      </button>
    </MScreen>
  );
}

// ── M19 Resumo para consulta ────────────────────────────────────────────────

export type Secao = 'identificacao' | 'alergias' | 'condicoes' | 'remedios' | 'exames' | 'perguntas';
export const SECOES: { id: Secao; nome: string }[] = [
  { id: 'identificacao', nome: 'Identificação' },
  { id: 'alergias', nome: 'Alergias' },
  { id: 'condicoes', nome: 'Condições' },
  { id: 'remedios', nome: 'Remédios em uso' },
  { id: 'exames', nome: 'Exames anexados' },
  { id: 'perguntas', nome: 'Perguntas' },
];
/** Seções de pessoas e de pets (as comuns têm o mesmo id). Tudo começa marcado. */
export type SecaoResumo = Secao | SecaoPet;
export const TODAS_SECOES = Object.fromEntries([...SECOES, ...SECOES_PET].map((s) => [s.id, true])) as Record<SecaoResumo, boolean>;
/** Itens de "Escolher itens": os do pet quando a consulta é de um pet. */
export const secoesDoResumo = (p: Pessoa): { id: SecaoResumo; nome: string }[] => (ehPet(p) ? SECOES_PET : SECOES);

/** Documento do resumo (M19), compartilhado com o desktop (D-resumo). `grande` = "Mostrar na tela". */
/** `titulo`: cabeçalho dentro do documento (o desktop leva o título do resumo para dentro, para sair na impressão). */
export function DocumentoResumo({ consulta: c, incluir, grande = false, className, style, titulo }: { consulta: Consulta; incluir: Record<SecaoResumo, boolean>; grande?: boolean; className?: string; style?: CSSProperties; titulo?: ReactNode }) {
  const { state } = useStore();
  const p = pessoa(state, c.pessoaId);
  if (!p) return null;
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === p.id && !r.seNecessario);
  const linhasRemedios = remedios.map((r) => `${r.nome} · ${r.horarios.join(', ')} · ${adesao(state, r.id) ?? '—'}% das doses em 30 dias`);
  const pet = ehPet(p) ? resumoPet(state, p) : undefined;
  const exames = state.exames.filter((e) => e.consultaId === c.id);
  const ident = [idade(p) != null && `${idade(p)} anos`, p.sangue, p.peso && `${numCurto(p.peso)} kg`, p.altura && `${numBR(p.altura)} m`].filter(Boolean).join(' · ');
  const condicoes = p.condicoes.filter((x) => x.tipo !== 'vacina').map((x) => `${x.nomeClinico ?? x.nome}${x.desde ? ` (${x.desde})` : ''}`).join(' · ');

  const secao = (rotulo: string, linhas: string[], alerta?: boolean) => (
    <div className="stack" style={{ gap: 4 }}>
      <span className="mono" style={{ fontSize: grande ? 12 : 10, letterSpacing: '.1em', color: alerta ? 'var(--warn-text)' : 'var(--text-2)' }}>{rotulo}</span>
      {linhas.map((l, i) => <span key={i} style={{ fontSize: grande ? 17 : 13, lineHeight: 1.35 }}>{l}</span>)}
    </div>
  );

  return (
    <div className={cx('card', className)} style={{ flex: 1, padding: 20, gap: 14, boxShadow: '0 10px 24px -18px rgba(20,40,50,.4)', ...style }}>
      {titulo}
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--divider)', paddingBottom: 12 }}>
        <span style={{ fontSize: grande ? 20 : 16, fontWeight: 600 }}>{p.nome}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{dataBR(HOJE)}</span>
      </div>
      {pet ? (
        <>
          {incluir.identificacao && secao('IDENTIFICAÇÃO DO PET', pet.identificacao)}
          {incluir.peso && pet.peso.length > 0 && secao('PESO', pet.peso)}
          {incluir.alergias && pet.alergias.length > 0 && secao('ALERGIAS', pet.alergias, true)}
          {incluir.remedios && remedios.length > 0 && secao('REMÉDIOS EM USO', linhasRemedios)}
          {incluir.vacinas && pet.vacinas.length > 0 && secao('VACINAS', pet.vacinas)}
          {incluir.prevencao && pet.prevencao.length > 0 && secao('PREVENÇÃO', pet.prevencao)}
          {incluir.sintomas && pet.sintomas.length > 0 && secao('SINTOMAS · ÚLTIMOS 30 DIAS', pet.sintomas)}
          {incluir.procedimentos && pet.procedimentos.length > 0 && secao('PROCEDIMENTOS', pet.procedimentos)}
        </>
      ) : (
        <>
          {incluir.identificacao && secao('IDENTIFICAÇÃO', [ident])}
          {incluir.alergias && p.alergias.length > 0 && secao('ALERGIAS', p.alergias.map(linhaAlergia), true)}
          {incluir.condicoes && condicoes && secao('CONDIÇÕES', [condicoes])}
          {incluir.remedios && remedios.length > 0 && secao('REMÉDIOS EM USO', linhasRemedios)}
          {incluir.exames && exames.length > 0 && secao('EXAMES ANEXADOS', exames.map((e) => `${e.nome} · ${diaMes(e.dataColeta)}`))}
          {incluir.perguntas && c.perguntas?.length ? secao('PERGUNTAS', c.perguntas) : null}
        </>
      )}
    </div>
  );
}

export function ResumoConsulta() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const [apagar, setApagar] = useState(false);
  const c = state.consultas.find((x) => x.id === id) ?? state.consultas[0];
  const p = c ? pessoa(state, c.pessoaId) : undefined;
  const [incluir, setIncluir] = useState<Record<SecaoResumo, boolean>>(TODAS_SECOES);
  const [escolher, setEscolher] = useState(false);
  const [tela, setTela] = useState(false);

  if (!c || !p) return <MScreen><TopNav voltar="Agenda" voltarPara="/agenda" /><span className="muted">Consulta não encontrada.</span></MScreen>;

  const especialista = c.titulo.toLowerCase();
  const documento = <DocumentoResumo consulta={c} incluir={incluir} grande={tela} />;

  if (tela) {
    return (
      <MScreen gap={16} bg="#fff">
        <TopNav voltar="Resumo" extra={<button type="button" style={{ color: 'var(--teal)', fontWeight: 500 }} onClick={() => setTela(false)}>Fechar</button>} />
        {documento}
      </MScreen>
    );
  }

  return (
    <MScreen gap={14}>
      <TopNav voltar="Consulta" voltarPara="/agenda" acao="Escolher itens" onAcao={() => setEscolher(true)} />
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="title title--26" style={{ margin: 0 }}>Resumo para o {especialista}</h1>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{p.curto} · consulta de {diaMes(c.data)}</span>
      </div>
      <PosConsulta key={c.id} consulta={c} podeEditar={editaveis(state).some((x) => x.id === c.pessoaId)} />
      {documento}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--ink btn--h52 btn--grow" onClick={() => window.print()}>Exportar PDF</button>
        <button type="button" className="btn btn--outline btn--h52 btn--grow" onClick={() => setTela(true)}>Mostrar na tela</button>
      </div>
      {editaveis(state).some((x) => x.id === c.pessoaId) && (
        <div className="hstack" style={{ justifyContent: 'center', gap: 8 }}>
          <button type="button" className="btn btn--link" style={{ minHeight: 44, fontSize: 15 }} onClick={() => nav(`/consulta/${c.id}/editar`)}>Editar consulta</button>
          <button type="button" className="btn btn--danger-link" style={{ minHeight: 44, fontSize: 15 }} onClick={() => setApagar(true)}>Apagar</button>
        </div>
      )}
      {apagar && (
        <ConfirmarSheet
          titulo={`Apagar ${c.titulo} de ${diaMes(c.data)}?`}
          texto="A consulta sai da agenda e os lembretes dela param."
          confirmar="Apagar consulta"
          onConfirm={() => { api.remover('consultas', c, `${c.titulo} apagado`); nav('/agenda'); }}
          onClose={() => setApagar(false)}
        />
      )}
      {escolher && (
        <>
          <div className="overlay" onClick={() => setEscolher(false)} />
          <div className="sheet" role="dialog" aria-label="Escolher itens">
            <span style={{ fontSize: 18, fontWeight: 600 }}>O que entra no resumo</span>
            <div className="card" style={{ fontSize: 15 }}>
              {secoesDoResumo(p).map((s) => (
                <Row key={s.id} mutedLabel={false} label={s.nome} valor={<Toggle on={incluir[s.id]} onChange={(v) => setIncluir({ ...incluir, [s.id]: v })} label={s.nome} />} />
              ))}
            </div>
            <button type="button" className={cx('btn btn--cta')} onClick={() => setEscolher(false)}>Pronto</button>
          </div>
        </>
      )}
    </MScreen>
  );
}

