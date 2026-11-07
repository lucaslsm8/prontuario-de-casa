import { useState, type CSSProperties, type ReactNode } from 'react';
import { HOJE } from '../data/tempo';
import { useStore } from '../data/store';
import { novoId } from '../data/persistencia';
import {
  NOMES_PREVENCAO, equipeProcedimento, historicoPeso, tituloProcedimento, linhaPet, novaAplicacao, pesoAtual, proximaPrevencao, proximosCuidados, reforcoVencido,
  rotuloCastrado, sintomasRecentes, telHref, ultimasPrevencoes, vacinasDoPet, vencidaHa,
} from '../data/pets';
import { dataBR, diaMes, numCurto } from '../data/format';
import type { Pessoa } from '../data/types';
import { Label, Pill } from '../ui';
import { FotoDoPerfil } from '../ui/Foto';
import { useAbrir } from './Shell';
import { Grafico } from '../ui/Grafico';
import { pontosPesagem } from '../data/medicoes';
import { AbaConsultas, AbaExames, AbaRemedios, CardRemediosEmUso, ListaCard, Stat, linha, reticencias } from './AbasPessoa';
import { RemoverPessoaDesktop } from './Acoes';
import { FotosDoPet, useAdicionarFotos } from '../ui/FotosPet';
import { fotosDoPet } from '../data/anexos';

type Aba = 'resumo' | 'fotos' | 'vacinas' | 'prevencao' | 'sintomas' | 'procedimentos' | 'peso' | 'remedios' | 'consultas' | 'exames';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'resumo', nome: 'Resumo' },
  { id: 'fotos', nome: 'Fotos' },
  { id: 'vacinas', nome: 'Vacinas' },
  { id: 'prevencao', nome: 'Prevenção' },
  { id: 'sintomas', nome: 'Sintomas' },
  { id: 'procedimentos', nome: 'Procedimentos' },
  { id: 'peso', nome: 'Peso' },
  { id: 'remedios', nome: 'Remédios' },
  { id: 'consultas', nome: 'Consultas' },
  { id: 'exames', nome: 'Exames' },
];

