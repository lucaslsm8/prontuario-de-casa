import { useMemo, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { AVISAR, nomeAvisar, DOSES, DURACOES, FREQUENCIAS, partesDoRemedio, useFormRemedio } from '../data/formularios';
import { editaveis, historicoAdesao, pessoa, useStore, type DiaAdesao } from '../data/store';
import { addDias, descricaoDose, diaSemanaCurto, diasDeEstoque, estoqueBaixo, parseISO, pctEstoque, quem } from '../data/format';
import type { Remedio } from '../data/types';
import { Bar, ChipGroup, Field, FieldGroup, Label, Pill, Row, SecaoLista, Segmented, Toggle, TopNav, InlineInput } from '../ui';
import { agruparFamiliaPets, opcoesPessoas } from '../data/pets';
import { MScreen, TabHeader } from './Shell';
import { textoSalvar } from './Perfil';
import { AdesaoSemanal } from '../ui/Adesao';
import { AnexosPendentes, GaleriaAnexos } from '../ui/Anexos';
import { anexosDe } from '../data/anexos';
import { ConfirmarSheet } from '../ui/Confirmar';

/** Doses tomadas e previstas na grade (o que ainda vai ser tomado hoje não conta). */
export function somaAdesao(grade: DiaAdesao[]) {
  return {
    tomadas: grade.reduce((a, g) => a + Math.min(g.tomadas, g.previstas), 0),
    previstas: grade.reduce((a, g) => a + (g.estado === 'pendente' ? 0 : g.previstas), 0),
  };
}

/** Grade de adesão 7×2 da M16 (também no detalhe do remédio do desktop). */
export function GradeAdesao({ grade, className, style }: { grade: DiaAdesao[]; className?: string; style?: CSSProperties }) {
  return (
    <div className={className} style={{ ...style, display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }}>
      {grade.map((g) => (
        <div key={g.iso} className="stack" style={{ alignItems: 'center', gap: 4 }} title={{ tomada: 'Dose tomada', perdida: 'Dose perdida', pendente: 'Ainda hoje', fora: 'Fora do tratamento' }[g.estado]}>
          <span
            style={{
              width: 30, height: 30, borderRadius: 6,
              background: g.estado === 'tomada' ? 'var(--teal)' : g.estado === 'fora' ? 'var(--bg)' : '#fff',
              border: g.estado === 'perdida' ? '1.5px dashed var(--warn-bar)' : g.estado === 'pendente' ? '1.5px solid var(--teal)' : undefined,
            }}
          />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{g.iso.slice(8, 10)}</span>
        </div>
      ))}
    </div>
  );
}

/** M05 — Remédios. */
export function Remedios() {
  const { state } = useStore();
  const nav = useNavigate();
  const [aba, setAba] = useState<'uso' | 'enc'>('uso');
  const [filtro, setFiltro] = useState('todos');
  const emUso = state.remedios.filter((r) => r.ativo);
  const lista = state.remedios.filter((r) => (aba === 'uso' ? r.ativo : !r.ativo) && (filtro === 'todos' || r.pessoaId === filtro));
  const pessoasComRemedio = opcoesPessoas(state.pessoas.filter((p) => state.remedios.some((r) => r.pessoaId === p.id)), quem);
  const grupos = agruparFamiliaPets(lista, state);
  const cartao = (r: Remedio) => (aba === 'uso' ? <CartaoRemedio key={r.id} r={r} /> : <CartaoEncerrado key={r.id} r={r} />);

  return (
    <MScreen tabs>
      <TabHeader titulo="Remédios" onAdd={() => nav('/remedios/novo')} />
      <Segmented
        opcoes={[{ id: 'uso', nome: `Em uso · ${emUso.length}` }, { id: 'enc', nome: 'Encerrados' }]}
        valor={aba}
        onChange={setAba}
      />
      {pessoasComRemedio.opcoes.length > 1 && (
        <ChipGroup
          gap6
          tamanho="sm"
          opcoes={[{ id: 'todos', nome: 'Todos' }, ...pessoasComRemedio.opcoes]}
          separarAntes={pessoasComRemedio.separarAntes && pessoasComRemedio.separarAntes + 1}
          valor={filtro}
          onChange={setFiltro}
        />
      )}
      <div className="stack" style={{ gap: 10 }}>
        {grupos.familia.map(cartao)}
        {grupos.pets.length > 0 && <><SecaoLista rotulo="Pets" style={{ paddingTop: 6 }} />{grupos.pets.map(cartao)}</>}
        {lista.length === 0 && (
          <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{aba === 'uso' ? 'Nenhum remédio em uso' : 'Nada encerrado por aqui'}</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              {aba === 'uso' ? 'Cadastre o remédio e o app avisa na hora de tomar.' : 'Tratamentos encerrados aparecem aqui.'}
            </span>
            {aba === 'uso' && <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => nav('/remedios/novo')}>Cadastrar remédio</button>}
          </div>
        )}
      </div>
    </MScreen>
  );
}

