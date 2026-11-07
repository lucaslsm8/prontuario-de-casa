import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { compartilhado, editaveis, eu, pessoa, podeVer, useStore } from '../data/store';
import { ehPet } from '../data/pets';
import { dataBR, diaMes, diaSemanaCurto, idade, numBR, numCurto, quem } from '../data/format';
import type { Categoria, Pessoa } from '../data/types';
import { Label } from '../ui';
import { FotoDoPerfil } from '../ui/Foto';
import { useAbrir } from './Shell';
import { AbaConsultas, AbaExames, AbaRemedios, CardRemediosEmUso, ListaCard, Stat, linha } from './AbasPessoa';
import { AbaProcedimentos, DPet } from './Pet';
import { CartaoMedicao, tiposVisiveis } from '../ui/Medicoes';
import { RemoverPessoaDesktop } from './Acoes';
import { CartaoMarcador } from '../ui/Resultados';
import { marcadoresDaPessoa } from '../data/resultados';
import { LinhaDoTempo } from '../ui/Busca';
import { linhaDoTempo } from '../data/busca';

type Aba = Categoria | 'medicoes' | 'vacinas' | 'procedimentos' | 'historico';
/** Medições seguem a permissão do perfil. */
const ABAS: { id: Aba; nome: string; cat: Categoria }[] = [
  { id: 'perfil', nome: 'Perfil clínico', cat: 'perfil' },
  { id: 'medicoes', nome: 'Medições', cat: 'perfil' },
  { id: 'vacinas', nome: 'Vacinas', cat: 'perfil' },
  { id: 'procedimentos', nome: 'Procedimentos', cat: 'perfil' },
  { id: 'historico', nome: 'Histórico', cat: 'perfil' },
  { id: 'remedios', nome: 'Remédios', cat: 'remedios' },
  { id: 'consultas', nome: 'Consultas', cat: 'consultas' },
  { id: 'exames', nome: 'Exames', cat: 'exames' },
  { id: 'plano', nome: 'Plano', cat: 'plano' },
];

/** /pessoa/:id — D02 para as pessoas, perfil do pet para os pets. */
export function DPessoa() {
  const { id } = useParams();
  const { state } = useStore();
  const p = pessoa(state, id ?? '');
  if (p && ehPet(p)) return <DPet key={p.id} pet={p} />;
  return <DMembro id={id ?? ''} />;
}

