// Depois da consulta: "Como foi" (anotação) e "Marcar retorno" em 1, 3, 6 ou 12 meses.
import { useState } from 'react';
import { useStore } from '../data/store';
import { novoId } from '../data/persistencia';
import { somarMeses } from '../data/formularios-puro';
import { dataBR } from '../data/format';
import { HOJE } from '../data/tempo';
import type { Consulta } from '../data/types';

const RETORNOS = [1, 3, 6, 12];

export function PosConsulta({ consulta: c, podeEditar }: { consulta: Consulta; podeEditar: boolean }) {
  const { state, api } = useStore();
  const [texto, setTexto] = useState(c.anotacaoPos ?? '');
  if (c.data > HOJE) return null;
  const retorno = state.consultas.find((x) => x.retornoDe === c.id);
  const salvarNota = () => {
    if (texto.trim() === (c.anotacaoPos ?? '')) return;
    api.editar('consultas', c.id, { anotacaoPos: texto.trim() || null }, 'Anotação salva');
  };
  const marcar = (meses: number) => {
    const id = `c-${novoId()}`;
    api.addConsulta({
      id, tipo: c.tipo, pessoaId: c.pessoaId, titulo: c.titulo, profissional: c.profissional, local: c.local,
      data: somarMeses(c.data, meses), hora: c.hora, duracaoMin: c.duracaoMin, peloPlano: c.peloPlano,
      levar: [{ item: 'Carteirinha do plano', ok: true }], lembretes: ['1 dia antes'], retornoDe: c.id,
    });
    api.toast({ texto: `Retorno marcado para ${dataBR(somarMeses(c.data, meses))} às ${c.hora}`, desfazer: () => api.remover('consultas', { id }, 'Retorno desmarcado') });
  };
  return (
    <section className="card" style={{ padding: 16, gap: 10 }}>
      <span style={{ fontWeight: 600 }}>Como foi a consulta</span>
      {podeEditar ? (
        <textarea className="input input--area" value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={salvarNota} placeholder="Diagnóstico, orientações, pedidos de exame…" />
      ) : (
        <span style={{ fontSize: 14, color: c.anotacaoPos ? undefined : 'var(--text-3)' }}>{c.anotacaoPos ?? 'Sem anotação.'}</span>
      )}
      {retorno ? (
        <span style={{ fontSize: 14, color: 'var(--teal)' }}>Retorno marcado para {dataBR(retorno.data)} às {retorno.hora}.</span>
      ) : podeEditar && (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
          <span className="muted">Marcar retorno em</span>
          {RETORNOS.map((m) => <button key={m} type="button" className="chip chip--xs" onClick={() => marcar(m)}>{m === 12 ? '1 ano' : `${m} ${m === 1 ? 'mês' : 'meses'}`}</button>)}
        </div>
      )}
    </section>
  );
}
