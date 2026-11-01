import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { editaveis, pessoa, useStore } from '../data/store';
import { dataBR, dataCurta, diaMes, quem } from '../data/format';
import { ChipGroup, SecaoLista } from '../ui';
import { agruparFamiliaPets, opcoesPessoas } from '../data/pets';
import type { Exame } from '../data/types';
import { filtrarExames } from '../mobile/Exames';
import { useAbrir } from './Shell';
import { CATEGORIAS_EXAME } from '../data/formularios-puro';
import { anexosDe, ehPdf, exportarAnexo } from '../data/anexos';
import { GaleriaAnexos, Miniatura, Visualizador } from '../ui/Anexos';
import { AcoesRegistro } from './Acoes';
import { ResultadosExame } from '../ui/Resultados';

/** D03 — Exames (lista + visualização). */
export function DExames() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const abrir = useAbrir();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const lista = useMemo(() => filtrarExames(state.exames, busca, filtro, (pid) => quem(pessoa(state, pid))), [state, busca, filtro]);
  const grupos = agruparFamiliaPets(lista, state);
  const sel = state.exames.find((e) => e.id === id) ?? grupos.familia[0] ?? grupos.pets[0];
  const pessoasFiltro = opcoesPessoas(state.pessoas.filter((p) => state.exames.some((e) => e.pessoaId === p.id)), quem);
  const consulta = sel?.consultaId ? state.consultas.find((c) => c.id === sel.consultaId) : undefined;
  const arquivos = sel ? anexosDe(state.anexos, sel.id) : [];
  const podeEditar = !!sel && editaveis(state).some((p) => p.id === sel.pessoaId);
  const [visor, setVisor] = useState<number | null>(null);
  const exportar = async () => {
    try { for (const a of arquivos) if (!(await exportarAnexo(a))) break; } catch { api.toast({ texto: 'Não foi possível exportar.' }); }
  };

  const itemExame = (e: Exame) => {
    const on = sel?.id === e.id;
    return (
      <button
        type="button"
        key={e.id}
        onClick={() => nav(`/exames/${e.id}`, { replace: true })}
        className="hstack"
        style={{ gap: 12, padding: 12, borderRadius: 6, background: on ? '#fff' : undefined, border: on ? '1.5px solid var(--teal)' : '1.5px solid transparent', textAlign: 'left', transition: 'background 150ms' }}
      >
        <span className="stack" style={{ flex: 1, gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{e.nome}</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{quem(pessoa(state, e.pessoaId))} · {e.laboratorio}</span>
        </span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{dataCurta(e.dataColeta)}</span>
      </button>
    );
  };

  const meta = (k: string, v: React.ReactNode, ultimo?: boolean) => (
    <div className="stack" style={{ padding: '12px 14px', gap: 2, borderBottom: ultimo ? undefined : '1px solid var(--divider)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', flex: 1, minHeight: 0 }}>
      <div className="stack" style={{ borderRight: '1px solid var(--border-card)', padding: '28px 24px', gap: 16, overflowY: 'auto' }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <h1 className="desk-title" style={{ margin: 0 }}>Exames</h1>
          <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('exame')}>Adicionar</button>
        </div>
        <input className="input input--search-desk" placeholder="Buscar exame, laboratório, médico…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar exames" />
        <ChipGroup
          gap6
          tamanho="xs"
          opcoes={[{ id: 'todos', nome: 'Todos' }, ...pessoasFiltro.opcoes, ...CATEGORIAS_EXAME.filter((c) => state.exames.some((e) => e.categoria === c)).map((c) => ({ id: c, nome: c }))]}
          separarAntes={pessoasFiltro.separarAntes && pessoasFiltro.separarAntes + 1}
          valor={filtro}
          onChange={setFiltro}
        />
        <div className="stack" style={{ gap: 4 }}>
          {grupos.familia.map(itemExame)}
          {grupos.pets.length > 0 && <><SecaoLista rotulo="Pets" style={{ padding: '12px 12px 4px' }} />{grupos.pets.map(itemExame)}</>}
          {lista.length === 0 && <span className="muted" style={{ fontSize: 14, padding: 12 }}>Nenhum exame encontrado.</span>}
        </div>
      </div>

      {sel ? (
        <div className="stack" style={{ padding: '28px 32px', gap: 18, minHeight: 0, overflowY: 'auto' }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{sel.nome}</span>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{pessoa(state, sel.pessoaId)?.curto} · coletado em {dataBR(sel.dataColeta)}</span>
            </div>
            <div className="hstack" style={{ gap: 8 }}>
              <AcoesRegistro
                podeEditar={podeEditar}
                editar={`editar-exame:${sel.id}`}
                apagar={{
                  titulo: `Apagar ${sel.nome}?`,
                  texto: 'O exame e os arquivos dele saem do arquivo. Se foi engano, use “Desfazer” no aviso.',
                  onConfirm: () => { api.remover('exames', sel, `${sel.nome} apagado`); nav('/exames', { replace: true }); },
                }}
              />
              <button type="button" className="btn btn--outline btn--h38" disabled={!arquivos.length} onClick={() => setVisor(0)}>Abrir {arquivos[0] && ehPdf(arquivos[0]) ? 'PDF' : arquivos.length > 1 ? 'páginas' : 'foto'}</button>
              <button type="button" className="btn btn--outline btn--h38" disabled={!arquivos.length} onClick={exportar}>Exportar</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 20, flex: 'none', minHeight: 360 }}>
            <div className="stack" style={{ gap: 12, minHeight: 0 }}>
              {arquivos[0] ? (
                <div style={{ flex: 1, minHeight: 320 }}><Miniatura grande anexo={arquivos[0]} onClick={() => setVisor(0)} /></div>
              ) : (
                <div className="ph" style={{ flex: 1, borderRadius: 8, border: '1px dashed var(--border-input)', background: 'var(--placeholder-soft)', fontSize: 13, color: 'var(--text-2)' }}>
                  Nenhum arquivo anexado a este exame.
                </div>
              )}
              <GaleriaAnexos key={sel.id} donoId={sel.id} tipo="exame" podeEditar={podeEditar} />
            </div>
            <div className="stack" style={{ gap: 14 }}>
              <div className="card" style={{ fontSize: 14, borderRadius: 8 }}>
                {meta('Laboratório', sel.laboratorio)}
                {meta('Pedido por', sel.solicitante ?? '—')}
                {meta('Categoria', sel.categoria)}
                {meta('Vinculado à consulta', consulta ? <span style={{ color: 'var(--teal)', fontWeight: 500 }}>{consulta.titulo} · {diaMes(consulta.data)}</span> : <span className="faint">Nenhuma</span>, true)}
              </div>
              <div className="card" style={{ padding: '12px 14px', gap: 6, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Anotação</span>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: sel.anotacao ? undefined : 'var(--text-3)' }}>{sel.anotacao ?? 'Sem anotação.'}</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ borderRadius: 8, flex: 'none' }}>
            <div className="card-head"><span style={{ fontSize: 13, fontWeight: 600 }}>Valores do exame</span><span className="muted" style={{ fontSize: 12 }}>viram gráfico na aba Medições da pessoa</span></div>
            <div style={{ padding: '4px 18px 8px' }}><ResultadosExame key={sel.id} exame={sel} podeEditar={podeEditar} /></div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 40 }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>Nenhum exame ainda</span>
          <span style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 360, lineHeight: 1.5 }}>Importe o PDF que o laboratório enviou ou a foto do laudo. Fica tudo organizado por pessoa e data.</span>
          <button type="button" className="btn btn--ink btn--h40d" onClick={() => abrir('exame')}>Importar exame</button>
        </div>
      )}
      {visor != null && arquivos.length > 0 && <Visualizador key={sel?.id} anexos={arquivos} inicio={visor} onClose={() => setVisor(null)} />}
    </div>
  );
}
