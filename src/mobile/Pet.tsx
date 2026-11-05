import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { useStore } from '../data/store';
import { novoId } from '../data/persistencia';
import {
  NOMES_PREVENCAO, ehPet, historicoPeso, linhaPet, novaAplicacao, pesoAtual, proximaPrevencao, proximosCuidados, reforcoVencido,
  rotuloCastrado, sintomasRecentes, telHref, ultimasPrevencoes, vacinasDoPet, vencidaHa,
} from '../data/pets';
import { dataBR, diaMes, diasDeEstoque, numCurto } from '../data/format';
import type { Pessoa } from '../data/types';
import { Label, Pill, Row, TopNav, reticencias } from '../ui';
import { FotoDoPerfil } from '../ui/Foto';
import { AdicionarItem } from './EditarPerfil';
import { MScreen, TabHeader } from './Shell';
import { BotaoConfig, useAbrirNoPerfil } from './Perfil';
import { Grafico } from '../ui/Grafico';
import { pontosPesagem } from '../data/medicoes';
import { RemoverPessoaMobile } from '../ui/Confirmar';
import { FotosDoPet, useAdicionarFotos } from '../ui/FotosPet';
import { fotosDoPet } from '../data/anexos';

const sub = { fontSize: 13, color: 'var(--text-2)' } as const;

/**
 * Perfil do pet no celular (linguagem do M10). Pets não têm compartilhamento: todo mundo vê e edita.
 * `inicio`: é o Início do perfil do pet (com a tab bar).
 */
export function PetPerfil({ pet: p, inicio }: { pet: Pessoa; inicio?: boolean }) {
  const nav = useNavigate();
  const alergia = p.alergias[0];
  return (
    <MScreen gap={18} tabs={inicio}>
      {inicio ? (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--outline btn--h40" style={{ marginRight: 'auto', padding: '0 14px' }} onClick={() => nav(`/pessoa/${p.id}/editar`)}>Editar</button>
          <BotaoConfig />
        </div>
      ) : (
        <TopNav voltar="Família" voltarPara="/familia" acao="Editar" onAcao={() => nav(`/pessoa/${p.id}/editar`)} />
      )}
      <div className="hstack" style={{ gap: 14 }}>
        <FotoDoPerfil pessoa={p} tamanho={72} podeEditar />
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>{p.nome}</h1>
          <span style={sub}>{linhaPet(p)}</span>
        </div>
      </div>

      <Indicadores p={p} />
      {alergia && (
        <div className="card card--warn" style={{ padding: '14px 16px', gap: 4 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--warn-text)' }}>ALERGIA</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--warn-strong)' }}>{p.alergias.map((a) => a.substancia).join(', ')}</span>
          {alergia.reacao && <span style={{ fontSize: 13, color: 'var(--warn-text)' }}>{alergia.reacao}{alergia.ano ? ` (${alergia.ano})` : ''}</span>}
        </div>
      )}
      <Contatos p={p} />
      <Fotos pet={p} />

      <ProximosCuidados id={p.id} />
      <Vacinas id={p.id} />
      <Prevencao id={p.id} />
      <Sintomas id={p.id} />
      <Procedimentos id={p.id} />
      <Peso id={p.id} />
      <RemediosEmUso id={p.id} />
      <ConsultasExames id={p.id} />
      <button type="button" className="btn btn--outline-ink btn--h50" onClick={() => nav(`/pessoa/${p.id}/emergencia`)}>Ficha de emergência</button>
      {!inicio && <RemoverPessoaMobile p={p} />}
    </MScreen>
  );
}

/** Aba Fotos (no lugar de Plano, no perfil de um pet): o álbum dele. */
export function FotosDoPerfil() {
  const { state, perfil } = useStore();
  const pet = perfil ? state.pessoas.find((x) => x.id === perfil) : undefined;
  if (!pet || !ehPet(pet)) return <Navigate to="/" replace />;
  const n = fotosDoPet(state.anexos, pet.id).length;
  return (
    <MScreen tabs>
      <TabHeader titulo="Fotos" />
      <span style={sub}>{n ? `${n} ${n === 1 ? 'foto' : 'fotos'} de ${pet.curto}` : `Guarde aqui as fotos de ${pet.curto}.`}</span>
      <AlbumPet pet={pet} />
    </MScreen>
  );
}

function AlbumPet({ pet }: { pet: Pessoa }) {
  const seletor = useAdicionarFotos(pet);
  return <FotosDoPet pet={pet} seletor={seletor} />;
}

