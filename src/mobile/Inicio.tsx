import { PedidosPendentes } from '../ui/Papeis';
import { useNavigate } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { doMeuCuidado, eu, pessoa, proximos, useStore } from '../data/store';
import { dataLonga, diaMes, estoqueBaixo, mesSigla, quem } from '../data/format';
import { Bar, Check, Circle, Label, SecaoLista } from '../ui';
import { CartaoDose, LinhaDia, ListaDoses, RemedioAcabando, useDoseDaVez, useRemedioAcabando } from '../ui/Inicio';
import { agruparFamiliaPets, ehPet, proximaConsultaDaFamilia } from '../data/pets';
import { estadoDose, saudacao } from '../data/inicio';
import { useAgora } from '../data/useAgora';
import type { Consulta } from '../data/types';
import { MScreen } from './Shell';
import { BotaoConfig } from './Perfil';
import { PetPerfil } from './Pet';

/** M03 Início · M20 quando ainda não há nada cadastrado. No perfil de um pet, o perfil dele. */
export function Inicio() {
  const { state, perfil } = useStore();
  const doPerfil = perfil ? pessoa(state, perfil) : undefined;
  if (doPerfil && ehPet(doPerfil)) return <PetPerfil key={doPerfil.id} pet={doPerfil} inicio />;
  const vazio = state.remedios.length === 0 && state.consultas.length === 0 && state.exames.length === 0;
  return vazio ? <InicioVazio /> : <InicioCheio />;
}

