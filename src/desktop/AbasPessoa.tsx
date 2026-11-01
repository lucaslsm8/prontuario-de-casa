import { Link } from 'react-router-dom';
import { adesao, useStore } from '../data/store';
import { dataBR, diaMes, diasDeEstoque } from '../data/format';
import { Label, cx, reticencias } from '../ui';

// Peças do perfil (D02) usadas pelas pessoas e pelos pets.

export { reticencias };

/** `subTexto`: linha de baixo em texto comum (não mono). `valorMono`: número longo (microchip) em mono, menor. */
export function Stat({ rotulo, valor, sub, subTexto, alerta, valorMono }: { rotulo: string; valor: string; sub?: React.ReactNode; subTexto?: boolean; alerta?: boolean; valorMono?: boolean }) {
  return (
    <div className={cx('stat', alerta && 'stat--warn')} style={{ minWidth: 0 }}>
      <span className="stat__label" style={alerta ? { color: 'var(--warn-text)', fontWeight: 600 } : undefined}>{rotulo}</span>
      <span className={valorMono ? 'mono' : undefined} style={{ fontSize: 24, fontWeight: 600, color: alerta ? 'var(--warn-strong)' : undefined, ...(valorMono && { fontSize: 17, fontWeight: 500, lineHeight: '31px' }), ...reticencias }} title={valor}>{valor}</span>
      {sub && <span className={subTexto ? undefined : 'mono'} style={{ fontSize: 12, color: 'var(--text-2)', ...reticencias }}>{sub}</span>}
    </div>
  );
}

export function ListaCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-head"><Label>{titulo}</Label></div>
      {children}
    </div>
  );
}
export const linha = { padding: '12px 18px', display: 'flex', justifyContent: 'space-between', fontSize: 14 } as const;

/** Card "Remédios em uso" (aba Perfil das pessoas e Resumo dos pets). */
export function CardRemediosEmUso({ id }: { id: string }) {
  const { state } = useStore();
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === id);
  return (
    <ListaCard titulo="Remédios em uso">
      {remedios.map((r) => (
        <div key={r.id} className="stack" style={{ padding: '12px 18px', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{r.nome}</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {r.seNecessario ? 'se necessário' : r.horarios.join(', ')}{diasDeEstoque(r) != null ? ` · ${diasDeEstoque(r)} dias de estoque` : ''}
          </span>
        </div>
      ))}
      {remedios.length === 0 && <div style={linha} className="muted">Nenhum remédio em uso.</div>}
    </ListaCard>
  );
}

export function AbaRemedios({ id }: { id: string }) {
  const { state } = useStore();
  const lista = state.remedios.filter((r) => r.pessoaId === id);
  return (
    <div className="card" style={{ fontSize: 14 }}>
      {lista.map((r) => (
        <div key={r.id} className="row" style={{ padding: '14px 20px' }}>
          <span className="stack" style={{ gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600, color: r.ativo ? undefined : 'var(--text-3)' }}>{r.nome}</span><span className="muted" style={{ fontSize: 12 }}>{r.ativo ? (r.seNecessario ? 'se necessário' : `${r.dose} · ${r.horarios.join(', ')}`) : r.encerradoResumo}</span></span>
          <span className="muted">{r.ativo ? (adesao(state, r.id) != null ? `${adesao(state, r.id)}% em 30 d` : '') : 'encerrado'}</span>
        </div>
      ))}
      {lista.length === 0 && <div className="row muted">Nenhum remédio registrado.</div>}
    </div>
  );
}

export function AbaConsultas({ id }: { id: string }) {
  const { state } = useStore();
  const lista = state.consultas.filter((c) => c.pessoaId === id);
  return (
    <div className="card" style={{ fontSize: 14 }}>
      {lista.map((c) => (
        <div key={c.id} className="row" style={{ padding: '14px 20px', justifyContent: 'flex-start', gap: 16 }}>
          <span className="mono" style={{ width: 90 }}>{diaMes(c.data)} {c.hora}</span>
          <span className="stack" style={{ gap: 2, flex: 1 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{c.titulo}</span><span className="muted" style={{ fontSize: 12 }}>{[c.profissional, c.local].filter(Boolean).join(' · ')}</span></span>
          <Link to={`/agenda`} style={{ fontWeight: 600 }}>Agenda</Link>
        </div>
      ))}
      {lista.length === 0 && <div className="row muted">Nenhuma consulta marcada.</div>}
    </div>
  );
}

export function AbaExames({ id }: { id: string }) {
  const { state } = useStore();
  const lista = state.exames.filter((e) => e.pessoaId === id);
  return (
    <div className="card" style={{ fontSize: 14 }}>
      {lista.map((e) => (
        <Link key={e.id} to={`/exames/${e.id}`} className="row" style={{ padding: '14px 20px', color: 'inherit' }}>
          <span className="stack" style={{ gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{e.nome}</span><span className="muted" style={{ fontSize: 12 }}>{e.laboratorio}</span></span>
          <span className="mono muted" style={{ fontSize: 12 }}>{dataBR(e.dataColeta)}</span>
        </Link>
      ))}
      {lista.length === 0 && <div className="row muted">Nenhum exame arquivado.</div>}
    </div>
  );
}
