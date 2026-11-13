import { useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { dataBR, numCurto } from '../data/format';
import { HOJE } from '../data/tempo';
import type { Remedio } from '../data/types';
import { useLayout } from '../layout';
import { DConfirmar } from '../desktop/Formulario';
import { Label } from '.';

/** Pergunta curta: folha no celular, diálogo no desktop. */
function Pergunta({ titulo, texto, confirmar, valido, onConfirm, onClose, children }: {
  titulo: string; texto: string; confirmar: string; valido: boolean; onConfirm: () => void; onClose: () => void; children: ReactNode;
}) {
  const { layout } = useLayout();
  const enviar = () => { if (valido) onConfirm(); };
  const corpo = (
    <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); enviar(); }}>
      <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>{texto}</span>
      {children}
    </form>
  );
  if (layout === 'desktop') {
    return <DConfirmar titulo={titulo} texto={corpo} confirmar={confirmar} desativado={!valido} onConfirm={enviar} onClose={onClose} />;
  }
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{titulo}</span>
        {corpo}
        <button type="button" className="btn btn--cta btn--h50" disabled={!valido} onClick={enviar}>{confirmar}</button>
        <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>
      </div>
    </>
  );
}

/** "Comprei mais": pergunta quantas unidades entraram (sugere a última compra). */
export function CompreiMais({ r, className, style }: { r: Remedio; className?: string; style?: CSSProperties }) {
  const { api } = useStore();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const qtd = Number(texto.replace(',', '.'));
  const valido = Number.isFinite(qtd) && qtd > 0 && qtd <= 10000;
  const abrir = () => { setTexto(String(r.ultimaCompra ?? 30).replace('.', ',')); setAberto(true); };
  return (
    <>
      <button type="button" className={className} style={style} onClick={abrir}>Comprei mais</button>
      {aberto && (
        <Pergunta
          titulo={`Comprei mais ${r.nome}`}
          texto={`Quantos ${r.unidade} entraram? Hoje restam ${numCurto(r.estoque ?? 0)}.`}
          confirmar="Somar ao estoque"
          valido={valido}
          onConfirm={() => { api.comprei(r.id, qtd); setAberto(false); }}
          onClose={() => setAberto(false)}
        >
          <span className="hstack" style={{ gap: 8, alignItems: 'center' }}>
            <input
              className="input input--mono"
              style={{ width: 110 }}
              inputMode="decimal"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d,.]/g, ''))}
              aria-label={`Quantidade de ${r.unidade}`}
            />
            <span style={{ fontSize: 15 }}>{r.unidade}</span>
          </span>
        </Pergunta>
      )}
    </>
  );
}

/** Remédio "se necessário": botão "Tomei agora" (com o motivo) e as últimas vezes. */
export function DosesSeNecessario({ r, podeEditar, botao }: { r: Remedio; podeEditar: boolean; botao: string }) {
  const { state, api } = useStore();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const doses = state.doses.filter((d) => d.remedioId === r.id && d.status === 'tomada').sort((a, b) => b.previstoPara.localeCompare(a.previstoPara));
  // Motivos já usados neste remédio, para tocar em vez de digitar.
  const motivos = [...new Set(doses.map((d) => d.motivo).filter((m): m is string => !!m))].slice(0, 4);
  const quando = (iso: string) => (iso.slice(0, 10) === HOJE ? 'Hoje' : dataBR(iso.slice(0, 10)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>Quando tomou</Label>
        {podeEditar && r.ativo && <button type="button" className={botao} onClick={() => { setMotivo(''); setAberto(true); }}>Tomei agora</button>}
      </div>
      <div className="card" style={{ fontSize: 14 }}>
        {doses.length === 0 && <span style={{ padding: '12px 16px', color: 'var(--text-2)' }}>Nenhuma dose registrada.</span>}
        {doses.slice(0, 8).map((d) => (
          <div key={`${d.previstoPara}-${d.registradoEm}`} className="row row--tight" style={{ padding: '12px 16px' }}>
            <span className="row__label">{quando(d.previstoPara)} · {d.registradoEm}</span>
            <span>{d.motivo ?? '—'}</span>
          </div>
        ))}
      </div>
      {aberto && (
        <Pergunta
          titulo={`Tomei ${r.nome}`}
          texto={`${r.doseLonga ?? r.dose} agora. Por que tomou? (opcional)`}
          confirmar="Registrar dose"
          valido
          onConfirm={() => { api.tomeiAgora(r.id, motivo); setAberto(false); }}
          onClose={() => setAberto(false)}
        >
          <input className="input" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: dor de cabeça, febre" aria-label="Motivo" />
          {motivos.length > 0 && (
            <span className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
              {motivos.map((m) => <button key={m} type="button" className="chip chip--sm" onClick={() => setMotivo(m)}>{m}</button>)}
            </span>
          )}
        </Pergunta>
      )}
    </div>
  );
}
