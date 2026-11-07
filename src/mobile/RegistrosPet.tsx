import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { dataBR } from '../data/format';
import {
  ATALHOS_INTERVALO, ATALHOS_REFORCO, TIPOS_PREVENCAO, useFormPesagem, useFormPrevencao, useFormProcedimento, useFormSintoma, useFormVacina,
  type AtalhoReforco, type TipoPrevencao,
} from '../data/formularios';
import { SINAIS, SUGESTOES_VACINA, ehPet, rotulosProcedimento, tiposProcedimento } from '../data/pets';
import type { Pesagem as PesagemT, Pessoa, Prevencao as PrevencaoT, Procedimento as ProcedimentoT, Sintoma as SintomaT, TipoProcedimento, Vacina as VacinaT } from '../data/types';
import { ConfirmarSheet } from '../ui/Confirmar';
import { useState } from 'react';
import { Chip, ChipGroup, Field, FieldGroup, Row, TopNav } from '../ui';
import { LinhaCampo, erroTexto } from './EditarPerfil';
import { MScreen } from './Shell';
import { SUGESTOES_VACINA as SUGESTOES_VACINA_PESSOA } from '../data/sugestoes';

// Registros do pet no celular: /pet/:id/vacina|prevencao|sintoma|procedimento|pesagem; com /:rid no fim, edita o já registrado.
// Vacina e procedimento valem também para pessoas.
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

/** "Apagar X" no fim do formulário de edição, com confirmação. */
function Apagar({ onApagar, rotulo, titulo, texto }: { onApagar?: () => void; rotulo: string; titulo: string; texto: string }) {
  const [aberto, setAberto] = useState(false);
  if (!onApagar) return null;
  return (
    <>
      <button type="button" className="btn btn--danger-link" style={{ fontSize: 15, minHeight: 44, alignSelf: 'center' }} onClick={() => setAberto(true)}>{rotulo}</button>
      {aberto && <ConfirmarSheet titulo={titulo} texto={texto} confirmar={rotulo} onConfirm={onApagar} onClose={() => setAberto(false)} />}
    </>
  );
}

type ColecaoPet = 'prevencoes' | 'sintomas' | 'procedimentos' | 'pesagens';
/**
 * /pet/:id/<registro> registra; /pet/:id/<registro>/:rid edita o registro `rid` (de `colecao`).
 * Registro que não existe (ou de outro dono) volta ao perfil.
 */
function comRegistro<T extends { id: string; pessoaId: string }>(
  colecao: ColecaoPet,
  Form: (p: PropsPet & { inicial?: T }) => JSX.Element,
  opcoes?: { pessoas?: boolean },
) {
  return comPet(function TelaRegistro({ pet, voltar }) {
    const { rid } = useParams();
    const { state } = useStore();
    const lista = state[colecao] as unknown as T[];
    const inicial = rid ? lista.find((x) => x.id === rid && x.pessoaId === pet.id) : undefined;
    if (rid && !inicial) return <Navigate to={`/pessoa/${pet.id}`} replace />;
    return <Form key={rid ?? 'novo'} pet={pet} voltar={voltar} inicial={inicial} />;
  }, opcoes);
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

export const RegistrarPrevencao = comRegistro<PrevencaoT>('prevencoes', function Prevencao({ pet, voltar, inicial }) {
  const f = useFormPrevencao(pet, voltar, inicial);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo={f.editando ? 'Editar prevenção' : 'Registrar prevenção'} acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
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
      <Salvar texto={f.editando ? 'Salvar alterações' : 'Salvar prevenção'} valido={f.valido} onClick={f.salvar} />
      <Apagar onApagar={f.apagar} rotulo="Apagar aplicação" titulo="Apagar esta aplicação?" texto="A aplicação sai do histórico. Se houver uma anterior do mesmo produto, a próxima data passa a contar dela." />
    </MScreen>
  );
});

// ── Sintoma ─────────────────────────────────────────────────────────────────

