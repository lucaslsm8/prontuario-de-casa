import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIAS_EXAME, useFormExame } from '../data/formularios';
import { editaveis, pessoa, useStore } from '../data/store';
import { dataBR, diaMes, mesAno, quem } from '../data/format';
import type { Exame } from '../data/types';
import { ChipGroup, Field, FieldGroup, Label, Row, SecaoLista, Thumb, TopNav, InlineInput } from '../ui';
import { agruparFamiliaPets, opcoesPessoas } from '../data/pets';
import { MScreen, TabHeader } from './Shell';
import { AnexosPendentes, GaleriaAnexos } from '../ui/Anexos';
import { anexosDe, ehPdf } from '../data/anexos';
import { ConfirmarSheet } from '../ui/Confirmar';
import { ResultadosExame } from '../ui/Resultados';

/** Agrupa por mês ("SETEMBRO 2026"), mais recentes primeiro. */
export function porMes(exames: Exame[]) {
  const m = new Map<string, Exame[]>();
  [...exames].sort((a, b) => b.dataColeta.localeCompare(a.dataColeta)).forEach((e) => {
    const k = mesAno(e.dataColeta);
    m.set(k, [...(m.get(k) ?? []), e]);
  });
  return [...m.entries()];
}

export function filtrarExames(exames: Exame[], busca: string, filtro: string, nomePessoa: (id: string) => string) {
  const q = busca.trim().toLowerCase();
  return exames.filter((e) => {
    const okFiltro = filtro === 'todos' || e.categoria === filtro || e.pessoaId === filtro;
    const okBusca = !q || [e.nome, e.laboratorio, e.solicitante, nomePessoa(e.pessoaId)].some((t) => t?.toLowerCase().includes(q));
    return okFiltro && okBusca;
  });
}

