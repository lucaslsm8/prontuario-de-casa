// Simulador de reembolso (folha no celular, diálogo no desktop). Lógica em src/data/reembolso.ts.
import { useState, type ReactNode } from 'react';
import { editaveis, pessoa, useStore } from '../data/store';
import {
  FONTE_SULAMERICA, PRODUTOS_SULAMERICA, buscarServicos, ehSulAmerica, gradeDoPlano, lerReais, reais, simular, tetoReembolso, type ServicoReembolso,
} from '../data/reembolso';
import type { Plano } from '../data/types';
import { useLayout } from '../layout';
import { DDialogo } from '../desktop/Formulario';
import { cx } from '.';

function Moldura({ titulo, desktop, onClose, children }: { titulo: string; desktop: boolean; onClose: () => void; children: ReactNode }) {
  if (desktop) return <DDialogo titulo={titulo} largura={560} onClose={onClose}>{children}</DDialogo>;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet reembolso" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{titulo}</span>
          <button type="button" className="btn btn--h36" onClick={onClose} style={{ color: 'var(--teal)' }}>Fechar</button>
        </div>
        {children}
      </div>
    </>
  );
}

/** `servicoInicial`: chave do serviço já escolhido (ex.: a consulta aberta na ficha). */
export function SimuladorReembolso({ plano, servicoInicial, pagoInicial, onClose }: { plano: Plano; servicoInicial?: string; pagoInicial?: number; onClose: () => void }) {
  const { state, api } = useStore();
  const { layout } = useLayout();
  const desktop = layout === 'desktop';
  const pode = editaveis(state).some((p) => p.id === plano.pessoaId);
  const [busca, setBusca] = useState('');
  const [servico, setServico] = useState<ServicoReembolso | undefined>(() => buscarServicos('').find((s) => s.chave === servicoInicial));
  const [pagoTexto, setPagoTexto] = useState(pagoInicial ? String(pagoInicial).replace('.', ',') : '');
  const [tetoTexto, setTetoTexto] = useState('');
  const sul = ehSulAmerica(plano);
  const grade = gradeDoPlano(plano);
  const teto = servico ? tetoReembolso(servico, plano) : undefined;
  const tetoManual = lerReais(tetoTexto);
  const valorTeto = teto?.valor ?? tetoManual;
  const pago = lerReais(pagoTexto);
  const r = pago != null && valorTeto != null ? simular(pago, valorTeto) : undefined;
  const nome = pessoa(state, plano.pessoaId)?.curto;

  const salvarGrade = (g: number) => api.editar('planos', plano.id, { reembolso: { ...plano.reembolso, grade: g } }, `Grade ${g} salva no plano`);
  const salvarTeto = () => {
    if (!servico || tetoManual == null) return;
    api.editar('planos', plano.id, { reembolso: { ...plano.reembolso, valores: { ...plano.reembolso?.valores, [servico.chave]: tetoManual } } }, 'Valor guardado no plano');
    setTetoTexto('');
  };
  const esquecer = () => {
    if (!servico || !plano.reembolso?.valores) return;
    const { [servico.chave]: _, ...resto } = plano.reembolso.valores;
    api.editar('planos', plano.id, { reembolso: { ...plano.reembolso, valores: resto } }, 'Valor removido');
  };
  const input = cx('input', desktop && 'input--desk');
  const lista = buscarServicos(busca).slice(0, busca ? 8 : 6);

  return (
    <Moldura titulo="Simular reembolso" desktop={desktop} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {plano.operadora}{plano.produto ? ` · ${plano.produto}` : ''}{nome ? ` · ${nome}` : ''}{grade ? ` · grade ${grade}` : ''}
        </span>

        {sul && !grade && (
          <label className="stack" style={{ gap: 6 }}>
            <span className="field__label">Qual é o seu produto? (está na carteirinha)</span>
            <select className={input} value="" onChange={(e) => pode && salvarGrade(Number(e.target.value))} disabled={!pode}>
              <option value="" disabled>Escolha o produto</option>
              {PRODUTOS_SULAMERICA.map((x) => <option key={x.nome} value={x.grade}>{x.nome} · grade {x.grade}</option>)}
            </select>
          </label>
        )}

        {!servico ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="field__label">O que você fez?</span>
            <input className={input} autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: psicólogo, consulta, fisioterapia" aria-label="Buscar serviço" />
            <div className="card" style={{ fontSize: 15 }}>
              {lista.map((s) => (
                <button key={s.chave} type="button" className="row" style={{ padding: '10px 14px', textAlign: 'left' }} onClick={() => setServico(s)}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span>{s.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.grupo}{s.codigo ? ` · TUSS ${s.codigo}` : ''}</span>
                  </span>
                  <span className="chev">›</span>
                </button>
              ))}
              {lista.length === 0 && <span style={{ padding: '10px 14px', color: 'var(--text-2)' }}>Nada encontrado. Tente "consulta" ou "terapia".</span>}
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <b>{servico.nome}</b>
                {servico.codigo && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>TUSS {servico.codigo}</span>}
              </span>
              <button type="button" className="btn btn--h36" style={{ color: 'var(--teal)', flex: 'none' }} onClick={() => { setServico(undefined); setTetoTexto(''); }}>Trocar</button>
            </div>

            <label className="stack" style={{ gap: 6 }}>
              <span className="field__label">Quanto você pagou?</span>
              <input className={cx(input, 'input--mono')} inputMode="decimal" autoFocus value={pagoTexto} onChange={(e) => setPagoTexto(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="300,00" aria-label="Valor pago em reais" />
            </label>

            {teto?.valor != null ? (
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                O plano reembolsa até <b style={{ color: 'var(--ink)' }}>{reais(teto.valor)}</b> por isso
                {teto.origem === 'tabela' ? ` (${FONTE_SULAMERICA}, grade ${teto.grade}).` : ' (valor que você informou).'}
                {teto.origem === 'plano' && pode && <button type="button" className="btn--link" style={{ marginLeft: 6, fontSize: 13 }} onClick={esquecer}>Mudar</button>}
              </span>
            ) : (
              <div className="card" style={{ padding: '12px 14px', gap: 8, background: 'var(--sol-light)', borderColor: 'transparent' }}>
                <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                  {servico.valores && grade && !servico.valores[grade - 1]
                    ? `Na tabela da SulAmérica, a grade ${grade} não tem reembolso para isso. Se o seu contrato tiver, informe o valor:`
                    : 'Essa tabela não tem o valor desse serviço. Quanto o seu plano reembolsa por ele? Veja no app da operadora (Reembolso › Prévia) ou no contrato.'}
                </span>
                <div className="hstack" style={{ gap: 8 }}>
                  <input className={cx(input, 'input--mono')} style={{ flex: 1 }} inputMode="decimal" value={tetoTexto} onChange={(e) => setTetoTexto(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Valor do reembolso" aria-label="Reembolso do plano em reais" />
                  {pode && <button type="button" className={cx('btn btn--soft', desktop ? 'btn--h40d' : 'btn--h40')} disabled={tetoManual == null} onClick={salvarTeto}>Guardar no plano</button>}
                </div>
              </div>
            )}

            {r && (
              <div className="card reembolso__resultado">
                <span className="label">Você recebe</span>
                <span className="reembolso__valor">{reais(r.reembolso)}</span>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
                  {r.porConta > 0 ? <>Fica por sua conta <b style={{ color: 'var(--ink)' }}>{reais(r.porConta)}</b> · {r.pct}% de volta</> : 'O plano cobre tudo o que você pagou.'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>Estimativa. A coparticipação e os critérios técnicos da operadora podem mudar o valor final.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Moldura>
  );
}