/** Álbum do pet: grade de 3 colunas, "+ Adicionar fotos" no fim. */
function Fotos({ pet }: { pet: Pessoa }) {
  const { state } = useStore();
  const seletor = useAdicionarFotos(pet);
  const n = fotosDoPet(state.anexos, pet.id).length;
  return (
    <section className="stack" style={{ gap: 8 }}>
      <Label>{n ? `Fotos · ${n}` : 'Fotos'}</Label>
      <FotosDoPet pet={pet} seletor={seletor} />
    </section>
  );
}

// ── Cabeçalho ───────────────────────────────────────────────────────────────

/** Peso · Castrado(a) · Microchip, no mesmo card de 3 células do M10 (Sangue · Peso · Altura). */
function Indicadores({ p }: { p: Pessoa }) {
  const { state } = useStore();
  const peso = pesoAtual(state, p.id);
  const d = p.pet;
  const celulas: { rotulo: string; valor: ReactNode; detalhe?: string }[] = [
    { rotulo: 'Peso', valor: peso ? `${numCurto(peso.kg)} kg` : '—', detalhe: peso && `em ${diaMes(peso.data)}` },
    { rotulo: rotuloCastrado(p), valor: d?.castrado == null ? '—' : d.castrado ? 'Sim' : 'Não' },
    {
      rotulo: 'Microchip',
      valor: d?.microchip
        ? <span className="mono" style={{ fontSize: 13, fontWeight: 500, lineHeight: '26px', display: 'block', ...reticencias }} title={d.microchip}>{d.microchip}</span>
        : '—',
    },
  ];
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.85fr) minmax(0,.9fr) minmax(0,1.45fr)' }}>
      {celulas.map((c, i) => (
        <div key={c.rotulo} className="stack" style={{ padding: '12px 14px', gap: 2, minWidth: 0, borderRight: i < 2 ? '1px solid var(--divider)' : undefined }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.rotulo}</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{c.valor}</span>
          {c.detalhe && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.detalhe}</span>}
        </div>
      ))}
    </div>
  );
}

/** Veterinário e clínica 24 h, cada um com "Ligar" (tel:). */
function Contatos({ p }: { p: Pessoa }) {
  const vet = p.pet?.veterinario;
  const c24 = p.pet?.clinica24h;
  return (
    <div className="card" style={{ fontSize: 15 }}>
      <LinhaContato rotulo="Veterinário" nome={vet?.nome} detalhe={vet?.clinica} tel={vet?.telefone} />
      <LinhaContato rotulo="Clínica 24 h" nome={c24?.nome} tel={c24?.telefone} />
    </div>
  );
}

function LinhaContato({ rotulo, nome, detalhe, tel }: { rotulo: string; nome?: string; detalhe?: string; tel?: string }) {
  return (
    <div className="row" style={{ padding: '10px 10px 10px 16px', minHeight: 64 }}>
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{rotulo}</span>
        <span style={{ fontWeight: 600, color: nome ? undefined : 'var(--text-3)', ...reticencias }}>{nome ?? '—'}</span>
        {(detalhe || tel) && (
          <span style={{ ...sub, ...reticencias }}>
            {detalhe}{detalhe && tel && ' · '}{tel && <span className="mono">{tel}</span>}
          </span>
        )}
      </span>
      {tel && (
        <a href={telHref(tel)} className="btn btn--soft" style={{ height: 44, padding: '0 16px', borderRadius: 'var(--r-btn)', fontSize: 14, flex: 'none' }} aria-label={`Ligar para ${nome ?? rotulo}`}>
          Ligar
        </a>
      )}
    </div>
  );
}

// ── Seções ──────────────────────────────────────────────────────────────────

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 8 }}>
      <Label>{titulo}</Label>
      <div className="card" style={{ fontSize: 15 }}>{children}</div>
    </section>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="row muted" style={{ fontSize: 14 }}>{children}</div>;
}

/** Título em cima, detalhe embaixo (lado esquerdo das linhas). */
function Texto({ titulo, detalhe, nota }: { titulo: ReactNode; detalhe?: ReactNode; nota?: string }) {
  return (
    <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
      <span style={{ fontWeight: 600 }}>{titulo}</span>
      {detalhe && <span style={sub}>{detalhe}</span>}
      {nota && <span style={{ ...sub, marginTop: 2 }}>{nota}</span>}
    </span>
  );
}

/** Data em mono à direita; vencida em laranja com "vencida há N dias". */
function Prazo({ data, vencido }: { data: string; vencido: boolean }) {
  if (vencido) return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn-text)', whiteSpace: 'nowrap', flex: 'none' }}>{vencidaHa(data)}</span>;
  return <span className="mono faint" style={{ fontSize: 13, flex: 'none' }}>{dataBR(data)}</span>;
}