/** M08 Exames · M21 quando vazio. */
export function Exames() {
  const { state } = useStore();
  const nav = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const lista = useMemo(
    () => filtrarExames(state.exames, busca, filtro, (id) => quem(pessoa(state, id))),
    [state, busca, filtro],
  );

  if (state.exames.length === 0) return <ExamesVazio />;

  return (
    <MScreen tabs>
      <TabHeader titulo="Exames" onAdd={() => nav('/exames/novo')} />
      <input className="input input--search" placeholder="Buscar por nome, laboratório…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar exames" />
      <ChipGroup gap6 tamanho="sm" opcoes={['todos', ...CATEGORIAS_EXAME.filter((c) => state.exames.some((e) => e.categoria === c))].map((c) => ({ id: c, nome: c === 'todos' ? 'Todos' : c }))} valor={filtro} onChange={setFiltro} />
      {(() => {
        // Família por mês; depois a divisória "Pets" e os exames deles, também por mês.
        const g = agruparFamiliaPets(lista, state);
        const meses = (xs: Exame[]) => porMes(xs).map(([mes, itens]) => (
          <div key={mes} className="stack" style={{ gap: 16 }}>
            <Label>{mes}</Label>
            <div className="card">
              {itens.map((e) => (
                <button type="button" key={e.id} className="row" style={{ gap: 12, padding: '12px 14px', justifyContent: 'flex-start', width: '100%', textAlign: 'left' }} onClick={() => nav(`/exames/${e.id}`)}>
                  <MiniaturaExame exameId={e.id} arquivo={e.arquivo} />
                  <div className="stack" style={{ flex: 1, gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{e.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{quem(pessoa(state, e.pessoaId))} · {diaMes(e.dataColeta)} · {e.laboratorio}</span>
                  </div>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          </div>
        ));
        return <>{meses(g.familia)}{g.pets.length > 0 && <><SecaoLista rotulo="Pets" />{meses(g.pets)}</>}</>;
      })()}
      {lista.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', padding: 24 }}>Nenhum exame encontrado para “{busca}”.</span>}
    </MScreen>
  );
}

/** Miniatura do exame na lista: a primeira foto anexada, ou o ícone de PDF/foto. */
function MiniaturaExame({ exameId, arquivo }: { exameId: string; arquivo: string }) {
  const { state } = useStore();
  const a = anexosDe(state.anexos, exameId)[0];
  if (a && !ehPdf(a)) return <img src={a.dados} alt="" style={{ width: 44, height: 54, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-card)', flex: 'none' }} />;
  return <Thumb tipo={a ? 'PDF' : arquivo} />;
}

/** Detalhe do exame (celular): dados e os arquivos, que abrem em tela cheia. */
export function DetalheExame() {
  const { id = '' } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const [apagar, setApagar] = useState(false);
  const e = state.exames.find((x) => x.id === id);
  if (!e) return <MScreen><TopNav voltar="Exames" voltarPara="/exames" /><span className="muted">Exame não encontrado.</span></MScreen>;
  const c = e.consultaId ? state.consultas.find((x) => x.id === e.consultaId) : undefined;
  const pode = editaveis(state).some((p) => p.id === e.pessoaId);
  return (
    <MScreen gap={16}>
      <TopNav voltar="Exames" voltarPara="/exames" acao={pode ? 'Editar' : undefined} onAcao={() => nav(`/exames/${e.id}/editar`)} />
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="title title--26" style={{ margin: 0 }}>{e.nome}</h1>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{quem(pessoa(state, e.pessoaId))} · coletado em {dataBR(e.dataColeta)}</span>
      </div>
      <FieldGroup label="Arquivos">
        <GaleriaAnexos donoId={e.id} tipo="exame" podeEditar={pode} vazio="Nenhum arquivo anexado." />
      </FieldGroup>
      <div className="card" style={{ fontSize: 15 }}>
        <Row label="Categoria" valor={e.categoria} />
        <Row label="Laboratório" valor={e.laboratorio || '—'} />
        {e.solicitante && <Row label="Pedido por" valor={e.solicitante} />}
        <Row label="Consulta" valor={c ? `${c.titulo} · ${diaMes(c.data)}` : 'Nenhuma'} />
      </div>
      <FieldGroup label="Valores do exame">
        <div className="card" style={{ padding: '2px 14px' }}><ResultadosExame exame={e} podeEditar={pode} /></div>
      </FieldGroup>
      {e.anotacao && <div className="card card--pad" style={{ gap: 4 }}><Label>Anotação</Label><span style={{ fontSize: 15, lineHeight: 1.45 }}>{e.anotacao}</span></div>}
      {pode && <button type="button" className="btn btn--danger-link" style={{ marginTop: 'auto', minHeight: 44, fontSize: 15 }} onClick={() => setApagar(true)}>Apagar exame</button>}
      {apagar && (
        <ConfirmarSheet
          titulo={`Apagar ${e.nome}?`}
          texto="O exame e os arquivos dele saem do arquivo."
          confirmar="Apagar exame"
          onConfirm={() => { api.remover('exames', e, `${e.nome} apagado`); nav('/exames'); }}
          onClose={() => setApagar(false)}
        />
      )}
    </MScreen>
  );
}

/** M21 — Exames vazio. */
function ExamesVazio() {
  const nav = useNavigate();
  const folha = { position: 'absolute' as const, width: 76, height: 96, borderRadius: 6, background: '#fff', border: '1px solid var(--border-card)' };
  const linha = (w: string) => <span style={{ height: 4, width: w, borderRadius: 2, background: 'var(--segment-track)' }} />;
  return (
    <MScreen tabs pad="14px 20px 120px">
      <h1 className="title" style={{ margin: 0 }}>Exames</h1>
      <div className="stack" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '0 20px' }}>
        <div style={{ position: 'relative', width: 120, height: 110 }} aria-hidden>
          <span style={{ ...folha, left: 10, top: 8, transform: 'rotate(-8deg)' }} />
          <span style={{ ...folha, left: 34, top: 4, transform: 'rotate(5deg)', display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 10px' }}>
            {linha('70%')}{linha('90%')}{linha('50%')}
          </span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 600 }}>Nenhum exame ainda</span>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>
          Fotografe o laudo ou importe o PDF que o laboratório enviou. Fica tudo organizado por pessoa e data.
        </span>
        <div className="stack" style={{ gap: 8, width: '100%', marginTop: 8 }}>
          <button type="button" className="btn btn--ink btn--h50" onClick={() => nav('/exames/novo')}>Fotografar laudo</button>
          <button type="button" className="btn btn--outline btn--h50" onClick={() => nav('/exames/novo?pdf=1')}>Importar PDF</button>
        </div>
      </div>
    </MScreen>
  );
}

// ── M17 Adicionar exame ─────────────────────────────────────────────────────

/** /exames/:id/editar — o mesmo formulário, preenchido (os arquivos ficam no detalhe). */
export function EditarExame() {
  const { id } = useParams();
  const { state } = useStore();
  const nav = useNavigate();
  const e = state.exames.find((x) => x.id === id);
  if (!e) return <Navigate to="/exames" replace />;
  return <AdicionarExame exame={e} onDone={() => nav(`/exames/${e.id}`, { replace: true })} />;
}

export function AdicionarExame({ onDone, exame }: { onDone?: () => void; exame?: Exame }) {
  const { state } = useStore();
  const nav = useNavigate();
  const fechar = onDone ?? (() => nav('/exames'));
  const pessoas = editaveis(state);
  const { id, arquivos, setArquivos, editando, anotacao, setAnotacao, nome, setNome, de, setDe, cat, setCat, data, setData, lab, setLab, consulta, proxConsulta, valido, salvar } = useFormExame(fechar, exame);
  const c = state.consultas.find((x) => x.id === consulta);

  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" titulo={editando ? 'Editar exame' : 'Novo exame'} />
      {!editando && (
        <FieldGroup label="Fotos das páginas ou PDF">
          <AnexosPendentes donoId={id} tipo="exame" lista={arquivos} onChange={setArquivos} />
        </FieldGroup>
      )}
      <Field label="Nome do exame">
        <input className="input input--50" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </Field>
      <FieldGroup label="De quem">
        <ChipGroup largo {...opcoesPessoas(pessoas, quem)} valor={de} onChange={setDe} />
      </FieldGroup>
      <FieldGroup label="Categoria">
        <ChipGroup gap6 tom="teal" tamanho="md" opcoes={CATEGORIAS_EXAME.map((x) => ({ id: x, nome: x }))} valor={cat} onChange={setCat} />
      </FieldGroup>
      <div className="card" style={{ fontSize: 15 }}>
        <Row compact style={{ padding: '12px 16px' }} label="Data da coleta" valor={<InlineInput className="mono" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data da coleta" />} />
        <Row compact style={{ padding: '12px 16px' }} label="Laboratório" valor={<InlineInput style={{ fontWeight: 400 }} value={lab} onChange={(e) => setLab(e.target.value)} aria-label="Laboratório" />} />
        <Row
          compact
          style={{ padding: '12px 16px' }}
          label="Vincular a consulta"
          onClick={proxConsulta}
          valor={<span style={{ color: c ? 'var(--teal)' : 'var(--text-3)' }}>{c ? `${c.titulo} · ${diaMes(c.data)}` : 'Nenhuma ›'}</span>}
        />
      </div>
      <Field label="Anotação">
        <textarea className="input input--area" value={anotacao} onChange={(e) => setAnotacao(e.target.value)} placeholder="Ex.: mostrar ao cardiologista" />
      </Field>
      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!valido} onClick={salvar}>
        {editando ? 'Salvar alterações' : 'Salvar exame'}
      </button>
    </MScreen>
  );
}