/** Topo do Início: "Bom dia, Helena" e a data à esquerda, Buscar e Configurações na mesma linha. O perfil fica na última aba. */
function Topo() {
  const { state } = useStore();
  const nav = useNavigate();
  const agora = useAgora();
  const me = state.pessoas.find((p) => p.souEu);
  return (
    <div className="hstack" style={{ gap: 8 }}>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {saudacao(agora)}{me ? `, ${me.curto}` : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{dataLonga(HOJE)}</span>
      </div>
      <div className="hstack" style={{ flex: 'none' }}>
        <button type="button" className="btn btn--outline btn--h40" style={{ marginRight: 8, minWidth: 44, flexShrink: 0 }} onClick={() => nav('/busca')} aria-label="Buscar">Buscar</button>
        <BotaoConfig />
      </div>
    </div>
  );
}

function InicioCheio() {
  const { state, perfil } = useStore();
  const nav = useNavigate();
  const dv = useDoseDaVez();
  const meus = (pessoaId: string) => !!perfil || doMeuCuidado(state, pessoaId);
  const { doses, agora } = dv;
  const tomadas = doses.filter((d) => d.dose?.status === 'tomada').length;
  const acabando = useRemedioAcabando(state.remedios.filter((r) => meus(r.pessoaId)));
  const prox = proximos(state).filter((c) => meus(c.pessoaId)).slice(0, 2);
  const proxG = agruparFamiliaPets(prox, state);
  const divisoria = <SecaoLista rotulo="Pets" style={{ padding: '12px 14px 4px' }} />;

  const linhaProx = (c: Consulta) => (
    <button type="button" key={c.id} className="row" style={{ gap: 14, padding: '13px 14px', justifyContent: 'flex-start' }} onClick={() => nav('/agenda')}>
      <div className="stack" style={{ width: 44, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-2)' }}>{mesSigla(c.data)}</span>
        <span style={{ fontSize: 20, fontWeight: 600 }}>{c.data.slice(8, 10)}</span>
      </div>
      <div className="stack" style={{ flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{c.titulo}</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {[quem(state.pessoas.find((p) => p.id === c.pessoaId)), c.hora, c.profissional ?? c.preparo].filter(Boolean).join(' · ')}
        </span>
      </div>
    </button>
  );

  return (
    <MScreen tabs gap={14}>
      <Topo />

      <PedidosPendentes />
      <CartaoDose dv={dv} compacto onCadastrar={() => nav('/remedios/novo')} />

      <Numeros />

      {doses.length > 0 && (
        <section className="card" style={{ padding: '14px 16px', gap: 6 }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Doses de hoje</span>
            <span style={{ color: 'var(--text-2)', fontSize: 13 }}><strong style={{ color: 'var(--ink)' }}>{tomadas}</strong> de {doses.length}</span>
          </div>
          <LinhaDia doses={doses} agora={agora} compacto />
          <ListaDoses doses={doses} agora={agora} compacto />
        </section>
      )}

      {acabando && <RemedioAcabando key={acabando.id} r={acabando} compacto />}

      <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
        <Label>Próximos</Label>
        <div className="card">
          {proxG.familia.map(linhaProx)}
          {proxG.pets.length > 0 && <>{divisoria}{proxG.pets.map(linhaProx)}</>}
          {prox.length === 0 && <div className="row muted" style={{ fontSize: 14 }}>Nada marcado nos próximos 30 dias.</div>}
        </div>
      </div>
    </MScreen>
  );
}

/** Os três números do painel do desktop (D01): doses de hoje, próxima consulta e estoque baixo, do perfil aberto. */
function Numeros() {
  const { state } = useStore();
  const nav = useNavigate();
  const { doses, agora } = useDoseDaVez();
  const tomadas = doses.filter((d) => d.dose?.status === 'tomada').length;
  const atrasadas = doses.filter((d) => estadoDose(d, agora) === 'atrasada').length;
  const prox = proximaConsultaDaFamilia(state);
  const baixos = state.remedios.filter((r) => r.ativo && estoqueBaixo(r));
  return (
    <section className="card numeros-m">
      <button type="button" onClick={() => nav('/remedios')}>
        <span className="numeros-m__rot">Doses de hoje</span>
        <span className="numeros-m__valor">{tomadas}/{doses.length}</span>
        <span className={atrasadas ? 'numeros-m__det is-alerta' : 'numeros-m__det'}>{atrasadas ? (atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`) : doses.length ? 'Nenhuma atrasada' : 'Sem horário'}</span>
      </button>
      <button type="button" onClick={() => nav('/agenda')}>
        <span className="numeros-m__rot">Próxima consulta</span>
        <span className="numeros-m__valor">{prox ? diaMes(prox.data) : '—'}</span>
        <span className="numeros-m__det">{prox ? prox.titulo : 'Nada marcado'}</span>
      </button>
      <button type="button" onClick={() => nav('/remedios')}>
        <span className="numeros-m__rot">Estoque baixo</span>
        <span className={baixos.length ? 'numeros-m__valor is-alerta' : 'numeros-m__valor'}>{baixos.length}</span>
        <span className="numeros-m__det">{baixos.length ? baixos.map((r) => r.nome.split(' ')[0]).join(', ') : 'Tudo em dia'}</span>
      </button>
    </section>
  );
}

/** M20 — primeiro uso. */
function InicioVazio() {
  const { state } = useStore();
  const nav = useNavigate();
  const me = eu(state);
  const passos = [
    { nome: 'Criar seu perfil', feito: true, to: '/familia' },
    { nome: 'Adicionar alergias e condições', feito: me.alergias.length + me.condicoes.length > 0, to: `/pessoa/${me.id}` },
    { nome: 'Cadastrar um remédio', feito: state.remedios.length > 0, to: '/remedios/novo' },
    { nome: 'Guardar a carteirinha do plano', feito: state.planos.length > 0, to: `/pessoa/${me.id}/plano` },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  return (
    <MScreen tabs gap={20}>
      <Topo />
      <div className="card" style={{ padding: 18, gap: 14 }}>
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Vamos começar</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{feitos} de {passos.length}</span>
        </div>
        <Bar pct={(feitos / passos.length) * 100} />
        <div className="stack">
          {passos.map((p, i) => (
            <button
              type="button"
              key={p.nome}
              onClick={() => !p.feito && nav(p.to)}
              className="hstack"
              style={{ gap: 12, padding: '12px 0', borderBottom: i < passos.length - 1 ? '1px solid var(--divider)' : undefined }}
            >
              {p.feito ? <Check /> : <Circle />}
              <span style={{ flex: 1, fontSize: 15, fontWeight: p.feito ? 400 : 500, color: p.feito ? 'var(--text-3)' : undefined, textDecoration: p.feito ? 'line-through' : undefined }}>
                {p.nome}
              </span>
              {!p.feito && <span className="chev">›</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Mais alguém da casa?</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>Convide quem tem celular próprio ou cadastre quem você cuida.</span>
        <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => nav('/cadastro')}>
          Adicionar pessoa
        </button>
      </div>
    </MScreen>
  );
}