const linhaVencida = (vencido: boolean) => (vencido ? { background: 'var(--warn-row)' } : undefined);

function ProximosCuidados({ id }: { id: string }) {
  const { state } = useStore();
  const lista = proximosCuidados(state, id);
  return (
    <Secao titulo="Próximos cuidados">
      {lista.map((c) => (
        <div key={c.chave} className="row" style={linhaVencida(c.vencido)}>
          <Texto titulo={c.titulo} detalhe={c.sub} />
          <Prazo data={c.data} vencido={c.vencido} />
        </div>
      ))}
      {lista.length === 0 && <Vazio>Nada programado.</Vazio>}
    </Secao>
  );
}

function Vacinas({ id }: { id: string }) {
  const { state } = useStore();
  const nav = useNavigate();
  // Todas as doses (a mais nova primeiro); tocar abre a edição.
  const lista = vacinasDoPet(state, id);
  return (
    <Secao titulo="Vacinas">
      {lista.map((v) => {
        const vencido = reforcoVencido(state, v);
        return (
          <button type="button" key={v.id} className="row" style={{ textAlign: 'left', ...linhaVencida(vencido) }} onClick={() => nav(`/pet/${id}/vacina/${v.id}`)}>
            <Texto
              titulo={v.nome}
              detalhe={<>
                aplicada em <span className="mono">{dataBR(v.data)}</span>
                {v.proxima && !vencido && <> · reforço <span className="mono">{dataBR(v.proxima)}</span></>}
              </>}
            />
            {v.proxima && vencido ? <Prazo data={v.proxima} vencido /> : <span className="chev">›</span>}
          </button>
        );
      })}
      {lista.length === 0 && <Vazio>Nenhuma vacina registrada.</Vazio>}
      <AdicionarItem onClick={() => nav(`/pet/${id}/vacina`)}>+ Registrar vacina</AdicionarItem>
    </Secao>
  );
}

function Prevencao({ id }: { id: string }) {
  const { state, api } = useStore();
  const nav = useNavigate();
  const lista = ultimasPrevencoes(state, id).sort((a, b) => proximaPrevencao(a).localeCompare(proximaPrevencao(b)));
  const aplicar = (i: number) => {
    api.aplicarPrevencao(novaAplicacao(lista[i], `prev-${novoId()}`));
  };
  return (
    <Secao titulo="Prevenção">
      {lista.map((p, i) => {
        const prox = proximaPrevencao(p);
        const vencido = prox < HOJE;
        return (
          <div key={p.id} className="row" style={{ padding: '10px 10px 10px 16px', ...linhaVencida(vencido) }}>
            <Texto
              titulo={p.produto.trim() || NOMES_PREVENCAO[p.tipo]}
              detalhe={`${NOMES_PREVENCAO[p.tipo]} · a cada ${p.intervaloDias} dias`}
            />
            <span className="stack" style={{ gap: 4, alignItems: 'flex-end', flex: 'none' }}>
              {p.data === HOJE ? (
                <span className="pill pill--teal">Aplicado hoje</span>
              ) : (
                <button type="button" className="btn btn--teal" style={{ height: 44, padding: '0 14px', borderRadius: 'var(--r-btn)', fontSize: 14 }} onClick={() => aplicar(i)}>
                  Apliquei hoje
                </button>
              )}
              {vencido
                ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn-text)' }}>{vencidaHa(prox)}</span>
                : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>próxima <span className="mono">{dataBR(prox)}</span></span>}
            </span>
          </div>
        );
      })}
      {lista.length === 0 && <Vazio>Nenhuma prevenção registrada.</Vazio>}
      <AdicionarItem onClick={() => nav(`/pet/${id}/prevencao`)}>+ Registrar prevenção</AdicionarItem>
    </Secao>
  );
}

function Sintomas({ id }: { id: string }) {
  const { state } = useStore();
  const nav = useNavigate();
  const lista = sintomasRecentes(state, id, 30);
  return (
    <Secao titulo="Sintomas recentes">
      {lista.map((s) => (
        <div key={s.id} className="row" style={{ alignItems: 'flex-start' }}>
          <span className="stack" style={{ gap: 6, minWidth: 0, flex: 1 }}>
            <span className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
              {s.sinais.map((x) => <Pill key={x} tom="neutral" pequeno>{x}</Pill>)}
            </span>
            {s.nota && <span style={sub}>{s.nota}</span>}
          </span>
          <span className="mono faint" style={{ fontSize: 13, flex: 'none', lineHeight: '22px' }}>{diaMes(s.data)}</span>
        </div>
      ))}
      {lista.length === 0 && <Vazio>Nenhum sintoma nos últimos 30 dias.</Vazio>}
      <AdicionarItem onClick={() => nav(`/pet/${id}/sintoma`)}>+ Registrar sintoma</AdicionarItem>
    </Secao>
  );
}

