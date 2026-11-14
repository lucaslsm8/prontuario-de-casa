import { useMemo, useState } from 'react';
import { qtdForaDaFaixa, textoForaDaFaixa } from '../data/resultados';
import { useNavigate, useParams } from 'react-router-dom';
import { editaveis, pessoa, useStore } from '../data/store';
import { dataBR, dataCurta, diaMes, quem } from '../data/format';
import { SecaoLista } from '../ui';
import { agruparFamiliaPets } from '../data/pets';
import type { Exame } from '../data/types';
import { useAbrir } from './Shell';
import { anexosDe, exportarAnexo } from '../data/anexos';
import { AcoesRegistro } from './Acoes';
import { ResultadosExame } from '../ui/Resultados';
import { ResultadoLaudo } from '../ui/Laudo';
import { ArquivosExame } from '../ui/ArquivosExame';
import { CamposFiltroExames, ResumoFiltroExames } from '../ui/FiltroExames';
import { FILTRO_EXAMES_PADRAO, filtrarExames, filtroValido, filtrosAtivos, type FiltroExames } from '../data/exames';
import { HOJE } from '../data/tempo';

/** O filtro continua igual ao trocar de página e voltar (vale até fechar o app). */
let filtroGuardado: FiltroExames = FILTRO_EXAMES_PADRAO;

/** D03 — Exames: lista com filtro (pessoa, tipo, período, ordem) e o exame escolhido ao lado. */
export function DExames() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const abrir = useAbrir();
  const [fBruto, setFBruto] = useState(filtroGuardado);
  // A pessoa do filtro sai quando a lista não tem exame dela (perfil trocado, pessoa removida).
  const f = filtroValido(fBruto, state.exames);
  const setF = (novo: FiltroExames) => { filtroGuardado = novo; setFBruto(novo); };
  const [verFiltros, setVerFiltros] = useState(filtrosAtivos(filtroGuardado) > 0);
  const lista = useMemo(() => filtrarExames(state.exames, f, HOJE, (pid) => quem(pessoa(state, pid))), [state, f]);
  // Em ordem de data/nome, família e pets ficam em blocos separados, cada um na ordem escolhida.
  const grupos = agruparFamiliaPets(lista, state);
  const sel = state.exames.find((e) => e.id === id) ?? grupos.familia[0] ?? grupos.pets[0];
  const consulta = sel?.consultaId ? state.consultas.find((c) => c.id === sel.consultaId) : undefined;
  const arquivos = sel ? anexosDe(state.anexos, sel.id) : [];
  const podeEditar = !!sel && editaveis(state).some((p) => p.id === sel.pessoaId);
  const exportar = async () => {
    try { for (const a of arquivos) if (!(await exportarAnexo(a))) break; } catch { api.toast({ texto: 'Não foi possível exportar.' }); }
  };
  const n = filtrosAtivos(f);

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
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{quem(pessoa(state, e.pessoaId))} · {e.categoria} · {e.laboratorio}</span>
          {qtdForaDaFaixa(e) > 0 && <span className="pill pill--warn" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{textoForaDaFaixa(qtdForaDaFaixa(e))}</span>}
        </span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{dataCurta(e.dataColeta)}</span>
      </button>
    );
  };

  const meta = (k: string, v: React.ReactNode) => (
    <div className="stack" style={{ padding: '12px 14px', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', flex: 1, minHeight: 0 }}>
      <div className="stack" style={{ borderRight: '1px solid var(--border-card)', padding: '28px 24px', gap: 14, overflowY: 'auto' }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <h1 className="desk-title" style={{ margin: 0 }}>Exames</h1>
          <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('exame')}>Adicionar</button>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <input className="input input--search-desk" style={{ flex: 1, minWidth: 0 }} placeholder="Buscar exame, laboratório, médico…" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} aria-label="Buscar exames" />
          <button type="button" className={n ? 'btn btn--soft btn--h38' : 'btn btn--outline btn--h38'} style={{ flexShrink: 0 }} aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
            Filtrar{n ? ` · ${n}` : ''}
          </button>
        </div>
        {verFiltros ? (
          <div className="card" style={{ padding: 14, borderRadius: 8 }}>
            <CamposFiltroExames desktop f={f} onChange={setF} />
            {n > 0 && <button type="button" className="btn btn--link" style={{ alignSelf: 'flex-start', marginTop: 10, fontSize: 13 }} onClick={() => setF({ ...FILTRO_EXAMES_PADRAO, busca: f.busca })}>Limpar filtros</button>}
          </div>
        ) : n > 0 && <ResumoFiltroExames f={f} onChange={setF} />}
        <span className="muted" style={{ fontSize: 12 }}>{lista.length === 1 ? '1 exame' : `${lista.length} exames`}</span>
        <div className="stack" style={{ gap: 4 }}>
          {grupos.familia.map(itemExame)}
          {grupos.pets.length > 0 && <><SecaoLista rotulo="Pets" style={{ padding: '12px 12px 4px' }} />{grupos.pets.map(itemExame)}</>}
          {lista.length === 0 && <span className="muted" style={{ fontSize: 14, padding: 12 }}>{f.busca.trim() ? `Nenhum exame encontrado para “${f.busca.trim()}”.` : 'Nenhum exame com esse filtro.'}</span>}
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
              <button type="button" className="btn btn--outline btn--h38" disabled={!arquivos.length} onClick={exportar}>Exportar</button>
            </div>
          </div>
          {/* Dados do exame numa faixa; os arquivos em miniatura (clique amplia); o resto da tela fica para o resultado. */}
          <div className="card exame-meta" style={{ fontSize: 14, borderRadius: 8 }}>
            {meta('Tipo', sel.categoria)}
            {meta('Laboratório', sel.laboratorio || '—')}
            {meta('Pedido por', sel.solicitante ?? '—')}
            {meta('Consulta', consulta ? <span style={{ color: 'var(--teal)', fontWeight: 500 }}>{consulta.titulo} · {diaMes(consulta.data)}</span> : <span className="faint">Nenhuma</span>)}
          </div>
          <ArquivosExame exame={sel} podeEditar={podeEditar} />
          {sel.anotacao && (
            <div className="card" style={{ padding: '12px 14px', gap: 6, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Anotação</span>
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>{sel.anotacao}</span>
            </div>
          )}
          <div style={{ flex: 'none' }}><ResultadoLaudo key={sel.id} exame={sel} podeEditar={podeEditar} desktop /></div>
          <div className="card" style={{ borderRadius: 8, flex: 'none' }}>
            <div className="card-head"><span style={{ fontSize: 13, fontWeight: 600 }}>Valores do exame</span><span className="muted" style={{ fontSize: 12 }}>viram gráfico na aba Medições da pessoa</span></div>
            <div style={{ padding: '4px 18px 8px' }}><ResultadosExame key={sel.id} exame={sel} podeEditar={podeEditar} desktop /></div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 40 }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{state.exames.length ? 'Nenhum exame com esse filtro' : 'Nenhum exame ainda'}</span>
          <span style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 360, lineHeight: 1.5 }}>{state.exames.length ? 'Mude a busca ou limpe os filtros para ver os outros.' : 'Importe o PDF que o laboratório enviou ou a foto do laudo. Fica tudo organizado por pessoa e data.'}</span>
          {!state.exames.length && <button type="button" className="btn btn--ink btn--h40d" onClick={() => abrir('exame')}>Importar exame</button>}
        </div>
      )}
    </div>
  );
}
