// Painel de medições de uma pessoa: um cartão por tipo, com o último valor, a variação e o gráfico.
import { useStore } from '../data/store';
import { MEDICOES, faixaImc, fmtMedicao, imc, infoMedicao, pontosMedicao, serieMedicao, variacao, type InfoMedicao } from '../data/medicoes';
import { dataBR, numBR } from '../data/format';
import type { TipoMedicao } from '../data/types';
import { Grafico, type Faixa } from './Grafico';

/** Peso e pressão aparecem sempre (com convite a registrar); os outros só depois da primeira medição. */
const SEMPRE: TipoMedicao[] = ['peso', 'pressao'];

export function tiposVisiveis(medicoes: { pessoaId: string; tipo: TipoMedicao }[], pessoaId: string): InfoMedicao[] {
  return MEDICOES.filter((m) => SEMPRE.includes(m.id) || medicoes.some((x) => x.pessoaId === pessoaId && x.tipo === m.id));
}

export function CartaoMedicao({ pessoaId, tipo, onNova, altura }: { pessoaId: string; tipo: TipoMedicao; onNova?: () => void; altura?: number }) {
  const { state } = useStore();
  const info = infoMedicao(tipo);
  const serie = serieMedicao(state.medicoes, pessoaId, tipo);
  const ult = serie[serie.length - 1];
  const p = state.pessoas.find((x) => x.id === pessoaId);
  const indice = tipo === 'peso' ? imc(ult?.valor, p?.altura) : undefined;
  const faixas: Faixa[] = [info.faixa, info.faixa2].filter(Boolean).map((f) => ({ de: f![0], ate: f![1] }));
  const series = tipo === 'pressao'
    ? [{ nome: 'Máxima', cor: 'var(--teal)', pontos: pontosMedicao(serie) }, { nome: 'Mínima', cor: 'var(--warn-bar)', pontos: pontosMedicao(serie, 'valor2') }]
    : [{ nome: info.nome, cor: 'var(--teal)', pontos: pontosMedicao(serie) }];
  const v = variacao(serie, info.casas, info.unidade);
  const varTxt = v && (tipo === 'pressao' ? `máx. ${v}` : v);

  return (
    <section className="card medida">
      <div className="medida__topo">
        <span className="stack" style={{ gap: 2 }}>
          <span className="medida__nome">{info.nome}</span>
          <span className="medida__valor">{ult ? fmtMedicao(ult) : '—'}{ult && <small>{info.unidade}</small>}</span>
        </span>
        <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
          {varTxt && <span className="medida__var">{varTxt} desde {dataBR(serie[0].data).slice(0, 5)}</span>}
          {onNova && <button type="button" className="btn btn--link" style={{ fontSize: 13, minHeight: 32 }} onClick={onNova}>+ Registrar</button>}
        </span>
      </div>
      {ult && (
        <span className="medida__sub">
          {[
            `em ${dataBR(ult.data)}${ult.hora ? ` às ${ult.hora}` : ''}`,
            ult.contexto,
            indice && `IMC ${numBR(indice, 1)} (${faixaImc(indice)})`,
          ].filter(Boolean).join(' · ')}
        </span>
      )}
      {tipo === 'pressao' && serie.length > 0 && (
        <span className="grafico__legenda">
          <span style={{ color: 'var(--teal)' }}><i />Máxima</span>
          <span style={{ color: 'var(--warn-bar)' }}><i />Mínima</span>
          <span style={{ color: 'var(--text-3)' }}>faixa: até 12/8</span>
        </span>
      )}
      <Grafico
        rotulo={`Evolução de ${info.nome.toLowerCase()}`}
        series={series}
        faixas={faixas}
        casas={tipo === 'altura' ? 2 : tipo === 'temperatura' ? 1 : 0}
        altura={altura}
        vazio={`Nenhuma medição de ${info.nome.toLowerCase()} ainda.`}
      />
    </section>
  );
}