export const RegistrarSintoma = comRegistro<SintomaT>('sintomas', function Sintoma({ pet, voltar, inicial }) {
  const f = useFormSintoma(pet, voltar, inicial);
  const extras = f.sinais.filter((s) => !SINAIS.includes(s));
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo={f.editando ? 'Editar sintoma' : 'Registrar sintoma'} acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <FieldGroup label="Sinais">
        <div className="chips" role="group" aria-label="Sinais">
          {[...SINAIS, ...extras].map((s) => <Chip key={s} ativo={f.sinais.includes(s)} onClick={() => f.alternarSinal(s)}>{s}</Chip>)}
        </div>
      </FieldGroup>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>{linhaData('Data', f.data, f.setData)}</div>
        {erroTexto(f.erros.data)}
      </div>
      <Field label="Observação">
        <textarea className="input input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} placeholder="Ex.: Comeu grama no passeio" />
      </Field>
      <Salvar texto={f.editando ? 'Salvar alterações' : 'Salvar sintoma'} valido={f.valido} onClick={f.salvar} />
      <Apagar onApagar={f.apagar} rotulo="Apagar sintoma" titulo="Apagar este sintoma?" texto="O registro sai do histórico." />
    </MScreen>
  );
});

// ── Procedimento ────────────────────────────────────────────────────────────

export const RegistrarProcedimento = comRegistro<ProcedimentoT>('procedimentos', function Procedimento({ pet, voltar, inicial }) {
  const f = useFormProcedimento(pet, voltar, inicial);
  const r = rotulosProcedimento(pet);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo={f.editando ? 'Editar procedimento' : 'Registrar procedimento'} acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <FieldGroup label="Tipo">
        <ChipGroup opcoes={tiposProcedimento(pet, inicial?.tipo).map((x) => ({ id: x, nome: x }))} valor={f.tipo as TipoProcedimento} onChange={f.setTipo} />
      </FieldGroup>
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data', f.data, f.setData)}
          <LinhaCampo rotulo={r.clinica} value={f.clinica} onChange={(e) => f.setClinica(e.target.value)} aria-label={r.clinica} autoComplete="off" />
          <LinhaCampo rotulo={r.medico} value={f.medico} onChange={(e) => f.setMedico(e.target.value)} aria-label={`${r.medico} que realizou`} autoComplete="off" />
          <LinhaCampo rotulo="Anestesista" value={f.anestesista} onChange={(e) => f.setAnestesista(e.target.value)} aria-label="Anestesista" autoComplete="off" />
        </div>
        {erroTexto(f.erros.data)}
      </div>
      <Field label="Descrição">
        <input className="input input--50" value={f.descricao} onChange={(e) => f.setDescricao(e.target.value)} placeholder={r.descricao} autoComplete="off" />
      </Field>
      <Field label="Observações">
        <textarea className="input input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} />
      </Field>
      <Salvar texto={f.editando ? 'Salvar alterações' : 'Salvar procedimento'} valido={f.valido} onClick={f.salvar} />
      <Apagar onApagar={f.apagar} rotulo="Apagar procedimento" titulo="Apagar este procedimento?" texto="O procedimento sai do histórico." />
    </MScreen>
  );
}, { pessoas: true });

// ── Pesagem ─────────────────────────────────────────────────────────────────

export const NovaPesagem = comRegistro<PesagemT>('pesagens', function Pesagem({ pet, voltar, inicial }) {
  const f = useFormPesagem(pet, voltar, inicial);
  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo={f.editando ? 'Editar pesagem' : 'Nova pesagem'} acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />
      <div className="stack" style={{ gap: 6 }}>
        <div className="card" style={{ fontSize: 15 }}>
          {linhaData('Data', f.data, f.setData)}
          <LinhaCampo rotulo="Peso" sufixo="kg" className="mono" inputMode="decimal" placeholder="12,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} aria-label="Peso em kg" autoFocus={!f.editando} />
        </div>
        {erroTexto(f.erros.data)}
        {erroTexto(f.erros.peso)}
      </div>
      <Salvar texto={f.editando ? 'Salvar alterações' : 'Salvar pesagem'} valido={f.valido} onClick={f.salvar} />
      <Apagar onApagar={f.apagar} rotulo="Apagar pesagem" titulo="Apagar esta pesagem?" texto="A pesagem sai do histórico e do gráfico." />
    </MScreen>
  );
});
