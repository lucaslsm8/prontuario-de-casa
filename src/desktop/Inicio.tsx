import { PedidosPendentes } from '../ui/Papeis';
import { Link } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { doMeuCuidado, eu, pessoa, proximos, useStore } from '../data/store';
import { dataLonga, diasEntre, estoqueBaixo, mesSigla, quem } from '../data/format';
import { estadoDose, saudacao, separarConcentracao } from '../data/inicio';
import { ehPet, proximaConsultaDaFamilia } from '../data/pets';
import { CartaoDose, LinhaDia, ListaDoses, RemedioAcabando, useDoseDaVez, useRemedioAcabando } from '../ui/Inicio';
import { IcAgenda, IcEstoque, IcRemedio } from '../ui/Icones';
import { cx } from '../ui';
import { useAbrir } from './Shell';

const emDias = (n: number) => (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`);

/** D01 — Início (redesign "cartão escuro"). */
export function DInicio() {
  const { state } = useStore();
  const abrir = useAbrir();
  const dv = useDoseDaVez();
  const { doses, agora } = dv;
  const tomadas = doses.filter((d) => d.dose?.status === 'tomada').length;
  const atrasadas = doses.filter((d) => estadoDose(d, agora) === 'atrasada').length;
  // Painel de quem está sob o seu cuidado: você, os pets e quem te aceitou como cuidador ou administrador.
  const meus = (pessoaId: string) => doMeuCuidado(state, pessoaId);
  const proxConsulta = proximaConsultaDaFamilia({ ...state, consultas: state.consultas.filter((c) => meus(c.pessoaId)) });
  const baixos = state.remedios.filter((r) => r.ativo && estoqueBaixo(r) && meus(r.pessoaId));
  const acabando = useRemedioAcabando(state.remedios.filter((r) => meus(r.pessoaId)));
  const prox = proximos(state).filter((c) => meus(c.pessoaId)).slice(0, 3);

  return (
    <div className="desk__page desk__page--home">
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 4 }}>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{dataLonga(HOJE)}</span>
          <h1 className="desk-title desk-title--32" style={{ margin: 0 }}>{saudacao(agora)}, {eu(state).curto}</h1>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--h40d" onClick={() => abrir('exame')}>Adicionar exame</button>
          <button type="button" className="btn btn--teal btn--h40d" onClick={() => abrir('consulta')}>Nova consulta</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 18, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18, minWidth: 0 }}>
          <PedidosPendentes />
          <CartaoDose dv={dv} onCadastrar={() => abrir('remedio')} />
          {doses.length > 0 && (
            <section className="card" style={{ padding: '18px 22px', gap: 10 }}>
              <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Doses de hoje</span>
                <span style={{ color: 'var(--text-2)' }}><strong style={{ color: 'var(--ink)' }}>{tomadas}</strong> de {doses.length} tomadas</span>
              </div>
              <LinhaDia doses={doses} agora={agora} />
              <ListaDoses doses={doses} agora={agora} />
            </section>
          )}
        </div>

        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <section className="card numeros">
            <Link to="/remedios" className="numero">
              <span className="numero__ic"><IcRemedio /></span>
              <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="numero__rot">Doses de hoje</span>
                <span className={cx('numero__det', atrasadas > 0 && 'numero__det--alerta')}>
                  {atrasadas ? (atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`) : doses.length ? 'Nenhuma atrasada' : 'Sem horário hoje'}
                </span>
              </span>
              <span className="numero__valor">{tomadas}/{doses.length}</span>
            </Link>
            <Link to="/agenda" className="numero">
              <span className="numero__ic numero__ic--sol"><IcAgenda /></span>
              <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="numero__rot">Próxima consulta</span>
                <span className="numero__det">{proxConsulta ? `${proxConsulta.titulo} · ${quem(pessoa(state, proxConsulta.pessoaId))}` : 'Nada marcado'}</span>
              </span>
              <span className="numero__valor numero__valor--sm">{proxConsulta ? `${proxConsulta.data.slice(8, 10)}/${proxConsulta.data.slice(5, 7)}` : '—'}</span>
            </Link>
            <Link to="/remedios" className="numero">
              <span className={cx('numero__ic', baixos.length ? 'numero__ic--warn' : 'numero__ic--neutro')}><IcEstoque /></span>
              <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="numero__rot">Estoque baixo</span>
                <span className={cx('numero__det', baixos.length > 0 && 'numero__det--warn')}>
                  {baixos.length ? baixos.map((r) => separarConcentracao(r.nome)[0]).join(', ') : 'Tudo em dia'}
                </span>
              </span>
              <span className="numero__valor">{baixos.length}</span>
            </Link>
          </section>

          {acabando && <RemedioAcabando key={acabando.id} r={acabando} />}

          <section className="card" style={{ padding: 16, gap: 12 }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>Próximos compromissos</span>
              <Link to="/agenda" style={{ fontWeight: 600, fontSize: 13 }}>Ver agenda</Link>
            </div>
            {prox.map((c) => {
              const p = pessoa(state, c.pessoaId);
              return (
                <Link key={c.id} to="/agenda" className="compromisso">
                  <span className={cx('compromisso__data', p && ehPet(p) && 'compromisso__data--pet')}>
                    <b>{c.data.slice(8, 10)}</b><span>{mesSigla(c.data)}</span>
                  </span>
                  <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{c.titulo}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{[c.hora, quem(p)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{emDias(diasEntre(HOJE, c.data))}</span>
                </Link>
              );
            })}
            {prox.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Nada marcado nos próximos 30 dias.</span>}
          </section>
        </div>
      </div>
    </div>
  );
}
