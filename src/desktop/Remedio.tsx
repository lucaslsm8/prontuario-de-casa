import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { editaveis, historicoAdesao, pessoa, useStore } from '../data/store';
import { addDias, dataBR, diaMes, diasDeEstoque, estoqueBaixo, pctEstoque, quem, textoEstoque } from '../data/format';
import { Bar, Label } from '../ui';
import { GradeAdesao, somaAdesao } from '../mobile/Remedios';
import { DConfirmar } from './Formulario';
import { AdesaoSemanal } from '../ui/Adesao';
import { GaleriaAnexos } from '../ui/Anexos';
import { AcoesRegistro } from './Acoes';
import { partesDoRemedio } from '../data/formularios-puro';
import { CompreiMais, DosesSeNecessario } from '../ui/Estoque';

const voltar = <Link to="/remedios" style={{ fontSize: 14, fontWeight: 600 }}>← Remédios</Link>;

/** Detalhe do remédio no desktop (M16 em página). */
export function DRemedio() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const [confirmar, setConfirmar] = useState(false);
  const grade = useMemo(() => historicoAdesao(state, id ?? '', 14), [state, id]);
  const r = state.remedios.find((x) => x.id === id);

  if (!r) {
    return (
      <div className="desk__page">
        {voltar}
        <span className="muted">Remédio não encontrado.</span>
      </div>
    );
  }

  const podeEditar = editaveis(state).some((x) => x.id === r.pessoaId);
  const dias = diasDeEstoque(r);
  const baixo = r.ativo && estoqueBaixo(r);
  const acaba = dias != null ? addDias(HOJE, dias) : undefined;
  const { tomadas, previstas } = somaAdesao(grade);
  const pct = previstas ? Math.round((tomadas / previstas) * 100) : undefined;
  const meta = [quem(pessoa(state, r.pessoaId)), r.dose, r.seNecessario ? 'se necessário' : r.horarios.join(', ') || 'sem horário'].filter(Boolean).join(' · ');
  const detalhes: [string, string][] = [
    ['Receitado por', r.receitadoPor ?? '—'],
    ['Para que serve', r.indicacao ?? '—'],
    ['Dosagem', partesDoRemedio(r)[1] || '—'],
    ['Desde', r.inicio ? dataBR(r.inicio) : '—'],
    ['Lembrete', r.lembrete && r.horarios.length ? 'ligado' : 'desligado'],
  ];

  return (
    <div className="desk__page">
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
          {voltar}
          <h1 className="desk-title" style={{ margin: 0 }}>{r.nome}</h1>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{meta}</span>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <AcoesRegistro
            tamanho="btn--h40d"
            podeEditar={editaveis(state).some((x) => x.id === r.pessoaId)}
            editar={`editar-remedio:${r.id}`}
            apagar={{
              titulo: `Apagar ${r.nome}?`,
              texto: 'O remédio sai da lista e os lembretes param. Se foi engano, use “Desfazer” no aviso. Para guardar o histórico, prefira “Encerrar tratamento”.',
              onConfirm: () => { api.remover('remedios', r, `${r.nome} apagado`); nav('/remedios'); },
            }}
          />
          {r.ativo && (
            <button type="button" className="btn btn--outline btn--h40d" style={{ color: 'var(--danger)' }} onClick={() => setConfirmar(true)}>
              Encerrar tratamento
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <div className="card" style={{ background: baixo ? 'var(--warn-bg)' : undefined, borderColor: baixo ? 'transparent' : undefined }}>
          <div className="card-head" style={baixo ? { borderBottomColor: 'var(--warn-track)' } : undefined}>
            <Label cor={baixo ? 'var(--warn-text)' : undefined}>Estoque</Label>
            {acaba && <span style={{ fontSize: 13, color: baixo ? 'var(--warn-text)' : 'var(--text-2)' }}>acaba em {diaMes(acaba)}</span>}
          </div>
          <div className="stack" style={{ padding: '16px 18px 18px', gap: 12, flex: 1 }}>
            {dias != null ? (
              <>
                <span className="hstack" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 28, fontWeight: 600, color: baixo ? 'var(--warn-strong)' : undefined }}>{dias} {dias === 1 ? 'dia' : 'dias'}</span>
                  <span style={{ fontSize: 14, color: baixo ? 'var(--warn-text)' : 'var(--text-2)' }}>restam {textoEstoque(r)}</span>
                </span>
                <Bar pct={pctEstoque(r)} baixo={baixo} trilhoAlerta={baixo} grossa />
                {r.ativo && podeEditar && (
                  <CompreiMais
                    r={r}
                    className="btn btn--h40d"
                    style={{ alignSelf: 'flex-start', marginTop: 'auto', fontWeight: 600, background: baixo ? '#fff' : 'var(--teal-light)', color: baixo ? 'var(--warn-strong)' : 'var(--teal)' }}
                  />
                )}
              </>
            ) : (
              <span className="muted" style={{ fontSize: 14 }}>{r.estoqueTexto ?? 'Estoque não informado.'}</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <Label>Adesão nos últimos 14 dias</Label>
            {previstas > 0 && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{tomadas} de {previstas} doses</span>}
          </div>
          <div className="stack" style={{ padding: '16px 18px 18px', gap: 14 }}>
            {grade.length ? (
              <>
                <span style={{ fontSize: 28, fontWeight: 600 }}>{pct != null ? `${pct}%` : '—'}</span>
                <GradeAdesao grade={grade} />
                <AdesaoSemanal remedioId={id ?? ''} altura={150} />
              </>
            ) : (
              <span className="muted" style={{ fontSize: 14 }}>Sem horário fixo.</span>
            )}
          </div>
        </div>
      </div>

      {r.seNecessario && <DosesSeNecessario r={r} podeEditar={podeEditar} botao="btn btn--teal btn--h40d" />}

      <div className="card" style={{ fontSize: 14 }}>
        <div className="card-head"><Label>Receita</Label></div>
        <div style={{ padding: '16px 18px' }}>
          <GaleriaAnexos key={r.id} donoId={r.id} tipo="receita" podeEditar={podeEditar} vazio="Nenhuma receita guardada." />
        </div>
      </div>

      <div className="card" style={{ fontSize: 14 }}>
        <div className="card-head"><Label>Detalhes</Label></div>
        {detalhes.map(([k, v]) => (
          <div key={k} className="row" style={{ padding: '14px 18px' }}>
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      {confirmar && (
        <DConfirmar
          titulo={`Encerrar ${r.nome}?`}
          texto="Os lembretes param. O histórico de doses continua guardado em Encerrados."
          confirmar="Encerrar tratamento"
          perigo
          onConfirm={() => { api.encerrar(r.id); nav('/remedios'); }}
          onClose={() => setConfirmar(false)}
        />
      )}
    </div>
  );
}
