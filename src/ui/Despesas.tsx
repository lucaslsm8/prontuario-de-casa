// Despesas de saúde e resumo para o Imposto de Renda. A mesma tela no celular (/despesas) e no
// desktop (Configurações › Despesas e IR). Lógica em src/data/despesas.ts e useFormDespesa.
import { useState } from 'react';
import { HOJE } from '../data/tempo';
import { editaveis, podeVer, useStore } from '../data/store';
import { TIPOS_DESPESA, anosComDespesa, csvIR, dedutivel, nomeTipoDespesa, resumoIR, semDocumento } from '../data/despesas';
import { useFormDespesa } from '../data/formularios';
import { reais } from '../data/reembolso';
import { exportarTexto } from '../data/anexos';
import { dataBR, quem } from '../data/format';
import { opcoesPessoas } from '../data/pets';
import type { Despesa } from '../data/types';
import { CampoData } from './CampoData';
import { ChipGroup, Label, cx } from '.';

function Campo({ rotulo, erro, children, largo }: { rotulo: string; erro?: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className="stack" style={{ gap: 4, gridColumn: largo ? '1 / -1' : undefined, minWidth: 0 }}>
      <span className="field__label">{rotulo}</span>
      {children}
      {erro && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{erro}</span>}
    </label>
  );
}

