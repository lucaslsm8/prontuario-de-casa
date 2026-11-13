// Peças do Início (redesign "cartão escuro"), usadas no desktop (D01) e no celular (M03).
import { useRef, useState } from 'react';
import { doMeuCuidado, dosesHoje, marcaDose, useStore, type DoseHoje } from '../data/store';
import { addDias, dataBR, diasDeEstoque, estoqueBaixo, pctEstoque, quem, textoEstoque } from '../data/format';
import { HOJE } from '../data/tempo';
import { useAgora } from '../data/useAgora';
import { chaveDose, doseEmFoco, estadoDose, hhmm, minutos, posDia, separarConcentracao, type Adiadas } from '../data/inicio';
import { agruparFamiliaPets } from '../data/pets';
import type { Remedio } from '../data/types';
import { Avatar, SecaoLista, cx } from '.';
import { IcCheck, IcDesfazer, IcPular, IcSino } from './Icones';
import { CompreiMais } from './Estoque';
import { Pilula, PilulaDoRemedio, useFotoComprimido } from './Pilula';

/** Estado do Início: doses de hoje, a da vez e as ações do cartão. */
export function useDoseDaVez() {
  const { state, api, perfil } = useStore();
  const agora = useAgora();
  // "Lembrar em 15 min" vale só nesta tela; o lembrete do sistema tem o seu próprio "15 min".
  const [adiadas, setAdiadas] = useState<Adiadas>({});
  // Início da família toda: você, os pets e de quem você cuida. No perfil de alguém (celular), o recorte já é dele.
  const doses = dosesHoje(state).filter((d) => perfil || doMeuCuidado(state, d.pessoa.id));
  // O cartão grande só oferece doses que você pode marcar (cuidador inclui).
  const foco = doseEmFoco(doses.filter((d) => marcaDose(state, d.pessoa.id)), agora, adiadas);
  const adiar = () => {
    if (!foco) return;
    const k = chaveDose(foco.dose);
    const ate = agora + 15;
    setAdiadas((a) => ({ ...a, [k]: ate }));
    api.toast({
      texto: `Vou lembrar às ${hhmm(ate)}`,
      desfazer: () => setAdiadas(({ [k]: _, ...resto }) => resto),
    });
  };
  return {
    doses,
    agora,
    foco,
    tomei: () => foco && api.marcarDose(foco.dose.remedio.id, foco.dose.horario),
    pular: () => foco && api.marcarDose(foco.dose.remedio.id, foco.dose.horario, 'pulada'),
    adiar,
  };
}
type DaVez = ReturnType<typeof useDoseDaVez>;

/** O comprimido ao lado do nome, para conferir antes de tocar Tomei (só com desenho ou foto). */
function HeroPilula({ r }: { r: Remedio }) {
  const foto = useFotoComprimido(r.id);
  if (!r.aparencia && !foto) return null;
  return <span className="hero__pilula"><Pilula aparencia={r.aparencia} foto={foto} /></span>;
}

function NomeDose({ nome }: { nome: string }) {
  const [n, conc] = separarConcentracao(nome);
  return <>{n}{conc && <span className="hero__conc"> {conc}</span>}</>;
}