/** Perfil do pet no desktop (mesma linguagem do D02). Pets não têm compartilhamento: todo mundo vê e edita. */
export function DPet({ pet: p }: { pet: Pessoa }) {
  const abrir = useAbrir();
  const [aba, setAba] = useState<Aba>('resumo');
  const sub = linhaPet(p, true);

  return (
    <div className="desk__page desk__page--home" style={{ gap: 22 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="hstack" style={{ gap: 16 }}>
          <FotoDoPerfil pessoa={p} tamanho={88} podeEditar />
          <div className="stack" style={{ gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em' }}>{p.nome}</h1>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{sub}</span>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--h40d" onClick={() => abrir(`emergencia:${p.id}`)}>Ficha de emergência</button>
          <RemoverPessoaDesktop p={p} />
          <button type="button" className="btn btn--teal btn--h40d" onClick={() => abrir(`perfil:${p.id}`)}>Editar perfil</button>
        </div>
      </div>

      <IndicadoresPet p={p} />

      <div className="hstack" style={{ gap: 24, fontSize: 14, fontWeight: 600, borderBottom: '1px solid var(--border-card)' }} role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-${a.id}`}
            aria-controls={`painel-${a.id}`}
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            style={{ paddingBottom: 12, borderBottom: aba === a.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1, color: aba === a.id ? undefined : 'var(--text-2)', transition: 'color 180ms', whiteSpace: 'nowrap' }}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {aba === 'resumo' && <AbaResumo id={p.id} />}
      {aba === 'fotos' && <AbaFotos pet={p} />}
      {aba === 'vacinas' && <AbaVacinas id={p.id} />}
      {aba === 'prevencao' && <AbaPrevencao id={p.id} />}
      {aba === 'sintomas' && <AbaSintomas id={p.id} />}
      {aba === 'procedimentos' && <AbaProcedimentos id={p.id} />}
      {aba === 'peso' && <AbaPeso id={p.id} />}
      {aba === 'remedios' && <AbaRemedios id={p.id} />}
      {aba === 'consultas' && <AbaConsultas id={p.id} />}
      {aba === 'exames' && <AbaExames id={p.id} />}
      </div>
    </div>
  );
}

/** "(11) 3456-7890 · Ligar" — o telefone em mono e o link de ligação; `antes` (a clínica) fica na linha de cima. */
function Telefone({ tel, antes, nome }: { tel?: string; antes?: string; nome?: string }) {
  if (!tel && !antes) return null;
  const ligar = tel && <><span className="mono">{tel}</span> · <a href={telHref(tel)} style={{ fontWeight: 600 }} aria-label={nome ? `Ligar para ${nome}` : undefined}>Ligar</a></>;
  if (!antes || !tel) return <>{antes}{ligar}</>;
  return (
    <>
      <span style={{ display: 'block', ...reticencias }}>{antes}</span>
      <span style={{ display: 'block', ...reticencias }}>{ligar}</span>
    </>
  );
}

/** Faixa do cabeçalho: peso · castrado(a) · microchip · veterinário · clínica 24 h. */
function IndicadoresPet({ p }: { p: Pessoa }) {
  const { state } = useStore();
  const peso = pesoAtual(state, p.id);
  const d = p.pet;
  const vet = d?.veterinario;
  const c24 = d?.clinica24h;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.8fr) minmax(0,.8fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.2fr)', gap: 12 }}>
      <Stat rotulo="Peso" valor={peso ? `${numCurto(peso.kg)} kg` : '—'} sub={peso && `em ${diaMes(peso.data)}`} subTexto />
      <Stat rotulo={rotuloCastrado(p)} valor={d?.castrado == null ? '—' : d.castrado ? 'Sim' : 'Não'} />
      <Stat rotulo="Microchip" valor={d?.microchip ?? '—'} valorMono={!!d?.microchip} />
      <Stat rotulo="Veterinário" valor={vet?.nome ?? '—'} subTexto sub={vet && (vet.clinica || vet.telefone) ? <Telefone antes={vet.clinica} tel={vet.telefone} nome={vet.nome} /> : undefined} />
      <Stat rotulo="Clínica 24 h" valor={c24?.nome ?? '—'} subTexto sub={c24?.telefone ? <Telefone tel={c24.telefone} nome={c24.nome} /> : undefined} />
    </div>
  );
}

// ── Peças das abas ──────────────────────────────────────────────────────────

/** Card de aba: título à esquerda e "+ Registrar …" à direita. */
function CardAba({ titulo, acao, onAcao, children }: { titulo: string; acao?: string; onAcao: () => void; children: ReactNode }) {
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className="card-head card-head--20">
        <Label>{titulo}</Label>
        {acao && <button type="button" className="btn--link" style={{ fontSize: 13 }} onClick={onAcao}>{acao}</button>}
      </div>
      {children}
    </div>
  );
}

const cabecalho: CSSProperties = { display: 'grid', padding: '12px 20px', borderBottom: '1px solid var(--divider)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-2)' };
const linhaTabela: CSSProperties = { display: 'grid', padding: '16px 20px', justifyContent: 'stretch' };
/** Estado vazio: uma linha discreta (o "+ Registrar …" fica no topo do card). */
function Vazio({ children }: { children: ReactNode }) {
  return <div className="row muted" style={{ padding: '14px 20px' }}>{children}</div>;
}

/** Data em mono; vencida em laranja com "vencida há N dias" embaixo. */
function DataPrazo({ data, vencido }: { data: string; vencido: boolean }) {
  if (!vencido) return <span className="mono">{dataBR(data)}</span>;
  return (
    <span className="stack" style={{ gap: 2 }}>
      <span className="mono" style={{ color: 'var(--warn-strong)', fontWeight: 600 }}>{dataBR(data)}</span>
      <span style={{ fontSize: 12, color: 'var(--warn-text)' }}>{vencidaHa(data)}</span>
    </span>
  );
}

// ── Resumo ──────────────────────────────────────────────────────────────────

function AbaResumo({ id }: { id: string }) {
  const { state } = useStore();
  const cuidados = proximosCuidados(state, id);
  const sintomas = sintomasRecentes(state, id, 30);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
      <ListaCard titulo="Próximos cuidados">
        {cuidados.map((c) => (
          <div key={c.chave} className="hstack" style={{ ...linha, alignItems: 'center', gap: 12, background: c.vencido ? 'var(--warn-row)' : undefined }}>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{c.titulo}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.sub}</span>
            </span>
            {c.vencido
              ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn-text)', whiteSpace: 'nowrap' }}>{vencidaHa(c.data)}</span>
              : <span className="mono faint" style={{ fontSize: 13 }}>{dataBR(c.data)}</span>}
          </div>
        ))}
        {cuidados.length === 0 && <div style={linha} className="muted">Nada programado.</div>}
      </ListaCard>
      <CardRemediosEmUso id={id} />
      <ListaCard titulo="Sintomas recentes">
        {sintomas.map((s) => (
          <div key={s.id} className="stack" style={{ padding: '12px 18px', gap: 4 }}>
            <span className="hstack" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{s.sinais.join(', ')}</span>
              <span className="mono faint" style={{ fontSize: 13 }}>{diaMes(s.data)}</span>
            </span>
            {s.nota && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.nota}</span>}
          </div>
        ))}
        {sintomas.length === 0 && <div style={linha} className="muted">Nenhum sintoma nos últimos 30 dias.</div>}
      </ListaCard>
    </div>
  );
}

// ── Fotos ───────────────────────────────────────────────────────────────────

function AbaFotos({ pet }: { pet: Pessoa }) {
  const { state } = useStore();
  const seletor = useAdicionarFotos(pet);
  const n = fotosDoPet(state.anexos, pet.id).length;
  return (
    <CardAba titulo={n ? `Fotos · ${n}` : 'Fotos'} acao="+ Adicionar fotos" onAcao={seletor.abrir}>
      <div style={{ padding: 20 }}><FotosDoPet pet={pet} seletor={seletor} /></div>
    </CardAba>
  );
}

// ── Vacinas ─────────────────────────────────────────────────────────────────

const COLS_VACINA = 'minmax(0,1.3fr) 120px minmax(0,1fr) minmax(0,1.3fr) 150px';

function AbaVacinas({ id }: { id: string }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const lista = vacinasDoPet(state, id);
  return (
    <CardAba titulo="Vacinas" acao="+ Registrar vacina" onAcao={() => abrir(`vacina:${id}`)}>
      {lista.length > 0 && (
        <div className="mono" style={{ ...cabecalho, gridTemplateColumns: COLS_VACINA }}>
          <span>VACINA</span><span>DATA</span><span>LOTE</span><span>VETERINÁRIO</span><span>PRÓXIMO REFORÇO</span>
        </div>
      )}
      {lista.map((v) => (
        <button type="button" key={v.id} className="row" style={{ ...linhaTabela, gridTemplateColumns: COLS_VACINA, textAlign: 'left' }} onClick={() => abrir(`editar-vacina:${v.id}`)} aria-label={`Editar ${v.nome} de ${dataBR(v.data)}`}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{v.nome}</span>
          <span className="mono">{dataBR(v.data)}</span>
          <span className={v.lote ? 'mono' : 'faint'}>{v.lote ?? '—'}</span>
          <span className={v.veterinario ? undefined : 'faint'}>{v.veterinario ?? '—'}</span>
          {v.proxima ? <DataPrazo data={v.proxima} vencido={reforcoVencido(state, v)} /> : <span className="faint">—</span>}
        </button>
      ))}
      {lista.length === 0 && <Vazio>Nenhuma vacina registrada.</Vazio>}
    </CardAba>
  );
}

// ── Prevenção ───────────────────────────────────────────────────────────────

const COLS_PREVENCAO = 'minmax(0,1.6fr) 150px 170px 150px';

function AbaPrevencao({ id }: { id: string }) {
  const { state, api } = useStore();
  const abrir = useAbrir();
  const lista = ultimasPrevencoes(state, id).sort((a, b) => proximaPrevencao(a).localeCompare(proximaPrevencao(b)));
  const aplicar = (i: number) => {
    api.aplicarPrevencao(novaAplicacao(lista[i], `prev-${novoId()}`));
  };
  return (
    <CardAba titulo="Prevenção" acao="+ Registrar prevenção" onAcao={() => abrir(`prevencao:${id}`)}>
      {lista.length > 0 && (
        <div className="mono" style={{ ...cabecalho, gridTemplateColumns: COLS_PREVENCAO }}>
          <span>PRODUTO</span><span>ÚLTIMA APLICAÇÃO</span><span>PRÓXIMA</span><span />
        </div>
      )}
      {lista.map((p, i) => {
        const prox = proximaPrevencao(p);
        return (
          <div key={p.id} className="row" style={{ ...linhaTabela, gridTemplateColumns: COLS_PREVENCAO, alignItems: 'center' }}>
            <button type="button" className="stack" style={{ gap: 2, minWidth: 0, textAlign: 'left', alignItems: 'flex-start' }} onClick={() => abrir(`editar-prevencao:${p.id}`)} aria-label={`Editar ${p.produto.trim() || NOMES_PREVENCAO[p.tipo]}`}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{p.produto.trim() || NOMES_PREVENCAO[p.tipo]}</span>
              <span className="muted" style={{ fontSize: 12 }}>{NOMES_PREVENCAO[p.tipo]} · a cada {p.intervaloDias} dias</span>
            </button>
            <span className="mono">{dataBR(p.data)}</span>
            <DataPrazo data={prox} vencido={prox < HOJE} />
            <span style={{ justifySelf: 'end' }}>
              {p.data === HOJE
                ? <span className="pill pill--teal pill--lg">Aplicado hoje</span>
                : <button type="button" className="btn btn--teal btn--h34" onClick={() => aplicar(i)}>Apliquei hoje</button>}
            </span>
          </div>
        );
      })}
      {lista.length === 0 && <Vazio>Nenhuma prevenção registrada.</Vazio>}
    </CardAba>
  );
}

// ── Sintomas ────────────────────────────────────────────────────────────────

function AbaSintomas({ id }: { id: string }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const lista = state.sintomas.filter((s) => s.pessoaId === id).sort((a, b) => b.data.localeCompare(a.data));
  return (
    <CardAba titulo="Sintomas" acao="+ Registrar sintoma" onAcao={() => abrir(`sintoma:${id}`)}>
      {lista.map((s) => (
        <button type="button" key={s.id} className="row" style={{ padding: '14px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, textAlign: 'left' }} onClick={() => abrir(`editar-sintoma:${s.id}`)} aria-label={`Editar sintoma de ${dataBR(s.data)}`}>
          <span className="mono" style={{ width: 90, flex: 'none', lineHeight: '22px' }}>{dataBR(s.data)}</span>
          <span className="stack" style={{ gap: 6, flex: 1, minWidth: 0 }}>
            <span className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
              {s.sinais.map((x) => <Pill key={x} tom="neutral" pequeno>{x}</Pill>)}
            </span>
            {s.nota && <span className="muted" style={{ fontSize: 13 }}>{s.nota}</span>}
          </span>
        </button>
      ))}
      {lista.length === 0 && <Vazio>Nenhum sintoma registrado.</Vazio>}
    </CardAba>
  );
}

// ── Procedimentos ───────────────────────────────────────────────────────────

/** Procedimentos do pet ou da pessoa; clicar abre a edição. `podeEditar` falso (pessoa que só compartilha) só mostra. */
export function AbaProcedimentos({ id, podeEditar = true }: { id: string; podeEditar?: boolean }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const lista = state.procedimentos.filter((p) => p.pessoaId === id).sort((a, b) => b.data.localeCompare(a.data));
  return (
    <CardAba titulo="Procedimentos" acao={podeEditar ? '+ Registrar procedimento' : undefined} onAcao={() => abrir(`procedimento:${id}`)}>
      {lista.map((p) => {
        const conteudo = (
          <>
            <span className="mono" style={{ width: 90, flex: 'none', lineHeight: '22px' }}>{dataBR(p.data)}</span>
            <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{tituloProcedimento(p)}</span>
              {(p.clinica || equipeProcedimento(p)) && <span className="muted" style={{ fontSize: 12 }}>{[p.clinica, equipeProcedimento(p)].filter(Boolean).join(' · ')}</span>}
              {p.nota && <span className="muted" style={{ fontSize: 13, marginTop: 2 }}>{p.nota}</span>}
            </span>
          </>
        );
        const estilo = { padding: '14px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, textAlign: 'left' } as const;
        return podeEditar
          ? <button type="button" key={p.id} className="row" style={estilo} onClick={() => abrir(`editar-procedimento:${p.id}`)} aria-label={`Editar ${tituloProcedimento(p)} de ${dataBR(p.data)}`}>{conteudo}</button>
          : <div key={p.id} className="row" style={estilo}>{conteudo}</div>;
      })}
      {lista.length === 0 && <Vazio>Nenhum procedimento registrado.</Vazio>}
    </CardAba>
  );
}

// ── Peso ────────────────────────────────────────────────────────────────────

function AbaPeso({ id }: { id: string }) {
  const { state } = useStore();
  const abrir = useAbrir();
  const lista = historicoPeso(state, id);
  return (
    <CardAba titulo="Peso" acao="+ Nova pesagem" onAcao={() => abrir(`pesagem:${id}`)}>
      {lista.length > 0 && (
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--divider)' }}>
          <Grafico rotulo="Evolução do peso" series={[{ nome: 'Peso', cor: 'var(--teal)', pontos: pontosPesagem(state.pesagens, id) }]} casas={1} altura={200} />
        </div>
      )}
      {lista.map(({ pesagem: x, delta }) => (
        <button type="button" key={x.id} className="row" style={{ padding: '14px 20px', justifyContent: 'flex-start', gap: 16, textAlign: 'left' }} onClick={() => abrir(`editar-pesagem:${x.id}`)} aria-label={`Editar pesagem de ${dataBR(x.data)}`}>
          <span className="mono" style={{ width: 90, flex: 'none' }}>{dataBR(x.data)}</span>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{numCurto(x.kg)} kg</span>
          {delta && <span className={delta.endsWith('kg') ? 'mono muted' : 'muted'} style={{ fontSize: 13 }}>{delta}</span>}
        </button>
      ))}
      {lista.length === 0 && <Vazio>Nenhuma pesagem registrada.</Vazio>}
    </CardAba>
  );
}