function Procedimentos({ id }: { id: string }) {
  const { state } = useStore();
  const nav = useNavigate();
  const lista = state.procedimentos.filter((p) => p.pessoaId === id).sort((a, b) => b.data.localeCompare(a.data));
  return (
    <Secao titulo="Procedimentos">
      {lista.map((p) => (
        <div key={p.id} className="row" style={{ alignItems: 'flex-start' }}>
          <Texto titulo={`${p.tipo}${p.descricao ? ` · ${p.descricao}` : ''}`} detalhe={p.clinica} nota={p.nota} />
          <span className="mono faint" style={{ fontSize: 13, flex: 'none', lineHeight: '22px' }}>{dataBR(p.data)}</span>
        </div>
      ))}
      {lista.length === 0 && <Vazio>Nenhum procedimento registrado.</Vazio>}
      <AdicionarItem onClick={() => nav(`/pet/${id}/procedimento`)}>+ Registrar procedimento</AdicionarItem>
    </Secao>
  );
}

function Peso({ id }: { id: string }) {
  const { state } = useStore();
  const nav = useNavigate();
  const lista = historicoPeso(state, id).slice(0, 3);
  return (
    <Secao titulo="Peso">
      {lista.length > 1 && (
        <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid var(--divider)' }}>
          <Grafico rotulo="Evolução do peso" series={[{ nome: 'Peso', cor: 'var(--teal)', pontos: pontosPesagem(state.pesagens, id) }]} casas={1} altura={150} />
        </div>
      )}
      {lista.map(({ pesagem: x, delta }) => (
        <div key={x.id} className="row">
          <Texto titulo={`${numCurto(x.kg)} kg`} detalhe={delta && <span className={delta.endsWith('kg') ? 'mono' : undefined}>{delta}</span>} />
          <span className="mono faint" style={{ fontSize: 13, flex: 'none' }}>{dataBR(x.data)}</span>
        </div>
      ))}
      {lista.length === 0 && <Vazio>Nenhuma pesagem registrada.</Vazio>}
      <AdicionarItem onClick={() => nav(`/pet/${id}/pesagem`)}>+ Nova pesagem</AdicionarItem>
    </Secao>
  );
}

function RemediosEmUso({ id }: { id: string }) {
  const { state } = useStore();
  const nav = useNavigate();
  const lista = state.remedios.filter((r) => r.ativo && r.pessoaId === id);
  return (
    <Secao titulo="Remédios em uso">
      {lista.map((r) => {
        const estoque = diasDeEstoque(r);
        return (
          <button type="button" key={r.id} className="row" style={{ textAlign: 'left' }} onClick={() => nav(`/remedios/${r.id}`)}>
            <Texto titulo={r.nome} detalhe={`${r.seNecessario ? 'se necessário' : r.horarios.join(', ')}${estoque != null ? ` · ${estoque} dias de estoque` : ''}`} />
            <span className="chev">›</span>
          </button>
        );
      })}
      {lista.length === 0 && <Vazio>Nenhum remédio em uso.</Vazio>}
    </Secao>
  );
}

/** Consultas e exames como no M10: uma linha cada, levando às abas. */
function ConsultasExames({ id }: { id: string }) {
  const { state } = useStore();
  const abrirNoPerfil = useAbrirNoPerfil();
  const prox = state.consultas.filter((c) => c.pessoaId === id && c.data >= HOJE).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))[0];
  const exames = state.exames.filter((e) => e.pessoaId === id).length;
  return (
    <div className="card" style={{ fontSize: 15 }}>
      <Row mutedLabel={false} label="Consultas" valor={<span className="muted">{prox ? `próxima ${diaMes(prox.data)}` : 'nenhuma marcada'} ›</span>} onClick={() => abrirNoPerfil(id, '/agenda')} />
      <Row mutedLabel={false} label="Exames" valor={<span className="muted">{exames} {exames === 1 ? 'arquivado' : 'arquivados'} ›</span>} onClick={() => abrirNoPerfil(id, '/exames')} />
    </div>
  );
}
