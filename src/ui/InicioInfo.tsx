// Início no modo só de informações (Configurações): o que cada um toma, como é e a que horas, sem marcar doses.
// Usado no desktop (painel da família) e no celular (perfil aberto ou "Família toda").
import { Link } from 'react-router-dom';
import { pessoa, useStore } from '../data/store';
import { dataBR, quem } from '../data/format';
import { examesRecentes, remediosEmUso, separarConcentracao, textoHorarios } from '../data/inicio';
import { qtdForaDaFaixa } from '../data/resultados';
import { HOJE } from '../data/tempo';
import type { Exame, Pessoa, Remedio } from '../data/types';
import { Avatar, cx } from '.';
import { PilulaDoRemedio } from './Pilula';

/** Pessoas na ordem do app (você primeiro, depois a família e os pets), só as que aparecem em `ids`. */
function emOrdem(pessoas: Pessoa[], ids: Set<string>) {
  const lista = pessoas.filter((p) => ids.has(p.id));
  return [...lista.filter((p) => p.souEu), ...lista.filter((p) => !p.souEu && p.tipo !== 'pet'), ...lista.filter((p) => p.tipo === 'pet')];
}

/** "Hipotireoidismo" → "Para hipotireoidismo"; siglas ("DPOC") ficam como estão. */
function paraQueServe(indicacao: string) {
  const t = indicacao.trim().replace(/^para\s+/i, '');
  return `Para ${/^[A-ZÀ-Ú][a-zà-ú]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t}`;
}

function LinhaRemedio({ r, compacto }: { r: Remedio; compacto?: boolean }) {
  const [nome, conc] = separarConcentracao(r.nome);
  const detalhe = [r.doseLonga ?? r.dose, r.observacao].filter(Boolean).join(' · ');
  const horarios = r.seNecessario || !r.horarios.length ? [textoHorarios(r)] : [...r.horarios].sort();
  return (
    <Link to={`/remedios/${r.id}`} className={cx('info-rem', compacto && 'info-rem--compacto')}>
      <span className="info-rem__pilula" aria-hidden>
        <PilulaDoRemedio r={r} tamanho={compacto ? 28 : 32} />
      </span>
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <span className="info-rem__nome">{nome}{conc && <span className="info-rem__conc"> {conc}</span>}</span>
        {detalhe && <span className="info-rem__det">{detalhe}</span>}
        {r.indicacao && <span className="info-rem__para">{paraQueServe(r.indicacao)}</span>}
        {compacto && (
          <span className="info-rem__horas">{horarios.map((h) => <span key={h} className="info-rem__hora">{h}</span>)}</span>
        )}
      </span>
      {!compacto && (
        <span className="info-rem__horas info-rem__horas--lado">{horarios.map((h) => <span key={h} className="info-rem__hora">{h}</span>)}</span>
      )}
    </Link>
  );
}

/** "Remédios em uso": por pessoa, com o desenho do comprimido, a dose, para que serve e os horários. */
export function RemediosEmUso({ remedios, compacto, onCadastrar }: { remedios: Remedio[]; compacto?: boolean; onCadastrar: () => void }) {
  const { state } = useStore();
  const lista = remediosEmUso(remedios, HOJE);
  const pessoas = emOrdem(state.pessoas, new Set(lista.map((r) => r.pessoaId)));
  const variasPessoas = pessoas.length > 1;
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="info-card__titulo">Remédios em uso</span>
        {lista.length > 0 && <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{lista.length === 1 ? '1 remédio' : `${lista.length} remédios`}</span>}
      </div>
      {lista.length === 0 ? (
        <div className="stack" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span className="muted" style={{ fontSize: 14 }}>Nenhum remédio em uso.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ minHeight: 44 }} onClick={onCadastrar}>Cadastrar remédio</button>
        </div>
      ) : (
        pessoas.map((p) => (
          <div key={p.id} className="info-rem__grupo">
            {variasPessoas && (
              <span className="info-rem__pessoa">
                <Avatar pessoa={p} size={24} font={10} />
                {quem(p)}
              </span>
            )}
            {lista.filter((r) => r.pessoaId === p.id).map((r) => <LinhaRemedio key={r.id} r={r} compacto={compacto} />)}
          </div>
        ))
      )}
    </section>
  );
}

/** Alergias e condições de quem aparece no Início: o que é bom ter à vista. Some quando ninguém tem nada. */
export function AlergiasCondicoes({ pessoas, compacto }: { pessoas: Pessoa[]; compacto?: boolean }) {
  const { state } = useStore();
  const com = emOrdem(state.pessoas, new Set(pessoas.map((p) => p.id))).filter(
    (p) => p.alergias.length || p.condicoes.some((c) => c.tipo === 'condicao'),
  );
  if (!com.length) return null;
  const varias = com.length > 1;
  return (
    <section className={cx('card info-card', compacto && 'info-card--compacto')}>
      <span className="info-card__titulo">Alergias e condições</span>
      {com.map((p) => (
        <Link key={p.id} to={`/pessoa/${p.id}`} className="info-saude">
          {varias && <span className="info-rem__pessoa"><Avatar pessoa={p} size={24} font={10} />{quem(p)}</span>}
          <span className="info-saude__chips">
            {p.alergias.map((a) => (
              <span key={`a-${a.substancia}`} className="pill pill--warn" title={a.reacao}>Alergia: {a.substancia}</span>
            ))}
            {p.condicoes.filter((c) => c.tipo === 'condicao').map((c) => (
              <span key={`c-${c.nome}`} className="pill pill--neutral">{c.nome}</span>
            ))}
          </span>
        </Link>
      ))}
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
            {fora > 0 && <span className="pill pill--warn" style={{ flex: 'none' }}>{fora === 1 ? '1 fora da faixa' : `${fora} fora da faixa`}</span>}
          </Link>
        );
      })}
    </section>
  );
}
