// Valores do exame (tabela editável), comentário em cada valor, comparação com o exame anterior
// e a evolução de cada marcador entre exames (com os comentários de cada vez).
import { useState } from 'react';
import { pessoa, useStore } from '../data/store';
import { MARCADORES, anteriorDoMarcador, foraDaFaixa, fmtResultado, fmtValor, infoMarcador, montarResultado, serieMarcador, variacao } from '../data/resultados';
import { dataBR } from '../data/format';
import type { Exame } from '../data/types';
import { Grafico } from './Grafico';
import { Folha } from './Backup';
import { cx } from './index';

const FORA = { alto: '↑ acima da referência', baixo: '↓ abaixo da referência' };

/**
 * Tabela "Marcador · valor" do exame. Cada linha mostra o valor do exame anterior e a variação; tocar no marcador abre
 * a evolução no tempo. Quem pode editar adiciona, remove e comenta valores (salva na hora).
 */
export function ResultadosExame({ exame, podeEditar, desktop }: { exame: Exame; podeEditar: boolean; desktop?: boolean }) {
  const { state, api } = useStore();
  const lista = exame.resultados ?? [];
  const [marcador, setMarcador] = useState('');
  const [valor, setValor] = useState('');
  const [unidade, setUnidade] = useState('');
  const [comentando, setComentando] = useState<string>();
  const [texto, setTexto] = useState('');
  const [evolucao, setEvolucao] = useState<string>();
  const sugerida = infoMarcador(marcador)?.unidade;
  const novo = montarResultado(marcador, valor, unidade);
  const adicionar = () => {
    if (!novo) return;
    api.editar('exames', exame.id, { resultados: [...lista.filter((r) => r.marcador !== novo.marcador), novo] }, `${novo.marcador} registrado`);
    setMarcador(''); setValor(''); setUnidade('');
  };
  const remover = (m: string) => api.editar('exames', exame.id, { resultados: lista.filter((r) => r.marcador !== m) }, `${m} removido`);
  const comentar = (m: string, atual?: string) => { setComentando(m); setTexto(atual ?? ''); };
  const salvarComentario = () => {
    const m = comentando;
    if (!m) return;
    setComentando(undefined);
    const nota = texto.trim() || undefined;
    if (lista.find((r) => r.marcador === m)?.nota === nota) return;
    api.editar('exames', exame.id, { resultados: lista.map((r) => (r.marcador === m ? { ...r, nota } : r)) }, nota ? `Comentário em ${m} salvo` : `Comentário de ${m} apagado`);
  };

  return (
    <div className="resultados">
      {lista.length === 0 && !podeEditar && <span className="muted" style={{ fontSize: 14 }}>Nenhum valor registrado.</span>}
      {lista.map((r) => {
        const fora = foraDaFaixa(r);
        const ref = infoMarcador(r.marcador);
        const ant = anteriorDoMarcador(state.exames, exame, r.marcador);
        return (
          <div key={r.marcador} className="resultado resultado--com-nota">
            <div className="resultado__linha">
              <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                <button type="button" className="resultado__marcador" onClick={() => setEvolucao(r.marcador)} title="Ver a evolução no tempo">{r.marcador}</button>
                {ref && (ref.min != null || ref.max != null) && (
                  <span className="resultado__ref">ref. {ref.min != null && ref.max != null ? `${fmtValor(ref.min)}–${fmtValor(ref.max)}` : ref.max != null ? `até ${fmtValor(ref.max)}` : `acima de ${fmtValor(ref.min!)}`}</span>
                )}
                {ant && <span className="resultado__antes">antes: {fmtResultado(ant.resultado)} em {dataBR(ant.data)} · {variacao(r, ant.resultado)}</span>}
              </span>
              <span className={cx('resultado__valor', fora && 'is-fora')} title={fora ? FORA[fora] : undefined}>{fora === 'alto' ? '↑ ' : fora === 'baixo' ? '↓ ' : ''}{fmtResultado(r)}</span>
              {podeEditar && comentando !== r.marcador && (
                <button type="button" className="resultado__comentar" onClick={() => comentar(r.marcador, r.nota)} aria-label={`${r.nota ? 'Editar comentário de' : 'Comentar'} ${r.marcador}`}>{r.nota ? 'Editar' : 'Comentar'}</button>
              )}
              {podeEditar && <button type="button" className="dlista__x" aria-label={`Remover ${r.marcador}`} onClick={() => remover(r.marcador)}>×</button>}
            </div>
            {comentando === r.marcador ? (
              <form className="resultado__nota-form" onSubmit={(e) => { e.preventDefault(); salvarComentario(); }}>
                <input className="inline-input" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={salvarComentario} onKeyDown={(e) => { if (e.key === 'Escape') setComentando(undefined); }} placeholder="Ex.: pedra no rim, sem jejum, gripado" aria-label={`Comentário sobre ${r.marcador}`} maxLength={200} />
                <button type="submit" className="btn btn--soft btn--h36">Salvar</button>
              </form>
            ) : r.nota && <span className="resultado__nota">“{r.nota}”</span>}
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
      {evolucao && (
        <Folha desktop={desktop} titulo={`${evolucao} ao longo do tempo`} onClose={() => setEvolucao(undefined)}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Todos os exames de {pessoa(state, exame.pessoaId)?.curto ?? 'quem fez'} com {evolucao}.</span>
          <div style={{ maxHeight: desktop ? '64vh' : '60vh', overflowY: 'auto' }}><CartaoMarcador pessoaId={exame.pessoaId} marcador={evolucao} altura={desktop ? 180 : 150} destaque={exame.id} /></div>
          <button type="button" className={desktop ? 'btn btn--outline btn--h40d' : 'btn btn--outline btn--h50'} style={{ alignSelf: desktop ? 'flex-end' : undefined }} onClick={() => setEvolucao(undefined)}>Fechar</button>
        </Folha>
      )}
    </div>
  );
}

/**
 * Cartão com a evolução de um marcador (todos os exames da pessoa) e, embaixo do gráfico, os valores com a data e o
 * comentário de cada vez ("pedra no rim"). Sem `destaque` (aba Medições), só os valores comentados; com `destaque`
 * (evolução aberta de um exame), todos, com o exame aberto marcado.
 */
export function CartaoMarcador({ pessoaId, marcador, altura = 140, destaque }: { pessoaId: string; marcador: string; altura?: number; destaque?: string }) {
  const { state } = useStore();
  const serie = serieMarcador(state.exames, pessoaId, marcador);
  const ult = serie[serie.length - 1];
  if (!ult) return null;
  const info = infoMarcador(marcador);
  const fora = foraDaFaixa(ult.resultado);
  const faixa = info && (info.min != null || info.max != null) ? [{ de: info.min ?? 0, ate: info.max ?? ult.valor * 2 }] : [];
  const linhas = [...serie].reverse().filter((p) => destaque || p.resultado.nota);
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
      {linhas.length > 0 && (
        <div className="medida__notas">
          {linhas.map((p) => {
            const f = foraDaFaixa(p.resultado);
            return (
              <div key={p.exameId} className={cx('medida__nota', p.exameId === destaque && 'is-atual')}>
                <span className="mono">{dataBR(p.data)}</span>
                <span className={cx('mono', f && 'is-fora')}>{fmtResultado(p.resultado)}</span>
                <span className="medida__nota-texto">{p.resultado.nota ? `“${p.resultado.nota}”` : state.exames.find((e) => e.id === p.exameId)?.nome}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
