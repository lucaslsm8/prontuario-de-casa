// Início no modo só de informações (Configurações), variação "agenda em destaque" (canvas do Claude Design, C):
// a próxima consulta num cartão escuro, as seguintes em "Depois", os horários dos remédios, a família e os exames.
// Usado no desktop (painel da família) e no celular (perfil aberto ou "Família toda").
import { Link } from 'react-router-dom';
import { pessoa, useStore } from '../data/store';
import { dataBR, diaMes, idade, mesSigla, parseISO, quem } from '../data/format';
import { destinoConsulta, distancia, horaDeSair, linkRota, textoTrajeto } from '../data/consultas';
import { examesRecentes, horariosDoDia, remediosEmUso, separarConcentracao } from '../data/inicio';
import { proximosCuidados } from '../data/pets';
import { qtdForaDaFaixa } from '../data/resultados';
import { HOJE } from '../data/tempo';
import type { Consulta, Exame, Pessoa, Remedio } from '../data/types';
import { Avatar, cx } from '.';
import { PilulaDoRemedio } from './Pilula';
import { comDoseDoDia, resumoDias } from '../data/frequencia';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Pessoas na ordem do app (você primeiro, depois a família e os pets), só as que aparecem em `ids`. */
function emOrdem(pessoas: Pessoa[], ids: Set<string>) {
  const lista = pessoas.filter((p) => ids.has(p.id));
  return [...lista.filter((p) => p.souEu), ...lista.filter((p) => !p.souEu && p.tipo !== 'pet'), ...lista.filter((p) => p.tipo === 'pet')];
}