/** Cartão escuro com a dose da vez: Tomei / Lembrar em 15 min / Pular. */
export function CartaoDose({ dv, compacto, onCadastrar }: { dv: DaVez; compacto?: boolean; onCadastrar: () => void }) {
  const { foco, doses } = dv;
  if (!foco) {
    const nenhuma = doses.length === 0;
    const primeira = [...doses].sort((a, b) => a.horario.localeCompare(b.horario))[0];
    return (
      <section className={cx('hero hero--vazio', compacto && 'hero--compacto')}>
        <span className="hero__ok"><IcCheck size={compacto ? 26 : 34} /></span>
        <span className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
          <span className="hero__titulo-vazio">{nenhuma ? 'Nenhum remédio com horário hoje' : 'Tudo em dia hoje'}</span>
          {nenhuma ? (
            <button type="button" className="hero__btn hero__btn--2" onClick={onCadastrar}>Cadastrar remédio</button>
          ) : (
            <span className="hero__sub">A próxima dose é amanhã às {primeira.horario} · {separarConcentracao(primeira.remedio.nome)[0]}</span>
          )}
        </span>
      </section>
    );
  }
  const { dose: d, tom, rotulo } = foco;
  const adiar = (
    <button type="button" className="hero__btn hero__btn--2" onClick={dv.adiar}><IcSino />Lembrar em 15 min</button>
  );
  const pular = (
    <button type="button" className="hero__btn hero__btn--3" onClick={dv.pular}><IcPular />Pular</button>
  );
  return (
    <section key={chaveDose(d)} className={cx('hero', compacto && 'hero--compacto')} aria-live="polite">
      <span className="hero__anel" aria-hidden />
      <span className={cx('hero__rotulo', `hero__rotulo--${tom}`)}><span className="hero__ponto" />{rotulo}</span>
      <div className="hero__linha">
        <span className="hero__hora">{d.horario}</span>
        <HeroPilula r={d.remedio} />
        <span className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="hero__nome"><NomeDose nome={d.remedio.nome} /></span>
          <span className="hero__sub"><strong>{quem(d.pessoa)}</strong> · {d.remedio.dose}</span>
        </span>
      </div>
      {compacto ? (
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="hero__btn hero__btn--1 hero__btn--largo" onClick={dv.tomei}><IcCheck />Tomei</button>
          <div className="hstack" style={{ gap: 8 }}>{adiar}{pular}</div>
        </div>
      ) : (
        <div className="hstack" style={{ gap: 10 }}>
          <button type="button" className="hero__btn hero__btn--1" onClick={dv.tomei}><IcCheck />Tomei</button>
          {adiar}
          {pular}
        </div>
      )}
    </section>
  );
}

/** Linha do dia 06:00–22:00, com o "agora" e um ponto por dose. */
export function LinhaDia({ doses, agora, compacto }: { doses: DoseHoje[]; agora: number; compacto?: boolean }) {
  const pos = posDia(agora);
  const marcas = compacto ? [['06h', 0], ['22h', 100]] as const : [['06:00', 0], ['10:00', 25], ['18:00', 75], ['22:00', 100]] as const;
  return (
    <div className={cx('linha-dia', compacto && 'linha-dia--compacta')} role="img" aria-label={`Linha do dia, agora ${hhmm(agora)}`}>
      <span className="linha-dia__trilho" />
      <span className="linha-dia__passado" style={{ width: `${pos}%` }} />
      <span className="linha-dia__agora" style={{ left: `${pos}%` }} />
      <span className="linha-dia__etiqueta" style={{ left: `${pos}%` }}>{compacto ? hhmm(agora) : `Agora ${hhmm(agora)}`}</span>
      {doses.map((d) => (
        <span key={chaveDose(d)} className={`linha-dia__ponto linha-dia__ponto--${estadoDose(d, agora)}`} style={{ left: `${posDia(minutos(d.horario))}%` }} />
      ))}
      {marcas.map(([t, p]) => (
        <span key={t} className="linha-dia__marca" style={{ left: `${p}%` }}>{t}</span>
      ))}
    </div>
  );
}