function CartaoRemedio({ r }: { r: Remedio }) {
  const { state } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, r.pessoaId);
  const baixo = estoqueBaixo(r);
  const dias = diasDeEstoque(r);
  const titulo = (
    <div className="stack" style={{ gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{r.nome}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{quem(p)} · {descricaoDose(r)}</span>
    </div>
  );
  if (r.seNecessario) {
    return (
      <button type="button" className="card card--pad hstack" style={{ flexDirection: 'row', justifyContent: 'space-between', textAlign: 'left' }} onClick={() => nav(`/remedios/${r.id}`)}>
        {titulo}
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>sem horário</span>
      </button>
    );
  }
  return (
    <button type="button" className="card card--pad" style={{ gap: 10, textAlign: 'left' }} onClick={() => nav(`/remedios/${r.id}`)}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {titulo}
        {baixo && <Pill tom="warn">Repor</Pill>}
      </div>
      {dias != null && (
        <div className="hstack" style={{ gap: 10 }}>
          <Bar pct={pctEstoque(r)} baixo={baixo} />
          <span style={{ fontSize: 12, fontWeight: baixo ? 600 : 400, color: baixo ? 'var(--warn-text)' : 'var(--text-2)' }}>{dias} dias</span>
        </div>
      )}
    </button>
  );
}

function CartaoEncerrado({ r }: { r: Remedio }) {
  const { state } = useStore();
  return (
    <div className="card card--pad" style={{ gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{r.nome}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{quem(pessoa(state, r.pessoaId))} · {r.encerradoResumo}</span>
    </div>
  );
}

// ── M06 Novo remédio ────────────────────────────────────────────────────────

function Ciclo<T>({ valores, valor, onChange, render }: { valores: T[]; valor: T; onChange: (v: T) => void; render: (v: T) => string }) {
  // Seletor compacto: toca para avançar (substitui um picker nativo nesta etapa).
  return (
    <button type="button" style={{ fontWeight: 500 }} onClick={() => onChange(valores[(valores.indexOf(valor) + 1) % valores.length])}>
      {render(valor)}
    </button>
  );
}

/** /remedios/:id/editar — o mesmo formulário, preenchido. */
export function EditarRemedio() {
  const { id } = useParams();
  const { state } = useStore();
  const nav = useNavigate();
  const r = state.remedios.find((x) => x.id === id);
  if (!r) return <Navigate to="/remedios" replace />;
  return <NovoRemedio remedio={r} onDone={() => nav(`/remedios/${r.id}`, { replace: true })} />;
}

export function NovoRemedio({ onDone, remedio }: { onDone?: () => void; remedio?: Remedio }) {
  const { state } = useStore();
  const nav = useNavigate();
  const fechar = onDone ?? (() => nav('/remedios'));
  const pessoas = editaveis(state);
  const { nome, setNome, dosagem, setDosagem, indicacao, setIndicacao, para, setPara, dose, setDose, freq, setFreq, duracao, setDuracao, lembrete, setLembrete, estoque, setEstoque, avisar, setAvisar, fim, unidade, id: remId, receita, setReceita, horariosTexto, setHorariosTexto, completarHorarios, horariosValidos, editando, valido, salvar } = useFormRemedio(fechar, remedio);

  return (
    <MScreen gap={12}>
      <TopNav voltar="Cancelar" titulo={editando ? 'Editar remédio' : 'Novo remédio'} acao="Salvar" onAcao={salvar} acaoDesativada={!valido} />
      <Field label="Remédio">
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Losartana" autoFocus={!editando} />
      </Field>
      <Field label="Dosagem">
        <input className="input" value={dosagem} onChange={(e) => setDosagem(e.target.value)} placeholder="Ex.: 50 mg" />
      </Field>
      <Field label="Para que serve">
        <input className="input" value={indicacao} onChange={(e) => setIndicacao(e.target.value)} placeholder="Ex.: pressão alta" />
      </Field>
      <FieldGroup label="Para quem">
        <ChipGroup largo {...opcoesPessoas(pessoas, quem)} valor={para} onChange={setPara} />
      </FieldGroup>
      <div className="card" style={{ fontSize: 15 }}>
        <Row tight label="Dose" valor={<Ciclo valores={DOSES} valor={dose} onChange={setDose} render={(v) => v} />} />
        <Row tight label="Frequência" valor={<Ciclo valores={FREQUENCIAS} valor={freq} onChange={setFreq} render={(v) => v.nome} />} />
        {freq.horarios.length > 0 && (
          <div className="row row--tight" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <span className="row__label">Horários</span>
            <div className="hstack" style={{ gap: 8 }}>
              {freq.horarios.map((h) => <span key={h} className="time-chip">{h}</span>)}
            </div>
          </div>
        )}
        <Row
          tight
          label="Duração"
          valor={<Ciclo valores={DURACOES} valor={duracao} onChange={setDuracao} render={(v) => (v ? `${v} dias · até ${fim.slice(8, 10)}/${fim.slice(5, 7)}` : 'Uso contínuo')} />}
        />
      </div>
      <div className="card" style={{ fontSize: 15 }}>
        <Row tight mutedLabel={false} label="Lembrete no horário" valor={<Toggle on={lembrete} onChange={setLembrete} label="Lembrete no horário" />} />
        <Row
          tight
          label="Estoque atual"
          valor={
            <span style={{ fontWeight: 500 }}>
              <InlineInput inputMode="numeric" value={estoque} onChange={(e) => setEstoque(Number(e.target.value.replace(/\D/g, '')) || 0)} aria-label="Estoque atual" />{' '}
              {unidade}
            </span>
          }
        />
        <Row tight label="Avisar para repor" valor={<Ciclo valores={AVISAR} valor={avisar} onChange={setAvisar} render={nomeAvisar} />} />
      </div>
      {freq.id !== 'sn' && (
        <Field label="Horários">
          <input className="input input--mono" value={horariosTexto} onChange={(e) => setHorariosTexto(e.target.value)} onBlur={completarHorarios} placeholder="08:00, 20:00" />
          {!horariosValidos && <span style={{ fontSize: 13, color: 'var(--danger)' }}>Use HH:MM separados por vírgula.</span>}
        </Field>
      )}
      {!editando && (
        <FieldGroup label="Receita (opcional)">
          <AnexosPendentes donoId={remId} tipo="receita" lista={receita} onChange={setReceita} />
        </FieldGroup>
      )}
      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!valido} onClick={salvar}>
        {editando ? 'Salvar alterações' : textoSalvar(state, para, 'Salvar remédio')}
      </button>
    </MScreen>
  );
}

// ── M16 Detalhe do remédio ──────────────────────────────────────────────────

export function DetalheRemedio() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const r = state.remedios.find((x) => x.id === id);
  const [confirmar, setConfirmar] = useState(false);
  const [apagar, setApagar] = useState(false);

  const grade = useMemo(() => historicoAdesao(state, id ?? '', 14), [state, id]);

  if (!r) return <MScreen><TopNav voltar="Remédios" voltarPara="/remedios" /><span className="muted">Remédio não encontrado.</span></MScreen>;
  const p = pessoa(state, r.pessoaId);
  const temReceita = anexosDe(state.anexos, r.id, 'receita').length > 0;
  const podeEditar = editaveis(state).some((x) => x.id === r.pessoaId);
  const dias = diasDeEstoque(r);
  const baixo = estoqueBaixo(r);
  const acaba = dias != null ? addDias(HOJE, dias) : undefined;
  const { tomadas, previstas } = somaAdesao(grade);
  const desde = r.inicio ? parseISO(r.inicio).getFullYear() : undefined;

  return (
    <MScreen gap={16}>
      <TopNav voltar="Remédios" voltarPara="/remedios" acao={podeEditar ? 'Editar' : undefined} onAcao={() => nav(`/remedios/${r.id}/editar`)} />
      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {quem(p)} · {r.continuo ? `uso contínuo${desde ? ` desde ${desde}` : ''}` : r.seNecessario ? 'se necessário' : 'tratamento'}
        </span>
        <h1 className="title" style={{ margin: 0 }}>{r.nome}</h1>
        <span style={{ fontSize: 15, color: 'var(--text-2)' }}>
          {r.seNecessario ? 'Sem horário fixo' : `${r.doseLonga ?? r.dose} às ${r.horarios.join(', ')}${r.observacao ? `, ${r.observacao}` : ''}`}
        </span>
      </div>

      {r.estoque != null && (
        <div className="card" style={{ background: baixo ? 'var(--warn-bg)' : '#fff', borderColor: baixo ? 'transparent' : undefined, padding: '14px 16px', gap: 10 }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: baixo ? 'var(--warn-strong)' : undefined }}>Restam {r.estoque} {r.unidade}</span>
            {acaba && <span style={{ fontSize: 13, color: baixo ? 'var(--warn-text)' : 'var(--text-2)' }}>acaba {diaSemanaCurto(acaba).replace(/, 0?(\d+)\/(\d+)/, ', $1/$2')}</span>}
          </div>
          <Bar pct={pctEstoque(r)} baixo={baixo} trilhoAlerta={baixo} grossa />
          <div className="hstack" style={{ gap: 8, fontSize: 13, fontWeight: 600, color: baixo ? 'var(--warn-strong)' : 'var(--teal)' }}>
            <button type="button" className="btn btn--h36" style={{ background: baixo ? '#fff' : 'var(--teal-light)' }} onClick={() => api.comprei(r.id, 30)}>Comprei mais</button>
            <button type="button" className="btn btn--h36" onClick={() => document.getElementById('receita')?.scrollIntoView({ behavior: 'smooth' })}>{temReceita ? 'Ver receita' : 'Guardar receita'}</button>
          </div>
        </div>
      )}

      {!r.seNecessario && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <Label>Últimos 14 dias</Label>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{tomadas} de {previstas} doses</span>
          </div>
          <GradeAdesao grade={grade} className="card" style={{ padding: 14 }} />
          <AdesaoSemanal remedioId={r.id} altura={130} className="card" style={{ padding: 14 }} />
        </div>
      )}

      <div id="receita" className="stack" style={{ gap: 8 }}>
        <Label>Receita</Label>
        <GaleriaAnexos donoId={r.id} tipo="receita" podeEditar={podeEditar} vazio="Nenhuma receita guardada." />
      </div>

      <div className="card" style={{ fontSize: 14 }}>
        {r.receitadoPor && <Row compact label="Receitado por" valor={r.receitadoPor} style={{ padding: '12px 16px' }} />}
        {r.indicacao && <Row compact label="Para que serve" valor={r.indicacao} style={{ padding: '12px 16px' }} />}
        {partesDoRemedio(r)[1] && <Row compact label="Dosagem" valor={partesDoRemedio(r)[1]} style={{ padding: '12px 16px' }} />}
        <Row compact label="Lembrete" valor={r.lembrete && r.horarios.length ? `${r.horarios.join(', ')} · ativo` : 'desligado'} style={{ padding: '12px 16px' }} />
      </div>

      {podeEditar && (
        <div className="hstack" style={{ marginTop: 'auto', justifyContent: 'center', gap: 8 }}>
          {r.ativo && (
            <button type="button" className="btn btn--danger-link" style={{ fontSize: 15, minHeight: 44 }} onClick={() => setConfirmar(true)}>
              Encerrar tratamento
            </button>
          )}
          <button type="button" className="btn btn--danger-link" style={{ fontSize: 15, minHeight: 44 }} onClick={() => setApagar(true)}>
            Apagar
          </button>
        </div>
      )}
      {apagar && (
        <ConfirmarSheet
          titulo={`Apagar ${r.nome}?`}
          texto="O remédio sai da lista e os lembretes param. Para guardar o histórico, prefira “Encerrar tratamento”."
          confirmar="Apagar remédio"
          onConfirm={() => { api.remover('remedios', r, `${r.nome} apagado`); nav('/remedios'); }}
          onClose={() => setApagar(false)}
        />
      )}
      {confirmar && (
        <>
          <div className="overlay" onClick={() => setConfirmar(false)} />
          <div className="sheet" role="dialog" aria-label="Encerrar tratamento">
            <span style={{ fontSize: 18, fontWeight: 600 }}>Encerrar {r.nome}?</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>Os lembretes param. O histórico de doses continua guardado em Encerrados.</span>
            <button type="button" className="btn btn--h50" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => { api.encerrar(r.id); nav('/remedios'); }}>
              Encerrar tratamento
            </button>
            <button type="button" className="btn btn--outline btn--h50" onClick={() => setConfirmar(false)}>Cancelar</button>
          </div>
        </>
      )}
    </MScreen>
  );
}