/** "Hipotireoidismo" → "hipotireoidismo"; siglas ("DPOC") ficam como estão. */
const minuscula = (t: string) => (/^[A-ZÀ-Ú][a-zà-ú]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

/** Cartão escuro da próxima consulta: quando, com quem, onde, que horas sair, o que levar e o que perguntar. */
export function ProximaConsulta({ c, compacto }: { c: Consulta; compacto?: boolean }) {
  const { state } = useStore();
  const p = pessoa(state, c.pessoaId);
  const sair = horaDeSair(c.hora, c.trajetoMin);
  const destino = destinoConsulta(c);
  const levar = c.levar.map((x) => x.item).filter(Boolean).slice(0, 3);
  const perguntas = (c.perguntas ?? []).filter(Boolean).slice(0, 3);
  const blocos = [
    sair && { rotulo: 'SAIA ÀS', grande: sair, linhas: [`${textoTrajeto(c.trajetoMin!)} de trajeto`] },
    c.preparo && { rotulo: 'PREPARO', linhas: [c.preparo] },
    levar.length > 0 && { rotulo: 'LEVAR', linhas: levar },
    perguntas.length > 0 && { rotulo: 'PERGUNTAR', linhas: perguntas },
  ].filter(Boolean) as { rotulo: string; grande?: string; linhas: string[] }[];
  const dia = parseISO(c.data).getDay();
  return (
    <section className={cx('proxima', compacto && 'proxima--compacta')}>
      <span className="proxima__rotulo">{c.tipo === 'exame' ? 'PRÓXIMO EXAME' : 'PRÓXIMA CONSULTA'} · {distancia(c.data, HOJE).toUpperCase()}</span>
      <div className="proxima__linha">
        <span className="proxima__data">
          <b>{c.data.slice(8, 10)}</b>
          <span>{mesSigla(c.data)} · {DIAS[dia]}</span>
        </span>
        <span className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="proxima__titulo">{c.titulo}{c.hora ? ` · ${c.hora}` : ''}</span>
          <span className="proxima__sub">{[quem(p), c.profissional, c.telefone].filter(Boolean).join(' · ')}</span>
          {destino && <span className="proxima__sub">{destino}</span>}
        </span>
      </div>
      {blocos.length > 0 && (
        <div className="proxima__blocos" style={{ gridTemplateColumns: `repeat(${compacto ? Math.min(blocos.length, 2) : blocos.length}, minmax(0, 1fr))` }}>
          {blocos.map((b) => (
            <div key={b.rotulo} className="proxima__bloco">
              <span className="proxima__bloco-rot">{b.rotulo}</span>
              {b.grande && <span className="proxima__bloco-grande">{b.grande}</span>}
              {b.linhas.map((l) => <span key={l} className={b.grande ? 'proxima__bloco-det' : undefined}>{l}</span>)}
            </div>
          ))}
        </div>
      )}
      <div className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/consulta/${c.id}/resumo`} className="proxima__btn proxima__btn--1">Abrir a ficha</Link>
        {destino && <a href={linkRota(c)} target="_blank" rel="noreferrer" className="proxima__btn proxima__btn--2">Como chegar</a>}
      </div>
    </section>
  );
}

/** "Depois": as consultas seguintes, uma por linha (data e hora, quem, o quê, quando). */
export function ConsultasDepois({ consultas, compacto }: { consultas: Consulta[]; compacto?: boolean }) {
  const { state } = useStore();
  if (!consultas.length) return null;
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')} style={{ gap: 0 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8 }}>
        <span className="info-card__titulo">Depois</span>
        <Link to="/agenda" style={{ fontWeight: 600, fontSize: 13 }}>Ver agenda</Link>
      </div>
      {consultas.map((c) => {
        const p = pessoa(state, c.pessoaId);
        return (
          <Link key={c.id} to={`/consulta/${c.id}/resumo`} className={cx('depois', compacto && 'depois--compacto')}>
            <span className="stack">
              <b>{DIAS_CURTOS[parseISO(c.data).getDay()]}, {diaMes(c.data)}</b>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.hora}</span>
            </span>
            {p && <Avatar pessoa={p} size={34} font={13} />}
            <span className="stack" style={{ minWidth: 0 }}>
              <b className="depois__titulo">{c.titulo}</b>
              <span className="depois__sub">{[quem(p), c.profissional, c.local].filter(Boolean).join(' · ')}</span>
            </span>
            {!compacto && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{distancia(c.data, HOJE)}</span>}
          </Link>
        );
      })}
    </section>
  );
}

function ItemRemedio({ r, varias, tracejado }: { r: Remedio; varias: boolean; tracejado?: boolean }) {
  const { state } = useStore();
  const [nome, conc] = separarConcentracao(r.nome);
  const det = [varias ? quem(pessoa(state, r.pessoaId)) : '', comDoseDoDia(r, HOJE).doseLonga ?? r.dose, resumoDias(r), r.observacao ?? (r.indicacao && minuscula(r.indicacao))].filter(Boolean).join(' · ');
  return (
    <Link to={`/remedios/${r.id}`} className={cx('horario__item', tracejado && 'horario__item--tracejado')}>
      <span className="horario__pilula" aria-hidden><PilulaDoRemedio r={r} tamanho={24} /></span>
      <span className="stack" style={{ minWidth: 0 }}>
        <span><b>{nome}</b>{conc && <span style={{ color: 'var(--text-2)' }}> {conc}</span>}</span>
        <span className="horario__det">{det}</span>
      </span>
    </Link>
  );
}

/** "Horários dos remédios": a hora à esquerda e, ao lado, os remédios dela (com o desenho do comprimido). */
export function HorariosRemedios({ remedios, compacto, onCadastrar }: { remedios: Remedio[]; compacto?: boolean; onCadastrar: () => void }) {
  const lista = remediosEmUso(remedios, HOJE);
  const { horarios, seNecessario } = horariosDoDia(lista);
  const varias = new Set(lista.map((r) => r.pessoaId)).size > 1;
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')} style={{ gap: 0 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8 }}>
        <span className="info-card__titulo">Horários dos remédios</span>
        {lista.length > 0 && <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{lista.length === 1 ? '1 remédio' : `${lista.length} remédios`}</span>}
      </div>
      {lista.length === 0 && (
        <div className="stack" style={{ gap: 10, alignItems: 'flex-start', paddingTop: 4 }}>
          <span className="muted" style={{ fontSize: 14 }}>Nenhum remédio em uso.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ minHeight: 44 }} onClick={onCadastrar}>Cadastrar remédio</button>
        </div>
      )}
      {horarios.map((h) => (
        <div key={h.hora} className="horario">
          <span className="horario__hora">{h.hora}</span>
          <div className="stack" style={{ gap: 6, minWidth: 0 }}>{h.remedios.map((r) => <ItemRemedio key={r.id} r={r} varias={varias} />)}</div>
        </div>
      ))}
      {seNecessario.length > 0 && (
        <div className="horario">
          <span className="horario__hora horario__hora--sn">Se precisar</span>
          <div className="stack" style={{ gap: 6, minWidth: 0 }}>{seNecessario.map((r) => <ItemRemedio key={r.id} r={r} varias={varias} tracejado />)}</div>
        </div>
      )}
    </section>
  );
}

/** "A família": de cada um, idade e tipo sanguíneo, alergias e condições; dos pets, o próximo cuidado. */
export function AFamilia({ pessoas, compacto }: { pessoas: Pessoa[]; compacto?: boolean }) {
  const { state } = useStore();
  const lista = emOrdem(state.pessoas, new Set(pessoas.map((p) => p.id)));
  if (!lista.length) return null;
  const remedios = remediosEmUso(state.remedios, HOJE);
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')}>
      <span className="info-card__titulo">{lista.length === 1 ? 'Saúde' : 'A família'}</span>
      {lista.map((p) => {
        const pet = p.tipo === 'pet';
        const anos = idade(p);
        const meta = [anos != null ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '', pet ? p.pet?.raca : p.sangue].filter(Boolean).join(' · ');
        const condicoes = p.condicoes.filter((c) => c.tipo === 'condicao');
        const seus = remedios.filter((r) => r.pessoaId === p.id);
        const doses = seus.reduce((n, r) => n + (r.seNecessario ? 0 : r.horarios.length), 0);
        const resumo = seus.length === 0 ? '' : doses === 0 ? 'se necessário' : doses === 1 ? '1 dose' : `${doses} doses`;
        const cuidado = pet ? proximosCuidados(state, p.id)[0] : undefined;
        return (
          <Link key={p.id} to={`/pessoa/${p.id}`} className="familia-linha">
            <Avatar pessoa={p} size={34} font={13} />
            <span className="stack" style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{quem(p)}{meta && <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 13 }}> · {meta}</span>}</span>
              {(p.alergias.length > 0 || condicoes.length > 0) && (
                <span className="familia-linha__chips">
                  {p.alergias.map((a) => <span key={`a-${a.substancia}`} className="pill pill--warn" style={{ fontWeight: 600 }} title={a.reacao}>Alergia{a.gravidade === 'grave' ? ' grave' : ''}: {a.substancia}</span>)}
                  {condicoes.map((c) => <span key={`c-${c.nome}`} className="pill pill--neutral">{c.nome}</span>)}
                </span>
              )}
              {cuidado && <span style={{ fontSize: 12, color: cuidado.vencido ? 'var(--warn-text)' : 'var(--text-2)' }}>{cuidado.titulo} · {cuidado.vencido ? 'vencido desde' : 'em'} {dataBR(cuidado.data).slice(0, 5)}</span>}
            </span>
            {resumo && <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 'none' }}>{resumo}</span>}
          </Link>
        );
      })}
    </section>
  );
}

/** Os exames mais recentes, com quantos valores ficaram fora da referência. */
export function ExamesRecentes({ exames, compacto }: { exames: Exame[]; compacto?: boolean }) {
  const { state } = useStore();
  const lista = examesRecentes(exames, 3);
  if (!lista.length) return null;
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="info-card__titulo">Exames recentes</span>
        <Link to="/exames" style={{ fontWeight: 600, fontSize: 13 }}>Ver exames</Link>
      </div>
      {lista.map((e) => {
        const fora = qtdForaDaFaixa(e);
        return (
          <Link key={e.id} to={`/exames/${e.id}`} className="info-exame">
            <span className="stack" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{e.nome}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{[quem(pessoa(state, e.pessoaId)), dataBR(e.dataColeta)].filter(Boolean).join(' · ')}</span>
            </span>
            {fora > 0 ? (
              <span className="pill pill--warn" style={{ flex: 'none', fontWeight: 600 }}>{fora === 1 ? '1 fora da faixa' : `${fora} fora da faixa`}</span>
            ) : e.resultados?.length ? (
              <span className="pill pill--teal" style={{ flex: 'none' }}>tudo na faixa</span>
            ) : null}
          </Link>
        );
      })}
    </section>
  );
}
