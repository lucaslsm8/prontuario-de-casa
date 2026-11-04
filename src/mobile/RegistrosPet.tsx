import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { dataBR } from '../data/format';
import {
  ATALHOS_INTERVALO, ATALHOS_REFORCO, TIPOS_PREVENCAO, useFormPesagem, useFormPrevencao, useFormProcedimento, useFormSintoma, useFormVacina,
  type AtalhoReforco, type TipoPrevencao,
} from '../data/formularios';
import { SINAIS, SUGESTOES_VACINA, TIPOS_PROCEDIMENTO, ehPet } from '../data/pets';
import type { Pessoa, TipoProcedimento, Vacina as VacinaT } from '../data/types';
import { ConfirmarSheet } from '../ui/Confirmar';
import { useState } from 'react';
import { Chip, ChipGroup, Field, FieldGroup, Row, TopNav } from '../ui';
import { LinhaCampo, erroTexto } from './EditarPerfil';
import { MScreen } from './Shell';
import { SUGESTOES_VACINA as SUGESTOES_VACINA_PESSOA } from '../data/sugestoes';

// Registros do pet no celular: /pet/:id/vacina|prevencao|sintoma|procedimento|pesagem.
// Estado, validação e salvar vêm dos hooks compartilhados com os diálogos do desktop.

type PropsPet = { pet: Pessoa; voltar: () => void };

/** Resolve o pet da rota; sem ele (ou se o id for de uma pessoa), volta à Família. */
function comPet(Form: (p: PropsPet) => JSX.Element, { pessoas = false } = {}) {
  return function TelaPet() {
    const { id } = useParams();
    const { state } = useStore();
    const nav = useNavigate();
    const pet = state.pessoas.find((p) => p.id === id && (pessoas || ehPet(p)));
    if (!pet) return <Navigate to="/familia" replace />;
    // Aberta direto (sem histórico no app), "Cancelar" e "Salvar" levam ao perfil do pet.
    const temHistorico = (window.history.state?.idx ?? 0) > 0;
    const voltar = () => (temHistorico ? nav(-1) : nav(`/pessoa/${pet.id}`, { replace: true }));
    return <Form key={pet.id} pet={pet} voltar={voltar} />;
  };
}

const linhaData = (rotulo: string, valor: string, onChange: (v: string) => void) => (
  <LinhaCampo rotulo={rotulo} className="mono" inputMode="numeric" placeholder="DD/MM/AAAA" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo} />
);

function Salvar({ texto, valido, onClick }: { texto: string; valido: boolean; onClick: () => void }) {
  return <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!valido} onClick={onClick}>{texto}</button>;
}

// ── Vacina ──────────────────────────────────────────────────────────────────

/** /pet/:id/vacina registra; /pet/:id/vacina/:vid edita (e apaga) a vacina já registrada. */
export const RegistrarVacina = comPet(function TelaVacina({ pet, voltar }) {
  const { vid } = useParams();
  const { state } = useStore();
  const vacina = vid ? state.vacinas.find((v) => v.id === vid && v.pessoaId === pet.id) : undefined;
  if (vid && !vacina) return <Navigate to={`/pessoa/${pet.id}`} replace />;
  return <Vacina key={vid ?? 'nova'} pet={pet} voltar={voltar} vacina={vacina} />;
}, { pessoas: true });

function Vacina({ pet, voltar, vacina }: PropsPet & { vacina?: VacinaT }) {
  const f = useFormVacina(pet, voltar, vacina);
  const [apagar, setApagar] = useState(false);
  const animal = ehPet(pet);
  const sugestoes = animal ? SUGESTOES_VACINA : SUGESTOES_VACINA_PESSOA.slice(0, 8);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo={f.editando ? 'Editar vacina' : 'Registrar vacina'} acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <div className="stack" style={{ gap: 10 }}>
        <Field label="Vacina">
          <input className="input input--50" value={f.nome} onChange={(e) => f.setNome(e.target.value)} placeholder={animal ? 'Ex.: V10' : 'Ex.: Gripe (influenza)'} autoComplete="off" autoFocus={!f.editando} />
        </Field>
        <div role="group" aria-label="Sugestões de vacina">
          <ChipGroup tamanho="sm" opcoes={sugestoes.map((x) => ({ id: x, nome: x }))} valor={f.nome.trim()} onChange={f.setNome} />
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data', f.data, f.setData)}
          <LinhaCampo rotulo="Lote" className="mono" value={f.lote} onChange={(e) => f.setLote(e.target.value)} aria-label="Lote" autoComplete="off" />
          <LinhaCampo rotulo={animal ? 'Veterinário' : 'Onde tomou'} value={f.veterinario} onChange={(e) => f.setVeterinario(e.target.value)} aria-label={animal ? 'Veterinário' : 'Onde tomou'} autoComplete="off" />
        </div>
        {erroTexto(f.erros.data)}
      </div>
      <FieldGroup label="Próximo reforço">
        <ChipGroup tamanho="sm" tom="teal" opcoes={ATALHOS_REFORCO} valor={f.atalho as AtalhoReforco} onChange={f.setAtalho} />
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data do reforço', f.proxima, f.setProxima)}
        </div>
        {erroTexto(f.erros.proxima)}
      </FieldGroup>
      <Salvar texto={f.editando ? 'Salvar alterações' : 'Salvar vacina'} valido={f.valido} onClick={f.salvar} />
      {f.apagar && (
        <button type="button" className="btn btn--danger-link" style={{ fontSize: 15, minHeight: 44, alignSelf: 'center' }} onClick={() => setApagar(true)}>Apagar vacina</button>
      )}
      {apagar && f.apagar && (
        <ConfirmarSheet
          titulo={`Apagar ${vacina?.nome}?`}
          texto="A vacina sai do histórico e o lembrete do reforço some."
          confirmar="Apagar vacina"
          onConfirm={f.apagar}
          onClose={() => setApagar(false)}
        />
      )}
    </MScreen>
  );
}

