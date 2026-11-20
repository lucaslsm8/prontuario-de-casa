// Frequência além dos horários: em que dias toma, desmame e validade da receita.
// Formulário (celular e desktop) e o aviso de receita vencendo na tela do remédio.
import { useId, useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { pesoAtual } from '../data/pets';
import { avisoPeso } from '../data/porPeso';
import { HOJE } from '../data/tempo';
import { DIAS_CURTOS, avisoReceita, diasParaVencerReceita } from '../data/frequencia';
import type { FormRemedio } from '../data/formularios';
import type { Remedio } from '../data/types';
import { CampoData } from './CampoData';
import { cx } from '.';

/** Aviso na tela do remédio: receita vencida ou vencendo nos próximos 7 dias. */
export function AvisoReceita({ r }: { r: Remedio }) {
  const texto = avisoReceita(r, HOJE);
  if (!texto || !r.ativo) return null;
  const vencida = (diasParaVencerReceita(r, HOJE) ?? 0) < 0;
  return (
    <div className="card card--warn" role="status" style={{ padding: '12px 14px', gap: 4 }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--warn-text)' }}>RECEITA</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--warn-strong)' }}>{texto}</span>
      <span style={{ fontSize: 12, color: 'var(--warn-text)' }}>{vencida ? 'Peça uma receita nova ao médico antes de comprar mais.' : 'Peça uma receita nova ao médico.'}</span>
    </div>
  );
}

function Grupo({ rotulo, desktop, children }: { rotulo: string; desktop?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div className={desktop ? 'dfield dfield--span2' : 'field'} style={{ gap: 8 }} role="group" aria-labelledby={id}>
      <span id={id} className={desktop ? 'dfield__label' : 'field__label'}>{rotulo}</span>
      {children}
    </div>
  );
}

const MODOS = [
  { id: 'todo', nome: 'Todo dia' },
  { id: 'semana', nome: 'Dias da semana' },
  { id: 'alternado', nome: 'Dia sim, dia não' },
  { id: 'semanal', nome: '1x por semana' },
  { id: 'cada', nome: 'A cada N dias' },
] as const;

