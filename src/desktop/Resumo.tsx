import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useVoltar } from './useVoltar';
import { editaConsulta, pessoa, useStore } from '../data/store';
import { diaMes } from '../data/format';
import { DocumentoResumo, TODAS_SECOES, secoesDoResumo, type SecaoResumo } from '../mobile/Agenda';
import { AcoesRegistro } from './Acoes';
import { PosConsulta } from '../ui/PosConsulta';

/** "← Voltar": volta no histórico do app; aberto direto, vai para a agenda. */
function Voltar() {
  const nav = useNavigate();
  const voltar = useVoltar(() => nav('/agenda'));
  return <button type="button" className="btn--link" style={{ fontSize: 14, height: 38 }} onClick={voltar}>← Voltar</button>;
}

/** Caixa de seleção no estilo do app (a mesma do diálogo de atualização). */
function Caixa({ on, rotulo, onChange }: { on: boolean; rotulo: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className="resumo-itens__linha" onClick={() => onChange(!on)}>
      <span className="resumo-itens__caixa" data-on={on || undefined}>{on ? '✓' : ''}</span>
      {rotulo}
    </button>
  );
}

/** Resumo para consulta (M19 no desktop): barra + documento de 760 px. */
export function DResumo() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const c = state.consultas.find((x) => x.id === id);
  const p = c ? pessoa(state, c.pessoaId) : undefined;
  const [incluir, setIncluir] = useState<Record<SecaoResumo, boolean>>(TODAS_SECOES);
  const [escolher, setEscolher] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // A lista de itens fecha com Esc ou clique fora dela.
  useEffect(() => {
    if (!escolher) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setEscolher(false); };
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setEscolher(false); };
    window.addEventListener('keydown', tecla);
    window.addEventListener('mousedown', fora);
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('mousedown', fora); };
  }, [escolher]);

  if (!c || !p) {
    return (
      <div className="desk__page" style={{ alignItems: 'flex-start' }}>
        <Voltar />
        <span className="muted">Consulta não encontrada.</span>
      </div>
    );
  }

  return (
    <div className="desk__page" style={{ gap: 24 }}>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <Voltar />
        <div className="hstack" style={{ gap: 8 }}>
          <AcoesRegistro
            podeEditar={editaConsulta(state, c.pessoaId)}
            editar={`editar-consulta:${c.id}`}
            apagar={{
              titulo: `Apagar ${c.titulo} de ${diaMes(c.data)}?`,
              texto: 'A consulta sai da agenda e os lembretes dela param. Se foi engano, use “Desfazer” no aviso.',
              onConfirm: () => { api.remover('consultas', c, `${c.titulo} apagado`); nav('/agenda'); },
            }}
          />
          <div ref={caixa} style={{ position: 'relative' }}>
            <button type="button" className="btn btn--outline btn--h38" aria-haspopup="dialog" aria-expanded={escolher} onClick={() => setEscolher((v) => !v)}>Escolher itens</button>
            {escolher && (
              <div className="card resumo-itens" role="dialog" aria-label="Escolher itens">
                <span className="label" style={{ padding: '6px 10px 8px' }}>O que entra no resumo</span>
                {secoesDoResumo(p).map((s) => <Caixa key={s.id} on={incluir[s.id]} rotulo={s.nome} onChange={(v) => setIncluir({ ...incluir, [s.id]: v })} />)}
              </div>
            )}
          </div>
          <button type="button" className="btn btn--ink btn--h38" onClick={() => window.print()}>Exportar PDF</button>
        </div>
      </div>

      <div className="stack" style={{ width: '100%', maxWidth: 760, margin: '0 auto', gap: 16 }}>
        <PosConsulta key={c.id} consulta={c} podeEditar={editaConsulta(state, c.pessoaId)} />
        <DocumentoResumo
          consulta={c}
          incluir={incluir}
          grande
          className="resumo-doc"
          style={{ flex: 'none', padding: 40, gap: 18 }}
          titulo={
            <div className="stack" style={{ gap: 4 }}>
              <h1 className="desk-title" style={{ margin: 0 }}>Resumo para o {c.titulo.toLowerCase()}</h1>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{p.curto} · consulta de {diaMes(c.data)}</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
