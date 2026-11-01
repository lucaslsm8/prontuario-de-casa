import { useNavigate, useParams } from 'react-router-dom';
import { ABRANGENCIAS, ACOMODACOES, SEGMENTACOES, useFormPlano } from '../data/formularios';
import { ChipGroup, Field, FieldGroup, TopNav } from '../ui';
import { erroTexto } from './EditarPerfil';
import { MScreen } from './Shell';
import { useStore } from '../data/store';

const opcoes = <T extends string>(xs: readonly T[]) => xs.map((x) => ({ id: x, nome: x }));

/** Adicionar plano (celular): os dados da carteirinha. Salvo, volta para o plano da pessoa. */
export function NovoPlano({ editar = false }: { editar?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useStore();
  const inicial = editar ? state.planos.find((x) => x.pessoaId === id) : undefined;
  const { f, set, erros, valido, salvar, editando } = useFormPlano(id, () => nav(`/pessoa/${f.pessoaId}/plano`, { replace: true }), inicial);
  const odonto = f.segmentacao === 'Odontológico';

  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" titulo={editando ? 'Editar plano' : 'Novo plano'} acao="Salvar" onAcao={salvar} acaoDesativada={!valido} />
      <Field label="Operadora">
        <input className="input input--50" value={f.operadora} onChange={(e) => set({ operadora: e.target.value })} placeholder="Ex.: Bradesco Saúde" autoComplete="off" />
        {erroTexto(erros.operadora)}
      </Field>
      <Field label="Plano / produto">
        <input className="input input--50" value={f.produto} onChange={(e) => set({ produto: e.target.value })} placeholder="Ex.: Top Nacional" autoComplete="off" />
      </Field>
      <Field label="Número da carteirinha">
        <input className="input input--50 input--mono" value={f.numero} onChange={(e) => set({ numero: e.target.value })} placeholder="0 000 0000 0000 0000" autoComplete="off" />
        {erroTexto(erros.numero)}
      </Field>
      <Field label="Validade">
        <input className="input input--50 input--mono" inputMode="numeric" value={f.validade} onChange={(e) => set({ validade: e.target.value })} placeholder="MM/AAAA" />
        {erroTexto(erros.validade)}
      </Field>
      <FieldGroup label="Cobertura">
        <ChipGroup tom="teal" tamanho="md" opcoes={opcoes(SEGMENTACOES)} valor={f.segmentacao} onChange={(v) => set({ segmentacao: v })} />
      </FieldGroup>
      {!odonto && (
        <FieldGroup label="Acomodação">
          <ChipGroup largo tom="teal" opcoes={opcoes(ACOMODACOES)} valor={f.acomodacao} onChange={(v) => set({ acomodacao: v })} />
        </FieldGroup>
      )}
      <FieldGroup label="Abrangência">
        <ChipGroup tom="teal" tamanho="md" opcoes={opcoes(ABRANGENCIAS)} valor={f.abrangencia} onChange={(v) => set({ abrangencia: v })} />
      </FieldGroup>
      <FieldGroup label="Vínculo">
        <ChipGroup largo opcoes={[{ id: 'titular' as const, nome: 'Titular' }, { id: 'dependente' as const, nome: 'Dependente' }]} valor={f.vinculo} onChange={(v) => set({ vinculo: v })} />
      </FieldGroup>
      {f.vinculo === 'dependente' && (
        <Field label="Nome do titular">
          <input className="input input--50" value={f.titularNome} onChange={(e) => set({ titularNome: e.target.value })} autoComplete="off" />
          {erroTexto(erros.titularNome)}
        </Field>
      )}
      <Field label="Central de atendimento">
        <input className="input input--50 input--mono" inputMode="tel" value={f.central} onChange={(e) => set({ central: e.target.value })} placeholder="0800 000 0000" />
      </Field>
      <Field label="Registro ANS">
        <input className="input input--50 input--mono" inputMode="numeric" value={f.registroAns} onChange={(e) => set({ registroAns: e.target.value })} placeholder="000000" />
      </Field>
      <Field label="Carências">
        <input className="input input--50" value={f.carencias} onChange={(e) => set({ carencias: e.target.value })} placeholder="Ex.: Todas cumpridas" />
      </Field>
      <Field label="Anotação">
        <textarea className="input input--area" value={f.anotacao} onChange={(e) => set({ anotacao: e.target.value })} placeholder="Ex.: ressonância precisa de autorização prévia" />
      </Field>
      <button type="button" className="btn btn--cta" style={{ marginTop: 8 }} disabled={!valido} onClick={salvar}>{editando ? 'Salvar alterações' : 'Guardar plano'}</button>
    </MScreen>
  );
}
