import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoa, useStore } from '../data/store';
import { HOJE } from '../data/tempo';
import { diaSemanaSigla, parseISO, quem } from '../data/format';
import { distancia, filtrarConsultas, porMesConsultas, type Quando, type TipoFiltro } from '../data/consultas';
import { opcoesPessoas } from '../data/pets';
import { Avatar, ChipGroup, Segmented } from '../ui';
import type { Consulta } from '../data/types';
import { useAbrir } from './Shell';

const COLS = '104px 52px 150px minmax(0,1.6fr) minmax(0,1.2fr) 120px';

/** Consultas — todas as consultas e exames marcados da família, em lista, com filtro (a Agenda é o calendário). */
export function DConsultas() {
  const { state } = useStore();
  const nav = useNavigate();
  const abrir = useAbrir();
  const [quando, setQuando] = useState<Quando>('proximas');
  const [quemFiltro, setQuem] = useState('todos');
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [busca, setBusca] = useState('');
  const nome = (id: string) => quem(pessoa(state, id));
  const lista = useMemo(
    () => filtrarConsultas(state.consultas, { quando, pessoa: quemFiltro, tipo, busca }, HOJE, (id) => pessoa(state, id)?.nome ?? ''),
    [state, quando, quemFiltro, tipo, busca],
  );
  const comConsulta = state.pessoas.filter((p) => state.consultas.some((c) => c.pessoaId === p.id));
  const pessoas = opcoesPessoas(comConsulta, quem);
  const futuras = state.consultas.filter((c) => c.data >= HOJE).length;

  const abrirConsulta = (c: Consulta) => (c.tipo === 'consulta' ? nav(`/consulta/${c.id}/resumo`) : abrir(`editar-consulta:${c.id}`));
  const situacao = (c: Consulta) => {
    if (c.data >= HOJE) return <span className={c.data === HOJE ? 'consultas__hoje' : 'muted'}>{distancia(c.data, HOJE)}</span>;
    if (c.tipo === 'exame') return <span className="faint">{distancia(c.data, HOJE)}</span>;
    return c.anotacaoPos ? <span style={{ color: 'var(--teal)', fontWeight: 500 }}>anotada</span> : <span className="faint">sem anotação</span>;
  };

  return (
    <div className="desk__page" style={{ gap: 18 }}>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="desk-title" style={{ margin: 0 }}>Consultas</h1>
          <span className="muted" style={{ fontSize: 14 }}>{futuras ? `${futuras} ${futuras === 1 ? 'marcada' : 'marcadas'} daqui pra frente, de toda a família` : 'Nada marcado daqui pra frente'}</span>
        </div>
        <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir('consulta')}>Nova consulta</button>
      </div>

      <div className="hstack" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Segmented variante="desk" opcoes={[{ id: 'proximas', nome: 'Próximas' }, { id: 'passadas', nome: 'Passadas' }, { id: 'todas', nome: 'Todas' }]} valor={quando} onChange={setQuando} />
        <Segmented variante="desk" opcoes={[{ id: 'todos', nome: 'Tudo' }, { id: 'consulta', nome: 'Consultas' }, { id: 'exame', nome: 'Exames' }]} valor={tipo} onChange={setTipo} />
        <input className="input input--search-desk" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar especialidade, médico, local…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar consultas" />
      </div>
      {pessoas.opcoes.length > 1 && (
        <ChipGroup gap6 tamanho="xs" opcoes={[{ id: 'todos', nome: 'Todos' }, ...pessoas.opcoes]} separarAntes={pessoas.separarAntes && pessoas.separarAntes + 1} valor={quemFiltro} onChange={setQuem} />
      )}

      <div className="card" style={{ fontSize: 14 }}>
        <div className="consultas__linha consultas__cab" style={{ gridTemplateColumns: COLS }}>
          <span>Data</span><span>Hora</span><span>Quem</span><span>Consulta</span><span>Local</span><span>Situação</span>
        </div>
        {porMesConsultas(lista).map(([mes, itens]) => (
          <div key={mes}>
            <div className="consultas__mes mono">{mes}</div>
            {itens.map((c) => {
              const p = pessoa(state, c.pessoaId);
              return (
                <button type="button" key={c.id} className="consultas__linha" style={{ gridTemplateColumns: COLS }} onClick={() => abrirConsulta(c)}>
                  <span className="mono">{c.data.slice(8, 10)}/{c.data.slice(5, 7)} · {diaSemanaSigla(parseISO(c.data)).toLowerCase()}</span>
                  <span className="mono">{c.hora}</span>
                  <span className="hstack" style={{ gap: 8, minWidth: 0 }}>{p && <Avatar pessoa={p} size={26} font={11} />}<span className="consultas__corte">{nome(c.pessoaId)}</span></span>
                  <span className="stack" style={{ minWidth: 0 }}>
                    <span className="consultas__corte" style={{ fontWeight: 600 }}>{c.tipo === 'exame' && <span className="consultas__tag">Exame</span>}{c.titulo}</span>
                    {c.profissional && <span className="consultas__corte muted" style={{ fontSize: 12 }}>{c.profissional}</span>}
                  </span>
                  <span className="consultas__corte muted">{c.local ?? '—'}</span>
                  <span>{situacao(c)}</span>
                </button>
              );
            })}
          </div>
        ))}
        {lista.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center' }} className="muted">
            {busca ? `Nenhuma consulta encontrada para “${busca}”.` : quando === 'passadas' ? 'Nenhuma consulta passada com esse filtro.' : 'Nenhuma consulta marcada com esse filtro.'}
          </div>
        )}
      </div>
    </div>
  );
}