// ── Prevenção ───────────────────────────────────────────────────────────────

export const RegistrarPrevencao = comPet(function Prevencao({ pet, voltar }) {
  const f = useFormPrevencao(pet, voltar);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo="Registrar prevenção" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <FieldGroup label="Tipo">
        <ChipGroup largo opcoes={TIPOS_PREVENCAO} valor={f.tipo as TipoPrevencao} onChange={f.setTipo} />
      </FieldGroup>
      <Field label="Produto">
        <input className="input input--50" value={f.produto} onChange={(e) => f.setProduto(e.target.value)} placeholder="Ex.: NexGard" autoComplete="off" />
      </Field>
      <div className="stack" style={{ gap: 8 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data da aplicação', f.data, f.setData)}
          <LinhaCampo rotulo="A cada" sufixo="dias" className="mono" inputMode="numeric" value={f.intervalo} onChange={(e) => f.setIntervalo(e.target.value)} aria-label="A cada quantos dias" />
          <Row tight label="Próxima" valor={<span className="mono" style={{ fontWeight: 400 }}>{f.proxima ? dataBR(f.proxima) : '—'}</span>} />
        </div>
        <div role="group" aria-label="Atalhos do intervalo">
          <ChipGroup tamanho="sm" tom="teal" opcoes={ATALHOS_INTERVALO.map((d) => ({ id: String(d), nome: `${d} dias` }))} valor={f.intervalo} onChange={f.setIntervalo} />
        </div>
        {erroTexto(f.erros.data)}
        {erroTexto(f.erros.intervalo)}
      </div>
      <Salvar texto="Salvar prevenção" valido={f.valido} onClick={f.salvar} />
    </MScreen>
  );
});

// ── Sintoma ─────────────────────────────────────────────────────────────────

export const RegistrarSintoma = comPet(function Sintoma({ pet, voltar }) {
  const f = useFormSintoma(pet, voltar);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo="Registrar sintoma" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <FieldGroup label="Sinais">
        <div className="chips" role="group" aria-label="Sinais">
          {SINAIS.map((s) => <Chip key={s} ativo={f.sinais.includes(s)} onClick={() => f.alternarSinal(s)}>{s}</Chip>)}
        </div>
      </FieldGroup>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>{linhaData('Data', f.data, f.setData)}</div>
        {erroTexto(f.erros.data)}
      </div>
      <Field label="Observação">
        <textarea className="input input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} placeholder="Ex.: Comeu grama no passeio" />
      </Field>
      <Salvar texto="Salvar sintoma" valido={f.valido} onClick={f.salvar} />
    </MScreen>
  );
});

// ── Procedimento ────────────────────────────────────────────────────────────

export const RegistrarProcedimento = comPet(function Procedimento({ pet, voltar }) {
  const f = useFormProcedimento(pet, voltar);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo="Registrar procedimento" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <FieldGroup label="Tipo">
        <ChipGroup opcoes={TIPOS_PROCEDIMENTO.map((x) => ({ id: x, nome: x }))} valor={f.tipo as TipoProcedimento} onChange={f.setTipo} />
      </FieldGroup>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data', f.data, f.setData)}
          <LinhaCampo rotulo="Clínica" value={f.clinica} onChange={(e) => f.setClinica(e.target.value)} aria-label="Clínica" autoComplete="off" />
        </div>
        {erroTexto(f.erros.data)}
      </div>
      <Field label="Descrição">
        <input className="input input--50" value={f.descricao} onChange={(e) => f.setDescricao(e.target.value)} placeholder="Ex.: Retirada de nódulo" autoComplete="off" />
      </Field>
      <Field label="Observações">
        <textarea className="input input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} />
      </Field>
      <Salvar texto="Salvar procedimento" valido={f.valido} onClick={f.salvar} />
    </MScreen>
  );
});

// ── Pesagem ─────────────────────────────────────────────────────────────────

export const NovaPesagem = comPet(function Pesagem({ pet, voltar }) {
  const f = useFormPesagem(pet, voltar);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo="Nova pesagem" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data', f.data, f.setData)}
          <LinhaCampo rotulo="Peso" sufixo="kg" className="mono" inputMode="decimal" placeholder="12,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} aria-label="Peso em kg" autoFocus />
        </div>
        {erroTexto(f.erros.data)}
        {erroTexto(f.erros.peso)}
      </div>
      <Salvar texto="Salvar pesagem" valido={f.valido} onClick={f.salvar} />
    </MScreen>
  );
});