/** Formulário da despesa (dentro de um cartão). `base`: pré-preenchido a partir de uma consulta. */
export function FormDespesa({ inicial, base, onFim, desktop }: { inicial?: Despesa; base?: Partial<Despesa>; onFim: () => void; desktop?: boolean }) {
  const { state } = useStore();
  const f = useFormDespesa(onFim, inicial, base);
  const [mostrarErros, setMostrarErros] = useState(false);
  const input = cx('input', desktop && 'input--desk');
  const pessoas = opcoesPessoas(editaveis(state), quem);
  const e: Partial<typeof f.erros> = mostrarErros ? f.erros : {};
  return (
    <form className="card" style={{ padding: 16, gap: 12 }} onSubmit={(ev) => { ev.preventDefault(); setMostrarErros(true); f.salvar(); }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{f.editando ? 'Editar despesa' : 'Nova despesa'}</span>
      <div className="stack" style={{ gap: 6 }}>
        <span className="field__label">De quem</span>
        <ChipGroup tamanho="sm" {...pessoas} valor={f.para} onChange={f.setPara} />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="field__label">O que foi</span>
        <ChipGroup tamanho="sm" opcoes={TIPOS_DESPESA.map((t) => ({ id: t.id, nome: t.nome }))} valor={f.tipo} onChange={f.setTipo} />
        {!TIPOS_DESPESA.find((t) => t.id === f.tipo)?.dedutivel && <span className="muted" style={{ fontSize: 12 }}>Não entra como dedução no IR; fica no total gasto.</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 12 }}>
        <Campo rotulo="Quem recebeu" erro={e.prestador} largo>
          <input className={input} list="sug-prestador" value={f.prestador} onChange={(x) => f.setPrestador(x.target.value)} placeholder="Ex.: Dra. Marta Lins, Lab. Central" />
          <datalist id="sug-prestador">{f.prestadores.map((x) => <option key={x} value={x} />)}</datalist>
        </Campo>
        <Campo rotulo="CPF ou CNPJ (está no recibo)" erro={f.erros.documento}>
          <input className={cx(input, 'input--mono')} inputMode="numeric" value={f.documento} onChange={(x) => f.setDocumento(x.target.value)} placeholder="000.000.000-00" />
        </Campo>
        <Campo rotulo="Data do pagamento" erro={e.data}>
          <CampoData className={cx(input, 'input--mono')} valor={f.data} onChange={f.setData} max={HOJE} rotulo="Data do pagamento" />
        </Campo>
        <Campo rotulo="Valor pago (R$)" erro={e.valor}>
          <input className={cx(input, 'input--mono')} inputMode="decimal" value={f.valor} onChange={(x) => f.setValor(x.target.value.replace(/[^0-9,.]/g, ''))} placeholder="350,00" />
        </Campo>
        <Campo rotulo="Reembolso do plano (R$, opcional)" erro={f.erros.reembolso}>
          <input className={cx(input, 'input--mono')} inputMode="decimal" value={f.reembolso} onChange={(x) => f.setReembolso(x.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" />
        </Campo>
        <Campo rotulo="Observação (opcional)" largo>
          <input className={input} value={f.nota} onChange={(x) => f.setNota(x.target.value)} placeholder="Ex.: recibo na pasta azul" />
        </Campo>
      </div>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className={cx('btn btn--teal', desktop ? 'btn--h40d' : 'btn--h48')}>{f.editando ? 'Salvar alterações' : 'Salvar despesa'}</button>
        <button type="button" className={cx('btn btn--outline', desktop ? 'btn--h40d' : 'btn--h48')} onClick={onFim}>Cancelar</button>
        {f.apagar && <button type="button" className="btn btn--danger-link" style={{ marginLeft: 'auto', minHeight: 44 }} onClick={f.apagar}>Apagar</button>}
      </div>
    </form>
  );
}

/** Resumo do ano por pessoa, a lista de despesas e o CSV para o IR. */
export function Despesas({ desktop, base }: { desktop?: boolean; base?: Partial<Despesa> }) {
  const { state, api } = useStore();
  const anos = anosComDespesa(state.despesas, HOJE);
  const [ano, setAno] = useState(base?.data ? Number(base.data.slice(0, 4)) : anos[0]);
  const [form, setForm] = useState<{ inicial?: Despesa; base?: Partial<Despesa> } | null>(base ? { base } : null);
  // Despesas entram com o plano de saúde no compartilhamento.
  const pessoas = state.pessoas.filter((p) => podeVer(state, p.id, 'plano'));
  const visiveis = state.despesas.filter((d) => pessoas.some((p) => p.id === d.pessoaId));
  const resumo = resumoIR(visiveis, pessoas, ano);
  const doAno = visiveis.filter((d) => d.data.startsWith(`${ano}-`)).sort((a, b) => b.data.localeCompare(a.data));
  const podeEditar = (pid: string) => editaveis(state).some((p) => p.id === pid);
  const nome = (id: string) => quem(state.pessoas.find((p) => p.id === id));
  const faltaDoc = semDocumento(resumo);
  const totalIR = resumo.reduce((n, r) => n + r.dedutivel, 0);
  const exportar = async () => {
    const ok = await exportarTexto(`Despesas de saúde ${ano}.csv`, 'text/csv', `﻿${csvIR(resumo, state.pessoas, ano)}`);
    if (ok) api.toast({ texto: 'CSV salvo' });
  };
  const btn = cx('btn', desktop ? 'btn--h40d' : 'btn--h48');

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Guarde o que pagou em consultas, exames, dentista, terapias, hospital e plano. No fim do ano, o resumo por pessoa e por prestador
        é o que vai na ficha “Pagamentos efetuados” da declaração. Gasto com pet e remédio de farmácia não se deduz.
      </p>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <ChipGroup tamanho="sm" opcoes={anos.map((a) => ({ id: String(a), nome: String(a) }))} valor={String(ano)} onChange={(v) => setAno(Number(v))} />
        <span style={{ flex: 1 }} />
        {!form && <button type="button" className={cx(btn, 'btn--teal')} onClick={() => setForm({})}>Nova despesa</button>}
        {resumo.some((r) => r.linhas.length) && <button type="button" className={cx(btn, 'btn--outline')} onClick={() => void exportar()}>Exportar CSV</button>}
      </div>

      {form && <FormDespesa key={form.inicial?.id ?? 'nova'} inicial={form.inicial} base={form.base} desktop={desktop} onFim={() => setForm(null)} />}

      {resumo.length > 0 && (
        <div className="card" style={{ fontSize: 14 }}>
          <div className="card-head card-head--20"><Label>Resumo de {ano}</Label><span className="mono" style={{ fontSize: 13 }}>{reais(totalIR)} no IR</span></div>
          {resumo.map((r) => (
            <div key={r.pessoaId} className="stack" style={{ padding: '12px 20px', gap: 6, borderBottom: '1px solid var(--divider)' }}>
              <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>{nome(r.pessoaId)}</b>
                <span className="mono" style={{ fontSize: 13 }}>pago {reais(r.pago)}{r.reembolsado ? ` · reembolso ${reais(r.reembolsado)}` : ''} · <b>IR {reais(r.dedutivel)}</b></span>
              </div>
              {r.linhas.map((l) => (
                <div key={l.prestador + (l.documento ?? '')} className="hstack" style={{ justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  <span style={{ minWidth: 0 }}>{l.prestador}{l.documento ? <span className="mono"> · {l.documento}</span> : <span style={{ color: 'var(--warn-text)' }}> · sem CPF/CNPJ</span>}</span>
                  <span className="mono">{reais(l.pago - l.reembolsado)}</span>
                </div>
              ))}
            </div>
          ))}
          {faltaDoc.length > 0 && (
            <span style={{ padding: '10px 20px', fontSize: 13, color: 'var(--warn-text)' }}>
              {faltaDoc.length === 1 ? '1 prestador está' : `${faltaDoc.length} prestadores estão`} sem CPF/CNPJ. A declaração pede o documento de cada um: está no recibo ou na nota.
            </span>
          )}
        </div>
      )}

      <div className="card" style={{ fontSize: 14 }}>
        <div className="card-head card-head--20"><Label>Pagamentos de {ano}</Label><span className="muted" style={{ fontSize: 13 }}>{doAno.length}</span></div>
        {doAno.length === 0 && <span className="muted" style={{ padding: '14px 20px' }}>Nenhuma despesa em {ano}.</span>}
        {doAno.map((d) => {
          const p = state.pessoas.find((x) => x.id === d.pessoaId);
          return (
            <button
              type="button"
              key={d.id}
              className="row"
              style={{ padding: '12px 20px', textAlign: 'left', gap: 12 }}
              disabled={!podeEditar(d.pessoaId)}
              onClick={() => setForm({ inicial: d })}
            >
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{d.prestador}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  <span className="mono">{dataBR(d.data)}</span> · {nome(d.pessoaId)} · {nomeTipoDespesa(d.tipo)}{dedutivel(d, p) ? '' : ' · fora do IR'}
                </span>
              </span>
              <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
                <span className="mono">{reais(d.valor)}</span>
                {d.reembolso ? <span className="mono muted" style={{ fontSize: 12 }}>−{reais(d.reembolso)}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
