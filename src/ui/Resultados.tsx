// Valores do exame (tabela editável) e a evolução de cada marcador entre exames.
import { useState } from 'react';
import { useStore } from '../data/store';
import { MARCADORES, foraDaFaixa, fmtResultado, fmtValor, infoMarcador, montarResultado, serieMarcador } from '../data/resultados';
import { dataBR } from '../data/format';
import type { Exame } from '../data/types';
import { Grafico } from './Grafico';
import { cx } from './index';

const FORA = { alto: '↑ acima da referência', baixo: '↓ abaixo da referência' };

/** Tabela "Marcador · valor" do exame. Quem pode editar adiciona e remove linhas (salva na hora). */
export function ResultadosExame({ exame, podeEditar }: { exame: Exame; podeEditar: boolean }) {
  const { api } = useStore();
  const lista = exame.resultados ?? [];
  const [marcador, setMarcador] = useState('');
  const [valor, setValor] = useState('');
  const [unidade, setUnidade] = useState('');
  const sugerida = infoMarcador(marcador)?.unidade;
  const novo = montarResultado(marcador, valor, unidade);
  const adicionar = () => {
    if (!novo) return;
    api.editar('exames', exame.id, { resultados: [...lista.filter((r) => r.marcador !== novo.marcador), novo] }, `${novo.marcador} registrado`);
    setMarcador(''); setValor(''); setUnidade('');
  };
  const remover = (m: string) => api.editar('exames', exame.id, { resultados: lista.filter((r) => r.marcador !== m) }, `${m} removido`);

  return (
    <div className="resultados">
      {lista.length === 0 && !podeEditar && <span className="muted" style={{ fontSize: 14 }}>Nenhum valor registrado.</span>}
      {lista.map((r) => {
        const fora = foraDaFaixa(r);
        const ref = infoMarcador(r.marcador);
        return (
          <div key={r.marcador} className="resultado">
            <span className="stack" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{r.marcador}</span>
              {ref && (ref.min != null || ref.max != null) && (
                <span className="resultado__ref">ref. {ref.min != null && ref.max != null ? `${fmtValor(ref.min)}–${fmtValor(ref.max)}` : ref.max != null ? `até ${fmtValor(ref.max)}` : `acima de ${fmtValor(ref.min!)}`}</span>
              )}
            </span>
            <span className={cx('resultado__valor', fora && 'is-fora')} title={fora ? FORA[fora] : undefined}>{fora === 'alto' ? '↑ ' : fora === 'baixo' ? '↓ ' : ''}{fmtResultado(r)}</span>
            {podeEditar && <button type="button" className="dlista__x" aria-label={`Remover ${r.marcador}`} onClick={() => remover(r.marcador)}>×</button>}
          </div>
        );
      })}
      {podeEditar && (
        <form className="resultado resultado--novo" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <input className="inline-input" list="sug-marcador" placeholder="Marcador (ex.: LDL)" value={marcador} onChange={(e) => setMarcador(e.target.value)} aria-label="Marcador" />
          <input className="inline-input mono" inputMode="decimal" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Valor" style={{ width: 72 }} />
          <input className="inline-input" placeholder={sugerida ?? 'unid.'} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade" style={{ width: 70 }} />
          <button type="submit" className="btn btn--soft btn--h36" disabled={!novo}>Adicionar</button>
          <datalist id="sug-marcador">{MARCADORES.map((m) => <option key={m.nome} value={m.nome} />)}</datalist>
        </form>
      )}
    </div>
  );
}

/** Cartão com a evolução de um marcador (todos os exames da pessoa). */
export function CartaoMarcador({ pessoaId, marcador, altura = 140 }: { pessoaId: string; marcador: string; altura?: number }) {
  const { state } = useStore();
  const serie = serieMarcador(state.exames, pessoaId, marcador);
  const ult = serie[serie.length - 1];
  if (!ult) return null;
  const info = infoMarcador(marcador);
  const fora = foraDaFaixa(ult.resultado);
  const faixa = info && (info.min != null || info.max != null) ? [{ de: info.min ?? 0, ate: info.max ?? ult.valor * 2 }] : [];
  return (
    <section className="card medida">
      <div className="medida__topo">
        <span className="stack" style={{ gap: 2 }}>
          <span className="medida__nome">{marcador}</span>
          <span className={cx('medida__valor', fora && 'is-fora')}>{fmtValor(ult.valor)}<small>{ult.resultado.unidade}</small></span>
        </span>
        {serie.length > 1 && <span className="medida__var">{serie.length} exames desde {dataBR(serie[0].data).slice(3)}</span>}
      </div>
      <span className="medida__sub">em {dataBR(ult.data)}{fora ? ` · ${FORA[fora]}` : ''}</span>
      <Grafico rotulo={`Evolução de ${marcador}`} series={[{ nome: marcador, cor: 'var(--teal)', pontos: serie }]} faixas={faixa} casas={ult.valor < 10 ? 1 : 0} altura={altura} />
    </section>
  );
}
