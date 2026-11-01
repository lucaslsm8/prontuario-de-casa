import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { editaveis, pessoa, podeVer, useStore } from '../data/store';
import { quem } from '../data/format';
import { CONTEXTOS_GLICEMIA, MEDICOES, infoMedicao } from '../data/medicoes';
import { normalizarHora, useFormMedicao } from '../data/formularios';
import type { TipoMedicao } from '../data/types';
import { ChipGroup, Field, FieldGroup, TopNav } from '../ui';
import { CartaoMedicao, tiposVisiveis } from '../ui/Medicoes';
import { erroTexto } from './EditarPerfil';
import { MScreen } from './Shell';
import { CartaoMarcador } from '../ui/Resultados';
import { marcadoresDaPessoa } from '../data/resultados';
import { CampoData } from '../ui/CampoData';
import { HOJE } from '../data/tempo';

/** Medições da pessoa (celular): um cartão com gráfico por tipo. */
export function MedicoesPessoa() {
  const { id = '' } = useParams();
  const { state } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, id);
  if (!p) return null;
  const podeEditar = editaveis(state).some((x) => x.id === id);
  const nova = (t?: TipoMedicao) => nav(`/pessoa/${id}/medicoes/nova${t ? `?tipo=${t}` : ''}`);
  return (
    <MScreen gap={14}>
      <TopNav voltar={p.souEu ? 'Perfil' : p.curto} acao={podeEditar ? 'Registrar' : undefined} onAcao={() => nova()} />
      <h1 className="title" style={{ margin: 0 }}>Medições</h1>
      {tiposVisiveis(state.medicoes, id).map((t) => (
        <CartaoMedicao key={t.id} pessoaId={id} tipo={t.id} altura={140} onNova={podeEditar ? () => nova(t.id) : undefined} />
      ))}
      {podeVer(state, id, 'exames') && marcadoresDaPessoa(state.exames, id).map((m, i) => (
        <div key={m} className="stack" style={{ gap: 8 }}>
          {i === 0 && <span className="label" style={{ paddingTop: 6 }}>Exames de laboratório</span>}
          <CartaoMarcador pessoaId={id} marcador={m} altura={130} />
        </div>
      ))}
    </MScreen>
  );
}

/** Nova medição (celular). */
export function NovaMedicao() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { state } = useStore();
  const nav = useNavigate();
  const inicial = MEDICOES.find((m) => m.id === params.get('tipo'))?.id ?? 'peso';
  const { f, set, erros, valido, salvar } = useFormMedicao(id, inicial, () => nav(-1));
  const info = infoMedicao(f.tipo);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" titulo={`Medição · ${quem(pessoa(state, id))}`} acao="Salvar" onAcao={salvar} acaoDesativada={!valido} />
      <FieldGroup label="O que mediu">
        <ChipGroup tom="teal" tamanho="md" opcoes={MEDICOES.map((m) => ({ id: m.id, nome: m.nome }))} valor={f.tipo} onChange={(v) => set({ tipo: v })} />
      </FieldGroup>
      {f.tipo === 'pressao' ? (
        <FieldGroup label="Pressão (máxima / mínima, mmHg)">
          <div className="hstack" style={{ gap: 10, fontSize: 18 }}>
            <input className="input input--50 input--mono" inputMode="numeric" placeholder="120" value={f.valor} onChange={(e) => set({ valor: e.target.value })} aria-label="Pressão máxima" />
            /
            <input className="input input--50 input--mono" inputMode="numeric" placeholder="80" value={f.valor2} onChange={(e) => set({ valor2: e.target.value })} aria-label="Pressão mínima" />
          </div>
          {erroTexto(erros.valor)}
        </FieldGroup>
      ) : (
        <Field label={`${info.nome} (${info.unidade})`}>
          <input className="input input--50 input--mono" inputMode="decimal" value={f.valor} onChange={(e) => set({ valor: e.target.value })} />
          {erroTexto(erros.valor)}
        </Field>
      )}
      {f.tipo === 'glicemia' && (
        <FieldGroup label="Quando">
          <ChipGroup tom="teal" tamanho="md" opcoes={CONTEXTOS_GLICEMIA.map((c) => ({ id: c as string, nome: c }))} valor={f.contexto} onChange={(v) => set({ contexto: v })} />
        </FieldGroup>
      )}
      <div className="hstack" style={{ gap: 10 }}>
        <Field label="Data">
          <CampoData className="input input--50 input--mono" valor={f.data} onChange={(v) => set({ data: v })} max={HOJE} />
          {erroTexto(erros.data)}
        </Field>
        <Field label="Hora">
          <input className="input input--50 input--mono" inputMode="numeric" placeholder="HH:MM" value={f.hora} onChange={(e) => set({ hora: e.target.value })} onBlur={() => set({ hora: normalizarHora(f.hora) })} />
        </Field>
      </div>
      <Field label="Observação">
        <input className="input input--50" value={f.nota} onChange={(e) => set({ nota: e.target.value })} placeholder="Ex.: medida depois do almoço" />
      </Field>
      <button type="button" className="btn btn--cta" style={{ marginTop: 8 }} disabled={!valido} onClick={salvar}>Registrar medição</button>
    </MScreen>
  );
}