/** Lista "Doses de hoje", separada em Pessoas e Pets. */
export function ListaDoses({ doses, agora, compacto }: { doses: DoseHoje[]; agora: number; compacto?: boolean }) {
  const { state, api } = useStore();
  const g = agruparFamiliaPets(doses, state, (d) => d.pessoa.id);
  const linha = (d: DoseHoje) => {
    const e = estadoDose(d, agora);
    const [nome, conc] = separarConcentracao(d.remedio.nome);
    return (
      <div key={chaveDose(d)} className={cx('dose-linha', `dose-linha--${e}`)}>
        <span className="dose-linha__hora">{d.horario}</span>
        <Avatar pessoa={d.pessoa} size={compacto ? 30 : 34} font={compacto ? 11 : 12} />
        <span className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span className="dose-linha__nome" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <PilulaDoRemedio r={d.remedio} tamanho={20} estado={d.dose?.status === 'tomada' ? 'contorno' : 'cheio'} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}{conc && !compacto && <span className="dose-linha__conc"> {conc}</span>}</span>
          </span>
          <span className="dose-linha__quem">{quem(d.pessoa)}{d.pessoa.tipo === 'pet' ? ` · ${d.remedio.dose}` : ''}</span>
        </span>
        {d.dose ? (
          <>
            <span className={cx('pill pill--lg', d.dose.status === 'tomada' ? 'pill--teal' : 'pill--neutral')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
              {d.dose.status !== 'tomada' ? 'Pulada' : compacto ? <><IcCheck size={12} />{d.dose.registradoEm}</> : `Tomada às ${d.dose.registradoEm}`}
            </span>
            {marcaDose(state, d.pessoa.id) && (
              <button type="button" className="dose-linha__desfazer" aria-label={`Desfazer ${nome} das ${d.horario}`} onClick={() => api.desfazerDose(d.remedio.id, d.horario)}>
                <IcDesfazer />
              </button>
            )}
          </>
        ) : marcaDose(state, d.pessoa.id) ? (
          <button type="button" className="btn btn--teal dose-linha__tomei" onClick={() => api.marcarDose(d.remedio.id, d.horario)}>Tomei</button>
        ) : (
          <span className="pill pill--neutral" style={{ flex: 'none' }}>pendente</span>
        )}
      </div>
    );
  };
  const comPets = g.pets.length > 0;
  return (
    <div className="stack">
      {comPets && <SecaoLista rotulo="Pessoas" style={{ padding: '4px 0 2px' }} />}
      {g.familia.map(linha)}
      {comPets && <><SecaoLista rotulo="Pets" style={{ padding: '10px 0 2px' }} />{g.pets.map(linha)}</>}
    </div>
  );
}

/**
 * O primeiro remédio ativo com estoque baixo. Depois de "Comprei mais" o mesmo remédio
 * continua no cartão (agora em dia) até sair do Início, para os blocos encherem à vista.
 */
export function useRemedioAcabando(remedios: Remedio[]) {
  const visto = useRef<string>();
  const baixo = remedios.find((r) => r.ativo && estoqueBaixo(r));
  if (baixo) visto.current = baixo.id;
  return baixo ?? remedios.find((r) => r.id === visto.current && r.ativo);
}

/** "Remédio acabando": 10 blocos e "Comprei mais". */
export function RemedioAcabando({ r, compacto }: { r: Remedio; compacto?: boolean }) {
  const dias = diasDeEstoque(r) ?? 0;
  const baixo = estoqueBaixo(r);
  const cheios = Math.ceil(pctEstoque(r) / 10);
  const [nome, conc] = separarConcentracao(r.nome);
  const comprar = <CompreiMais r={r} className="btn btn--outline acabando__comprar" />;
  if (compacto) {
    return (
      <div className={cx('acabando acabando--compacto', baixo && 'is-baixo')}>
        <span className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{nome}</span>
          <span className="acabando__dias">{dias === 1 ? '1 dia' : `${dias} dias`} de estoque</span>
        </span>
        {comprar}
      </div>
    );
  }
  return (
    <section className={cx('card acabando', baixo && 'is-baixo')}>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <span className="acabando__rotulo">{baixo ? 'ACABANDO' : 'ESTOQUE EM DIA'}</span>
        <span className="pill acabando__pill">{dias === 1 ? '1 dia' : `${dias} dias`}</span>
      </div>
      <span style={{ fontWeight: 600, fontSize: 16 }}>{nome}{conc && <span style={{ fontWeight: 400, color: 'var(--text-2)' }}> {conc}</span>}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{textoEstoque(r)} · acaba em {dataBR(addDias(HOJE, dias)).slice(0, 5)}</span>
      <div className="acabando__blocos" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx(i < cheios && 'is-cheio')} style={{ transitionDelay: `${i * 25}ms` }} />
        ))}
      </div>
      {comprar}
    </section>
  );
}
