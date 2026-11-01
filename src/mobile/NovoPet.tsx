import { useNavigate } from 'react-router-dom';
import { SEXOS_PET, useFormPet } from '../data/formularios';
import { ChipGroup, Field, FieldGroup, Row, Toggle, TopNav } from '../ui';
import { LinhaCampo, erroTexto } from './EditarPerfil';
import { MScreen } from './Shell';
import { CampoData } from '../ui/CampoData';
import { HOJE } from '../data/tempo';

/** Adicionar pet (celular): nome, raça, sexo, nascimento, peso atual e castrado. Salvo, abre o perfil. */
export function NovoPet() {
  const nav = useNavigate();
  const f = useFormPet((id) => nav(`/pessoa/${id}`, { replace: true }));
  const castrado = f.sexo === 'Fêmea' ? 'Castrada' : f.sexo === 'Macho' ? 'Castrado' : 'Castrado(a)';

  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" voltarPara="/familia" titulo="Novo pet" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <Field label="Nome">
        <input className="input input--50" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" autoFocus />
      </Field>
      <Field label="Raça">
        <input className="input input--50" value={f.raca} onChange={(e) => f.setRaca(e.target.value)} placeholder="Ex.: Border Collie" autoComplete="off" />
      </Field>
      <FieldGroup label="Sexo">
        <ChipGroup largo opcoes={SEXOS_PET} valor={f.sexo as 'Macho' | 'Fêmea'} onChange={(v) => f.setSexo(f.sexo === v ? '' : v)} />
      </FieldGroup>
      <Field label="Nascimento">
        <CampoData className="input input--50 input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        {erroTexto(f.erros.nasc)}
      </Field>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          <LinhaCampo rotulo="Peso atual" sufixo="kg" className="mono" inputMode="decimal" placeholder="12,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} aria-label="Peso atual em kg" />
          <Row tight mutedLabel={false} label={castrado} valor={<Toggle on={f.castrado} onChange={f.setCastrado} label="Castrado(a)" />} />
        </div>
        {erroTexto(f.erros.peso)}
      </div>
      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!f.valido} onClick={f.salvar}>
        Adicionar pet
      </button>
    </MScreen>
  );
}