/** Quais dias, desmame e validade da receita. `desktop`: dentro de DGrade. Não aparece no "se necessário". */
export function CamposDias({ f, desktop }: { f: FormRemedio; desktop?: boolean }) {
  const chip = cx('chip', desktop ? 'chip--xs' : 'chip--sm');
  const input = cx('input input--mono', desktop && 'input--desk');
  const seNecessario = f.freq.id === 'sn';
  return (
    <>
      {!seNecessario && (
        <Grupo rotulo="Quais dias" desktop={desktop}>
          <div className="chips" style={{ flexWrap: 'wrap', gap: 6 }}>
            {MODOS.map((m) => (
              <button key={m.id} type="button" className={cx(chip, f.modoDias === m.id && 'is-dark')} aria-pressed={f.modoDias === m.id} onClick={() => f.setModoDias(m.id)}>{m.nome}</button>
            ))}
          </div>
          {f.modoDias === 'semana' && (
            <div className="chips" style={{ gap: 6 }} aria-label="Dias da semana">
              {DIAS_CURTOS.map((d, i) => (
                <button key={d} type="button" className={cx(chip, f.semana.includes(i) && 'is-teal')} style={{ minWidth: 44 }} aria-pressed={f.semana.includes(i)} onClick={() => f.alternarDiaSemana(i)}>{d}</button>
              ))}
            </div>
          )}
          {f.modoDias === 'cada' && (
            <span className="hstack" style={{ gap: 8, alignItems: 'center', fontSize: 15 }}>
              A cada
              <input className={input} style={{ width: 72 }} inputMode="numeric" value={f.cadaDias} onChange={(e) => f.setCadaDias(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="A cada quantos dias" />
              dias
            </span>
          )}
          {f.modoDias !== 'todo' && f.textoDias && <span className="muted" style={{ fontSize: 13 }}>{f.textoDias.charAt(0).toUpperCase() + f.textoDias.slice(1)}.</span>}
          {!f.diasValidos && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{f.modoDias === 'semana' ? 'Escolha pelo menos um dia.' : 'De 2 a 365 dias.'}</span>}
        </Grupo>
      )}
      {!seNecessario && (
        <Grupo rotulo="Desmame (a dose diminui)" desktop={desktop}>
          {f.desmame.length === 0 ? (
            <button type="button" className={cx('btn', desktop ? 'btn--h36' : 'btn--soft btn--h36')} style={{ alignSelf: 'flex-start' }} onClick={f.comecarDesmame}>Montar desmame</button>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {f.desmame.map((e, i) => (
                <span key={i} className="hstack" style={{ gap: 8, alignItems: 'center', fontSize: 15, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ width: 22, color: 'var(--text-2)' }}>{i + 1}.</span>
                  <input className={input} style={{ width: 64 }} inputMode="decimal" value={e.qtd} onChange={(ev) => f.mudarEtapa(i, { qtd: ev.target.value.replace(/[^0-9,./½]/g, '') })} aria-label={`Etapa ${i + 1}: quantidade por dose`} />
                  {f.nomeForma(e.qtd)} por
                  <input className={input} style={{ width: 64 }} inputMode="numeric" value={e.dias} onChange={(ev) => f.mudarEtapa(i, { dias: ev.target.value.replace(/\D/g, '').slice(0, 3) })} aria-label={`Etapa ${i + 1}: dias`} />
                  dias
                  <button type="button" className="btn btn--h36" style={{ color: 'var(--text-2)' }} onClick={() => f.tirarEtapa(i)} aria-label={`Tirar a etapa ${i + 1}`}>Tirar</button>
                </span>
              ))}
              <span className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--h36" onClick={f.addEtapa}>Mais uma etapa</button>
              </span>
              {f.desmameValido
                ? <span className="muted" style={{ fontSize: 13 }}>Termina em {f.fimDesmameBR}. A dose de cada dia aparece no Início e nos lembretes.</span>
                : <span style={{ fontSize: 13, color: 'var(--danger)' }}>Cada etapa com a quantidade (como 1 ou ½) e os dias.</span>}
            </div>
          )}
        </Grupo>
      )}
      <Grupo rotulo="Receita vale até (opcional)" desktop={desktop}>
        <CampoData className={input} rotulo="Receita vale até" valor={f.validadeReceita} onChange={f.setValidadeReceita} />
        {f.validadeReceita && <span className="muted" style={{ fontSize: 13 }}>O app avisa 7 dias antes de vencer.</span>}
      </Grupo>
    </>
  );
}

/** "Calcular pela dose por peso": mg/kg e mg por unidade → a quantidade sugerida (o botão põe na dose). Só com o peso de quem toma. */
export function CamposPorPeso({ f, desktop }: { f: FormRemedio; desktop?: boolean }) {
  const [aberto, setAberto] = useState(!!f.mgKg);
  if (!f.pesoKg) return null;
  const input = cx('input input--mono', desktop && 'input--desk');
  const kg = String(Math.round(f.pesoKg * 10) / 10).replace('.', ',');
  const unidade = f.forma === 'ml' ? 'mL' : f.forma === 'gota' ? 'gota' : f.forma === 'capsula' ? 'cápsula' : 'comprimido';
  if (!aberto) {
    return (
      <div className={desktop ? 'dfield dfield--span2' : undefined}>
        <button type="button" className="btn--link" style={{ fontSize: 14, minHeight: 44 }} onClick={() => setAberto(true)}>Calcular a dose pelo peso ({kg} kg)</button>
      </div>
    );
  }
  return (
    <Grupo rotulo={`Dose por peso · ${kg} kg hoje`} desktop={desktop}>
      <span className="hstack" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 15 }}>
        <input className={input} style={{ width: 80 }} inputMode="decimal" value={f.mgKg} onChange={(e) => f.setMgKg(e.target.value.replace(/[^0-9,.]/g, ''))} aria-label="mg por kg" placeholder="5" />
        mg/kg · {unidade} de
        <input className={input} style={{ width: 80 }} inputMode="decimal" value={f.mgUnidade} onChange={(e) => f.setMgUnidade(e.target.value.replace(/[^0-9,.]/g, ''))} aria-label={`mg por ${unidade}`} placeholder="50" />
        mg
      </span>
      {f.calculo && (
        <span className="hstack" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
          <span>{String(f.calculo.mg).replace('.', ',')} mg = <b>{String(f.calculo.exata).replace('.', ',')}</b> {unidade}{f.calculo.exata !== f.calculo.qtd ? `, arredondando: ${String(f.calculo.qtd).replace('.', ',')}` : ''}</span>
          <button type="button" className={cx('btn', desktop ? 'btn--outline btn--h36' : 'btn--soft btn--h36')} onClick={f.usarCalculo}>Usar na dose</button>
        </span>
      )}
      <span className="muted" style={{ fontSize: 12 }}>Só uma conta para conferir a receita: a dose é a que o veterinário ou o médico passou. Se o peso mudar mais de 10%, a tela do remédio avisa.</span>
    </Grupo>
  );
}

/** Aviso na tela do remédio: o peso mudou desde a conta da dose. */
export function AvisoPorPeso({ r }: { r: Remedio }) {
  const { state, completo } = useStore();
  const p = state.pessoas.find((x) => x.id === r.pessoaId);
  const kg = (p?.tipo === 'pet' ? pesoAtual(completo ?? state, r.pessoaId)?.kg : undefined) ?? p?.peso;
  const texto = avisoPeso(r, kg);
  if (!texto) return null;
  return (
    <div className="card card--warn" role="status" style={{ padding: '12px 14px', gap: 4 }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--warn-text)' }}>DOSE POR PESO</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--warn-strong)' }}>{texto}</span>
    </div>
  );
}