/** D02 — Perfil clínico (e demais abas do membro). */
function DMembro({ id }: { id: string }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const p = pessoa(state, id);
  const abas = ABAS.filter((a) => p && podeVer(state, p.id, a.cat));
  const [aba, setAba] = useState<Aba>(abas[0]?.id ?? 'perfil');
  if (!p) return <div className="desk__page"><span className="muted">Pessoa não encontrada.</span></div>;
  const ativa = abas.some((a) => a.id === aba) ? aba : abas[0]?.id;

  const cats = compartilhado(state, p.id, eu(state).id);
  const podeEditar = editaveis(state).some((x) => x.id === p.id);
  const sub = [
    p.sexo,
    idade(p) != null && `${idade(p)} anos`,
    p.nascimento && `nasc. ${dataBR(p.nascimento)}`,
    p.parentesco,
    p.souEu ? 'você' : cats.length === 5 ? 'compartilha tudo com você' : 'compartilha parte com você',
  ].filter(Boolean).join(' · ');

  return (
    <div className="desk__page desk__page--home" style={{ gap: 22 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="hstack" style={{ gap: 16 }}>
          <FotoDoPerfil pessoa={p} tamanho={88} podeEditar={podeEditar} />
          <div className="stack" style={{ gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em' }}>{p.nome}</h1>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{sub}</span>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          {podeVer(state, p.id, 'perfil') && <button type="button" className="btn btn--outline btn--h40d" onClick={() => abrir(`emergencia:${p.id}`)}>Ficha de emergência</button>}
          {podeEditar && <RemoverPessoaDesktop p={p} />}
          {podeEditar && <button type="button" className="btn btn--teal btn--h40d" onClick={() => abrir(`perfil:${p.id}`)}>Editar perfil</button>}
        </div>
      </div>

      {podeVer(state, p.id, 'perfil') && <Indicadores p={p} />}

      <div className="hstack" style={{ gap: 24, fontSize: 14, fontWeight: 600, borderBottom: '1px solid var(--border-card)' }} role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={ativa === a.id}
            onClick={() => setAba(a.id)}
            style={{ paddingBottom: 12, borderBottom: ativa === a.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1, color: ativa === a.id ? undefined : 'var(--text-2)', transition: 'color 180ms' }}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {ativa === 'perfil' && <AbaPerfil id={p.id} />}
      {ativa === 'medicoes' && <AbaMedicoes id={p.id} podeEditar={podeEditar} />}
      {ativa === 'vacinas' && <AbaVacinasPessoa id={p.id} podeEditar={podeEditar} />}
      {ativa === 'procedimentos' && <AbaProcedimentos id={p.id} podeEditar={podeEditar} />}
      {ativa === 'historico' && (
        <div className="card" style={{ padding: '18px 22px' }}>
          <LinhaDoTempo desktop eventos={linhaDoTempo(state, p.id, (c) => podeVer(state, p.id, c), HOJE)} />
        </div>
      )}
      {ativa === 'remedios' && <AbaRemedios id={p.id} />}
      {ativa === 'consultas' && <AbaConsultas id={p.id} />}
      {ativa === 'exames' && <AbaExames id={p.id} />}
      {ativa === 'plano' && <AbaPlano id={p.id} />}
    </div>
  );
}

/** Faixa do cabeçalho: sangue · peso · altura · (pressão, se houver) · alergias · contato de emergência. */
function Indicadores({ p }: { p: Pessoa }) {
  const [primeira, ...outras] = p.alergias;
  const contato = p.contatoEmergencia;
  const colunas = p.pressao ? 6 : 5;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas},minmax(0,1fr))`, gap: 12 }}>
      <Stat rotulo="Tipo sanguíneo" valor={p.sangue ?? '—'} />
      <Stat rotulo="Peso" valor={p.peso ? `${numCurto(p.peso)} kg` : '—'} />
      <Stat rotulo="Altura" valor={p.altura ? `${numBR(p.altura)} m` : '—'} />
      {p.pressao && <Stat rotulo="Pressão" valor={p.pressao.valor} sub={`medida em ${diaMes(p.pressao.data)}`} subTexto />}
      {primeira
        ? <Stat rotulo="Alergias" valor={`${primeira.substancia}${outras.length ? ` +${outras.length}` : ''}`} alerta />
        : <Stat rotulo="Alergias" valor="Nenhuma" />}
      <Stat rotulo="Contato de emergência" valor={contato?.nome ?? '—'} subTexto sub={contato && (contato.relacao || contato.telefone) ? <>{contato.relacao}{contato.relacao && contato.telefone && ' · '}{contato.telefone && <span className="mono">{contato.telefone}</span>}</> : undefined} />
    </div>
  );
}

function AbaPerfil({ id }: { id: string }) {
  const { state } = useStore();
  const p = pessoa(state, id)!;
  const exames = state.exames.filter((e) => e.pessoaId === id).slice(0, 3);
  const prox = state.consultas.find((c) => c.pessoaId === id && c.data >= HOJE && c.tipo === 'consulta');
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <ListaCard titulo="Condições">
          {p.condicoes.map((c) => <div key={c.nome} style={linha}><span>{c.nome}</span><span className="faint">{c.desde}</span></div>)}
          {p.condicoes.length === 0 && <div style={linha} className="muted">Nada registrado.</div>}
        </ListaCard>
        <CardRemediosEmUso id={id} />
        <ListaCard titulo="Exames recentes">
          {exames.map((e) => <div key={e.id} style={linha}><span>{e.nome}</span><span className="faint">{diaMes(e.dataColeta)}</span></div>)}
          {exames.length === 0 && <div style={linha} className="muted">Nenhum exame.</div>}
        </ListaCard>
      </div>
      {prox && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 20, padding: '16px 18px', fontSize: 14 }}>
          <Label>Próxima</Label>
          <span style={{ fontWeight: 600 }}>{prox.titulo}{prox.profissional ? ` · ${prox.profissional}` : ''}</span>
          <span className="muted">{diaSemanaCurto(prox.data)} às {prox.hora}{prox.local ? ` · ${prox.local}` : ''}</span>
          <span className="hstack" style={{ marginLeft: 'auto', gap: 16 }}>
            <Link to="/agenda" style={{ fontWeight: 600 }}>Ver na agenda</Link>
            <Link to={`/consulta/${prox.id}/resumo`} className="btn btn--outline btn--h36">Resumo para consulta</Link>
          </span>
        </div>
      )}
    </>
  );
}

function AbaMedicoes({ id, podeEditar }: { id: string; podeEditar: boolean }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const tipos = tiposVisiveis(state.medicoes, id);
  const marcadores = podeVer(state, id, 'exames') ? marcadoresDaPessoa(state.exames, id) : [];
  return (
    <>
      {podeEditar && (
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 14 }}>Peso, pressão e glicemia ao longo do tempo. Passe o mouse no gráfico para ver cada medição.</span>
          <button type="button" className="btn btn--teal btn--h38" onClick={() => abrir(`medicao:${id}`)}>Nova medição</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        {tipos.map((t) => <CartaoMedicao key={t.id} pessoaId={id} tipo={t.id} onNova={podeEditar ? () => abrir(`medicao:${id}:${t.id}`) : undefined} onEditar={podeEditar ? (m) => abrir(`editar-medicao:${m.id}`) : undefined} />)}
      </div>
      {marcadores.length > 0 && (
        <>
          <span className="label" style={{ paddingTop: 8 }}>Exames de laboratório</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {marcadores.map((m) => <CartaoMarcador key={m} pessoaId={id} marcador={m} />)}
          </div>
        </>
      )}
    </>
  );
}

function AbaVacinasPessoa({ id, podeEditar }: { id: string; podeEditar: boolean }) {
  const { state, api } = useStore();
  const abrir = useAbrir();
  const lista = state.vacinas.filter((v) => v.pessoaId === id).sort((a, b) => b.data.localeCompare(a.data));
  const antigas = (pessoa(state, id)?.condicoes ?? []).filter((c) => c.tipo === 'vacina');
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className="card-head card-head--20">
        <span className="label">Vacinas</span>
        {podeEditar && <button type="button" className="btn--link" style={{ fontSize: 13 }} onClick={() => abrir(`vacina:${id}`)}>+ Registrar vacina</button>}
      </div>
      {lista.map((v) => {
        const vencido = !!v.proxima && v.proxima < HOJE;
        return (
          <div key={v.id} className="row" style={{ padding: '14px 20px', gap: 16, justifyContent: 'flex-start' }}>
            {podeEditar
              ? <button type="button" className="btn--link" style={{ flex: 1, fontWeight: 600, textAlign: 'left', color: 'inherit' }} onClick={() => abrir(`editar-vacina:${v.id}`)}>{v.nome}</button>
              : <span style={{ flex: 1, fontWeight: 600 }}>{v.nome}</span>}
            <span className="mono muted" style={{ width: 96 }}>{dataBR(v.data)}</span>
            <span className={vencido ? undefined : 'muted'} style={{ width: 170, color: vencido ? 'var(--warn-text)' : undefined }}>{v.proxima ? `${vencido ? 'reforço vencido' : 'reforço'} ${dataBR(v.proxima)}` : 'sem reforço'}</span>
            {podeEditar && <button type="button" className="dlista__x" aria-label={`Apagar ${v.nome}`} onClick={() => api.remover('vacinas', v, `${v.nome} apagada`)}>×</button>}
          </div>
        );
      })}
      {antigas.map((c) => (
        <div key={c.nome} className="row" style={{ padding: '14px 20px', gap: 16, justifyContent: 'flex-start' }}>
          <span style={{ flex: 1 }}>{c.nome}</span><span className="muted">{c.desde ?? ''} · do histórico do perfil</span>
        </div>
      ))}
      {lista.length + antigas.length === 0 && <div className="row muted" style={{ padding: '14px 20px' }}>Nenhuma vacina registrada.</div>}
    </div>
  );
}

function AbaPlano({ id }: { id: string }) {
  const { state } = useStore();
  const plano = state.planos.find((x) => x.pessoaId === id);
  if (!plano) return <div className="card card--pad muted">Nenhum plano guardado para {quem(pessoa(state, id))}.</div>;
  return (
    <div className="card" style={{ fontSize: 14 }}>
      {[
        ['Operadora', plano.operadora], ['Carteirinha', plano.numero], ['Plano', `${plano.produto} · ${plano.vinculo}`], ['Validade', plano.validade],
        ['Segmentação', plano.segmentacao], ['Central 24 h', plano.central ?? '—'],
      ].map(([k, v]) => <div key={k} className="row" style={{ padding: '14px 20px' }}><span className="muted">{k}</span><span className={k === 'Carteirinha' ? 'mono' : undefined}>{v}</span></div>)}
      <div className="row" style={{ padding: '14px 20px' }}><Link to="/planos" style={{ fontWeight: 600 }}>Ver em Planos de saúde</Link></div>
    </div>
  );
}
