import { useState } from 'react';
import { editaveis, eu, pessoa, useStore } from '../data/store';
import { HOJE } from '../data/tempo';
import { addDias, dataBR, diaMes, idade, mascararTelefone, quem } from '../data/format';
import {
  ATALHOS_INTERVALO, ATALHOS_REFORCO, AVISAR, nomeAvisar, CATEGORIAS_EXAME, DOSES, DURACOES, FREQUENCIAS, LEMBRAR, PARENTESCO,
  ABRANGENCIAS, ACOMODACOES, SEGMENTACOES, SEXOS_PET, SEXO_DO_PET, TIPOS_PREVENCAO, sexoPetDoForm, normalizarHora, useFormConsulta, useFormExame, useFormPerfil, useFormPesagem, useFormPessoa, useFormPet,
  useFormPrevencao, useFormMedicao, useFormProcedimento, useFormPlano, useFormRemedio, useFormSintoma, useFormVacina, type AtalhoReforco, type TipoPrevencao,
} from '../data/formularios';
import { SINAIS, SUGESTOES_VACINA, TIPOS_PROCEDIMENTO, descricaoPet, ehPet, opcoesPessoas, rotuloCastrado } from '../data/pets';
import { CorpoFichaPet } from '../mobile/Familia';
import { TIPOS_CONDICAO, type TipoCondicao } from '../data/perfil';
import { LISTA_POR_TIPO } from '../data/sugestoes';
import { Sugestoes, SugestoesConsulta } from '../ui/Sugestoes';
import { AnexosPendentes } from '../ui/Anexos';
import type { Consulta, Exame, Pessoa, Plano, Remedio, TipoMedicao, TipoProcedimento } from '../data/types';
import { CONTEXTOS_GLICEMIA, MEDICOES, infoMedicao } from '../data/medicoes';
import { Chip } from '../ui';
import { TrocarFoto, useEscolherFoto } from '../ui/Foto';
import { enterNaLinha } from '../ui/linhas';
import { DCampo, DChips, DDialogo, DFechar, DGrade, DRodape, DSangue, DSelect, DToggle } from './Formulario';
import { SUGESTOES_VACINA as SUGESTOES_VACINA_PESSOA } from '../data/sugestoes';
import { CampoData } from '../ui/CampoData';

// Formulários do desktop em diálogo largo. Estado, validação e salvar vêm dos hooks compartilhados com o mobile.

type Props = { onClose: () => void };

/** "Para quem": pessoas, separador e pets. */
function usePessoasEditaveis() {
  const { state } = useStore();
  return opcoesPessoas(editaveis(state), quem);
}

// ── Novo remédio (M06) ──────────────────────────────────────────────────────

export function DNovoRemedio({ onClose, remedio }: Props & { remedio?: Remedio }) {
  const pessoas = usePessoasEditaveis();
  const f = useFormRemedio(onClose, remedio);
  const inicio = remedio?.inicio ?? HOJE;
  const duracoes = [...new Set([...DURACOES, f.duracao])].map((v) => ({ id: v, nome: v ? `${v} dias · até ${diaMes(addDias(inicio, v))}` : 'Uso contínuo' }));
  const doses = DOSES.includes(f.dose) ? DOSES : [f.dose, ...DOSES];
  const freqs = FREQUENCIAS.some((x) => x.nome === f.freq.nome) ? FREQUENCIAS : [f.freq, ...FREQUENCIAS];

  return (
    <DDialogo titulo={f.editando ? 'Editar remédio' : 'Novo remédio'} onClose={onClose} rodape={<DRodape salvar={f.editando ? 'Salvar alterações' : 'Salvar remédio'} onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Remédio e dosagem" span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} placeholder="Ex.: Losartana 50 mg" />
        </DCampo>
        <DCampo label="Para quem" span2 grupo>
          <DChips opcoes={pessoas.opcoes} separarAntes={pessoas.separarAntes} valor={f.para} onChange={f.setPara} />
        </DCampo>
        <DCampo label="Dose">
          <DSelect opcoes={doses.map((d) => ({ id: d, nome: d }))} valor={f.dose} onChange={f.setDose} />
        </DCampo>
        <DCampo label="Frequência">
          <DSelect opcoes={freqs.map((x) => ({ id: x, nome: x.nome }))} valor={freqs.find((x) => x.nome === f.freq.nome)!} onChange={f.setFreq} />
        </DCampo>
        {f.freq.id !== 'sn' && (
          <DCampo label="Horários" erro={f.horariosValidos ? undefined : 'Use HH:MM separados por vírgula.'}>
            <input className="input input--desk input--mono" value={f.horariosTexto} onChange={(e) => f.setHorariosTexto(e.target.value)} onBlur={f.completarHorarios} placeholder="08:00, 20:00" />
          </DCampo>
        )}
        <DCampo label="Observação">
          <input className="input input--desk" value={f.observacao} onChange={(e) => f.setObservacao(e.target.value)} placeholder="Ex.: em jejum" />
        </DCampo>
        <DCampo label="Duração">
          <DSelect opcoes={duracoes} valor={f.duracao} onChange={f.setDuracao} />
        </DCampo>
        <DCampo label="Avisar para repor">
          <DSelect opcoes={(AVISAR.includes(f.avisar) ? AVISAR : [f.avisar, ...AVISAR]).map((v) => ({ id: v, nome: nomeAvisar(v) }))} valor={f.avisar} onChange={f.setAvisar} />
        </DCampo>
        <DCampo label="Estoque atual">
          <span className="dsufixo">
            <input
              className="input input--desk input--mono"
              inputMode="numeric"
              value={f.estoque}
              onChange={(e) => f.setEstoque(Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
            {f.unidade}
          </span>
        </DCampo>
        <div className="dfield dfield--span2">
          <DToggle texto="Lembrete no horário" on={f.lembrete} onChange={f.setLembrete} />
        </div>
        {!f.editando && (
          <DCampo label="Receita (opcional)" span2 grupo>
            <AnexosPendentes donoId={f.id} tipo="receita" lista={f.receita} onChange={f.setReceita} />
          </DCampo>
        )}
      </DGrade>
    </DDialogo>
  );
}

// ── Nova consulta (M18) ─────────────────────────────────────────────────────

export function DNovaConsulta({ onClose, consulta }: Props & { consulta?: Consulta }) {
  const pessoas = usePessoasEditaveis();
  const f = useFormConsulta(onClose, { desktop: true, inicial: consulta });
  const addItem = () => {
    if (f.novoItem?.trim()) f.setLevar([...f.levar, { item: f.novoItem.trim(), ok: true }]);
    f.setNovoItem(null);
  };

  return (
    <DDialogo titulo={f.editando ? 'Editar consulta' : 'Nova consulta'} onClose={onClose} rodape={<DRodape salvar={f.editando ? 'Salvar alterações' : 'Salvar consulta'} onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Especialidade" span2>
          <input className="input input--desk" value={f.titulo} onChange={(e) => f.setTitulo(e.target.value)} placeholder={f.paraPet ? 'Veterinário' : 'Ex.: Cardiologista'} />
        </DCampo>
        <DCampo label="Para quem" span2 grupo>
          <DChips opcoes={pessoas.opcoes} separarAntes={pessoas.separarAntes} valor={f.para} onChange={f.setPara} />
        </DCampo>
        <DCampo label="Data">
          <CampoData className="input input--desk input--mono" valor={f.data} onChange={f.setData} />
        </DCampo>
        <DCampo label="Hora">
          <input className="input input--desk input--mono" inputMode="numeric" placeholder="HH:MM" value={f.hora} onChange={(e) => f.setHora(e.target.value)} onBlur={() => f.setHora(normalizarHora(f.hora))} />
        </DCampo>
        <DCampo label="Profissional">
          <input className="input input--desk" list="sug-prof" value={f.prof} onChange={(e) => f.setProf(e.target.value)} />
          <SugestoesConsulta />
        </DCampo>
        <DCampo label="Local">
          <input className="input input--desk" list="sug-local" value={f.local} onChange={(e) => f.setLocal(e.target.value)} />
        </DCampo>
        <DCampo label="Pelo plano" grupo>
          <DToggle texto={f.plano ? 'Vitalis · sim' : 'Não'} rotulo="Pelo plano" on={f.plano} onChange={f.setPlano} />
        </DCampo>
        <DCampo label="Levar" span2 grupo>
          <div className="dlista">
            {f.levar.map((l, i) => (
              <button
                type="button"
                key={i}
                className="dlista__item"
                aria-pressed={l.ok}
                onClick={() => f.setLevar(f.levar.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}
              >
                <span className="dlista__check" aria-hidden>{l.ok ? '✓' : '○'}</span>
                {l.item}
              </button>
            ))}
            {f.novoItem !== null ? (
              <div className="dlista__item">
                <span className="dlista__check" aria-hidden>✓</span>
                <input
                  className="inline-input"
                  autoFocus
                  placeholder="Ex.: Pedido médico"
                  aria-label="Novo item"
                  value={f.novoItem}
                  onChange={(e) => f.setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                    if (e.key === 'Escape') { e.stopPropagation(); f.setNovoItem(null); }
                  }}
                  onBlur={addItem}
                />
              </div>
            ) : (
              <button type="button" className="dlista__item dlista__add" onClick={() => f.setNovoItem('')}>+ Adicionar item</button>
            )}
          </div>
        </DCampo>
        <DCampo label="Lembrar" grupo>
          <DChips tom="teal" opcoes={LEMBRAR.map((x) => ({ id: x, nome: x }))} valor={f.lembrar} onChange={f.setLembrar} />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Adicionar exame (M17) ───────────────────────────────────────────────────

export function DNovoExame({ onClose, exame }: Props & { exame?: Exame }) {
  const pessoas = usePessoasEditaveis();
  const f = useFormExame(onClose, exame);
  const consultas = [
    { id: undefined as string | undefined, nome: 'Nenhuma' },
    ...f.consultasDaPessoa.map((c) => ({ id: c.id as string | undefined, nome: `${c.titulo} · ${diaMes(c.data)}` })),
  ];

  return (
    <DDialogo titulo={f.editando ? 'Editar exame' : 'Adicionar exame'} onClose={onClose} rodape={<DRodape salvar={f.editando ? 'Salvar alterações' : 'Salvar exame'} onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        {!f.editando && (
          <DCampo label="Arquivos (fotos das páginas ou o PDF do laboratório)" span2 grupo>
            <AnexosPendentes donoId={f.id} tipo="exame" lista={f.arquivos} onChange={f.setArquivos} />
          </DCampo>
        )}
        <DCampo label="Nome do exame" span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} placeholder="Ex.: Hemograma completo" />
        </DCampo>
        <DCampo label="De quem" grupo>
          <DChips opcoes={pessoas.opcoes} separarAntes={pessoas.separarAntes} valor={f.de} onChange={f.setDe} />
        </DCampo>
        <DCampo label="Categoria" grupo>
          <DChips tom="teal" opcoes={CATEGORIAS_EXAME.map((x) => ({ id: x, nome: x }))} valor={f.cat} onChange={f.setCat} />
        </DCampo>
        <DCampo label="Data da coleta">
          <CampoData className="input input--desk input--mono" valor={f.data} onChange={f.setData} />
        </DCampo>
        <DCampo label="Laboratório">
          <input className="input input--desk" value={f.lab} onChange={(e) => f.setLab(e.target.value)} />
        </DCampo>
        <DCampo label="Vincular a consulta">
          <DSelect opcoes={consultas} valor={f.consulta} onChange={f.setConsulta} />
        </DCampo>
        <DCampo label="Pedido por">
          <input className="input input--desk" value={f.solicitante} onChange={(e) => f.setSolicitante(e.target.value)} placeholder="Ex.: Dra. Marta Lins" />
        </DCampo>
        <DCampo label={f.lendoPdf ? 'Resultado · lendo o PDF…' : 'Resultado (texto do laudo)'} span2>
          <textarea className="input input--desk input--area" style={{ minHeight: 140 }} value={f.laudo} onChange={(e) => f.setLaudo(e.target.value)} placeholder="Cole aqui o texto do laudo, ou anexe o PDF para o app ler." />
          {!!f.resultados?.length && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Valores lidos: {f.resultados.map((r) => r.marcador).join(', ')}</span>}
        </DCampo>
        <DCampo label="Anotação" span2>
          <textarea className="input input--desk input--area" value={f.anotacao} onChange={(e) => f.setAnotacao(e.target.value)} placeholder="Ex.: mostrar ao cardiologista" />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Nova medição (peso, pressão, glicemia…) ────────────────────────────────

export function DNovaMedicao({ pessoaId, tipo, onClose }: Props & { pessoaId: string; tipo?: TipoMedicao }) {
  const { state } = useStore();
  const { f, set, erros, valido, salvar } = useFormMedicao(pessoaId, tipo && MEDICOES.some((m) => m.id === tipo) ? tipo : 'peso', onClose);
  const info = infoMedicao(f.tipo);
  return (
    <DDialogo titulo={`Nova medição · ${quem(pessoa(state, pessoaId))}`} onClose={onClose} rodape={<DRodape salvar="Registrar" onSalvar={salvar} valido={valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="O que mediu" span2 grupo>
          <DChips tom="teal" opcoes={MEDICOES.map((m) => ({ id: m.id, nome: m.nome }))} valor={f.tipo} onChange={(v) => set({ tipo: v })} />
        </DCampo>
        {f.tipo === 'pressao' ? (
          <DCampo label="Pressão (máxima / mínima)" span2 erro={erros.valor}>
            <span className="dsufixo">
              <input className="input input--desk input--mono" style={{ width: 96 }} inputMode="numeric" placeholder="120" value={f.valor} onChange={(e) => set({ valor: e.target.value })} aria-label="Pressão máxima" autoFocus />
              /
              <input className="input input--desk input--mono" style={{ width: 96 }} inputMode="numeric" placeholder="80" value={f.valor2} onChange={(e) => set({ valor2: e.target.value })} aria-label="Pressão mínima" />
              mmHg
            </span>
          </DCampo>
        ) : (
          <DCampo label={info.nome} span2 erro={erros.valor}>
            <span className="dsufixo">
              <input className="input input--desk input--mono" inputMode="decimal" placeholder={info.id === 'altura' ? '1,74' : info.id === 'temperatura' ? '36,5' : ''} value={f.valor} onChange={(e) => set({ valor: e.target.value })} autoFocus />
              {info.unidade}
            </span>
          </DCampo>
        )}
        {f.tipo === 'glicemia' && (
          <DCampo label="Quando" span2 grupo>
            <DChips tom="teal" opcoes={CONTEXTOS_GLICEMIA.map((c) => ({ id: c as string, nome: c }))} valor={f.contexto} onChange={(v) => set({ contexto: v })} />
          </DCampo>
        )}
        <DCampo label="Data" erro={erros.data}>
          <CampoData className="input input--desk input--mono" valor={f.data} onChange={(v) => set({ data: v })} max={HOJE} />
        </DCampo>
        <DCampo label="Hora">
          <input className="input input--desk input--mono" inputMode="numeric" placeholder="HH:MM" value={f.hora} onChange={(e) => set({ hora: e.target.value })} onBlur={() => set({ hora: normalizarHora(f.hora) })} />
        </DCampo>
        <DCampo label="Observação" span2>
          <input className="input input--desk" value={f.nota} onChange={(e) => set({ nota: e.target.value })} placeholder="Ex.: medida depois do almoço" />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Adicionar plano de saúde ────────────────────────────────────────────────

const opcoes = <T extends string>(xs: readonly T[]) => xs.map((x) => ({ id: x, nome: x }));

export function DNovoPlano({ pessoaId, plano, onClose }: Props & { pessoaId?: string; plano?: Plano }) {
  const { state } = useStore();
  const pessoas = opcoesPessoas(editaveis(state).filter((p) => !ehPet(p)), quem);
  const { f, set, erros, valido, salvar, editando } = useFormPlano(pessoaId, onClose, plano);
  const odonto = f.segmentacao === 'Odontológico';

  return (
    <DDialogo titulo={editando ? 'Editar plano' : 'Adicionar plano'} largura={720} onClose={onClose} rodape={<DRodape salvar={editando ? 'Salvar alterações' : 'Guardar plano'} onSalvar={salvar} valido={valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="De quem" span2 grupo>
          <DChips opcoes={pessoas.opcoes} valor={f.pessoaId} onChange={(v) => set({ pessoaId: v })} />
        </DCampo>
        <DCampo label="Operadora" erro={erros.operadora}>
          <input className="input input--desk" value={f.operadora} onChange={(e) => set({ operadora: e.target.value })} placeholder="Ex.: Bradesco Saúde" autoComplete="off" />
        </DCampo>
        <DCampo label="Plano / produto">
          <input className="input input--desk" value={f.produto} onChange={(e) => set({ produto: e.target.value })} placeholder="Ex.: Top Nacional" autoComplete="off" />
        </DCampo>
        <DCampo label="Número da carteirinha" erro={erros.numero}>
          <input className="input input--desk input--mono" value={f.numero} onChange={(e) => set({ numero: e.target.value })} placeholder="0 000 0000 0000 0000" autoComplete="off" />
        </DCampo>
        <DCampo label="Validade" erro={erros.validade}>
          <input className="input input--desk input--mono" inputMode="numeric" value={f.validade} onChange={(e) => set({ validade: e.target.value })} placeholder="MM/AAAA" />
        </DCampo>
        <DCampo label="Cobertura" span2 grupo>
          <DChips tom="teal" opcoes={opcoes(SEGMENTACOES)} valor={f.segmentacao} onChange={(v) => set({ segmentacao: v })} />
        </DCampo>
        {!odonto && (
          <DCampo label="Acomodação" grupo>
            <DChips tom="teal" opcoes={opcoes(ACOMODACOES)} valor={f.acomodacao} onChange={(v) => set({ acomodacao: v })} />
          </DCampo>
        )}
        <DCampo label="Abrangência" grupo>
          <DChips tom="teal" opcoes={opcoes(ABRANGENCIAS)} valor={f.abrangencia} onChange={(v) => set({ abrangencia: v })} />
        </DCampo>
        <DCampo label="Vínculo" grupo>
          <DChips opcoes={[{ id: 'titular' as const, nome: 'Titular' }, { id: 'dependente' as const, nome: 'Dependente' }]} valor={f.vinculo} onChange={(v) => set({ vinculo: v })} />
        </DCampo>
        {f.vinculo === 'dependente' ? (
          <DCampo label="Nome do titular" erro={erros.titularNome}>
            <input className="input input--desk" value={f.titularNome} onChange={(e) => set({ titularNome: e.target.value })} autoComplete="off" />
          </DCampo>
        ) : <div />}
        <DCampo label="Central de atendimento">
          <input className="input input--desk input--mono" inputMode="tel" value={f.central} onChange={(e) => set({ central: e.target.value })} placeholder="0800 000 0000" />
        </DCampo>
        <DCampo label="Registro ANS">
          <input className="input input--desk input--mono" inputMode="numeric" value={f.registroAns} onChange={(e) => set({ registroAns: e.target.value })} placeholder="000000" />
        </DCampo>
        <DCampo label="Cartão SUS (CNS)">
          <input className="input input--desk input--mono" inputMode="numeric" value={f.cns} onChange={(e) => set({ cns: e.target.value })} placeholder="000 0000 0000 0000" />
        </DCampo>
        <DCampo label="Mensalidade">
          <input className="input input--desk" value={f.mensalidade} onChange={(e) => set({ mensalidade: e.target.value })} placeholder="Ex.: R$ 890,00 · vence dia 10" />
        </DCampo>
        <DCampo label="Carências" span2>
          <input className="input input--desk" value={f.carencias} onChange={(e) => set({ carencias: e.target.value })} placeholder="Ex.: Todas cumpridas" />
        </DCampo>
        <DCampo label="Anotação" span2>
          <textarea className="input input--desk input--area" value={f.anotacao} onChange={(e) => set({ anotacao: e.target.value })} placeholder="Ex.: ressonância precisa de autorização prévia" />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Adicionar pessoa (M02, fora do primeiro uso) ────────────────────────────

export function DNovaPessoa({ onClose }: Props) {
  const f = useFormPessoa({ souEu: false, onSalvo: onClose });

  return (
    <DDialogo titulo="Adicionar pessoa" onClose={onClose} rodape={<DRodape salvar="Adicionar pessoa" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Nome" span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label="Data de nascimento" erro={f.erroData}>
          <CampoData className="input input--desk input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        </DCampo>
        <DCampo label="Parentesco com você" grupo>
          <DChips opcoes={PARENTESCO} valor={f.par} onChange={f.setPar} />
        </DCampo>
        <DCampo label="Tipo sanguíneo" grupo>
          <DSangue valor={f.sangue} onChange={f.setSangue} />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Adicionar pet ───────────────────────────────────────────────────────────

export function DNovoPet({ onClose }: Props) {
  const f = useFormPet(onClose);

  return (
    <DDialogo titulo="Adicionar pet" onClose={onClose} rodape={<DRodape salvar="Adicionar pet" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Nome" span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label="Raça">
          <input className="input input--desk" value={f.raca} onChange={(e) => f.setRaca(e.target.value)} placeholder="Ex.: Border Collie" autoComplete="off" />
        </DCampo>
        <DCampo label="Sexo" grupo>
          <DChips opcoes={SEXOS_PET} valor={f.sexo as 'Macho' | 'Fêmea'} onChange={(v) => f.setSexo(f.sexo === v ? '' : v)} />
        </DCampo>
        <DCampo label="Nascimento" erro={f.erros.nasc}>
          <CampoData className="input input--desk input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        </DCampo>
        <DCampo label="Peso atual" erro={f.erros.peso}>
          <span className="dsufixo">
            <input className="input input--desk input--mono" inputMode="decimal" placeholder="12,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} />
            kg
          </span>
        </DCampo>
        <div className="dfield dfield--span2">
          <DToggle texto={rotuloCastrado({ sexo: f.sexo && SEXO_DO_PET[f.sexo] })} rotulo="Castrado(a)" on={f.castrado} onChange={f.setCastrado} />
        </div>
      </DGrade>
    </DDialogo>
  );
}

// ── Registros do pet (vacina, prevenção, sintoma, procedimento, pesagem) ────

export type RegistroPet = 'vacina' | 'prevencao' | 'sintoma' | 'procedimento' | 'pesagem';
export const REGISTROS_PET: RegistroPet[] = ['vacina', 'prevencao', 'sintoma', 'procedimento', 'pesagem'];

type PropsPet = Props & { pet: Pessoa };
const FORMS_PET: Record<RegistroPet, (p: PropsPet) => JSX.Element> = {
  vacina: DVacina, prevencao: DPrevencao, sintoma: DSintoma, procedimento: DProcedimento, pesagem: DPesagem,
};

/** ?abrir=<registro>:<petId>. Sem o pet (ou se o id for de uma pessoa), não abre nada. */
export function DRegistroPet({ registro, petId, onClose }: Props & { registro: RegistroPet; petId?: string }) {
  const { state } = useStore();
  // Vacina vale também para pessoas; os outros registros são só de pets.
  const pet = state.pessoas.find((p) => p.id === petId && (ehPet(p) || registro === 'vacina'));
  if (!pet) return null;
  const Form = FORMS_PET[registro];
  return <Form pet={pet} onClose={onClose} />;
}

const inputData = (valor: string, onChange: (v: string) => void, rotulo?: string) => (
  <CampoData className="input input--desk input--mono" rotulo={rotulo} valor={valor} onChange={onChange} />
);

function DVacina({ pet, onClose }: PropsPet) {
  const f = useFormVacina(pet, onClose);
  const animal = ehPet(pet);
  const sugestoes = animal ? SUGESTOES_VACINA : SUGESTOES_VACINA_PESSOA.slice(0, 8);
  return (
    <DDialogo titulo="Registrar vacina" onClose={onClose} rodape={<DRodape salvar="Salvar vacina" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Vacina" span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} placeholder={animal ? 'Ex.: V10' : 'Ex.: Gripe (influenza)'} autoComplete="off" />
        </DCampo>
        <div className="dfield dfield--span2" role="group" aria-label="Sugestões de vacina" style={{ marginTop: -4 }}>
          <DChips opcoes={sugestoes.map((x) => ({ id: x, nome: x }))} valor={f.nome.trim()} onChange={f.setNome} />
        </div>
        <DCampo label="Data" erro={f.erros.data}>{inputData(f.data, f.setData)}</DCampo>
        <DCampo label="Lote">
          <input className="input input--desk input--mono" value={f.lote} onChange={(e) => f.setLote(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label={animal ? 'Veterinário' : 'Onde tomou'} span2>
          <input className="input input--desk" value={f.veterinario} onChange={(e) => f.setVeterinario(e.target.value)} placeholder={animal ? undefined : 'Ex.: UBS Vila Mariana'} autoComplete="off" />
        </DCampo>
        <DCampo label="Próximo reforço" span2 grupo erro={f.erros.proxima}>
          <div className="hstack" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span style={{ width: 150, flex: 'none' }}>{inputData(f.proxima, f.setProxima, 'Data do próximo reforço')}</span>
            <DChips tom="teal" opcoes={ATALHOS_REFORCO} valor={f.atalho as AtalhoReforco} onChange={f.setAtalho} />
          </div>
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

function DPrevencao({ pet, onClose }: PropsPet) {
  const f = useFormPrevencao(pet, onClose);
  return (
    <DDialogo titulo="Registrar prevenção" onClose={onClose} rodape={<DRodape salvar="Salvar prevenção" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Tipo" span2 grupo>
          <DChips opcoes={TIPOS_PREVENCAO} valor={f.tipo as TipoPrevencao} onChange={f.setTipo} />
        </DCampo>
        <DCampo label="Produto" span2>
          <input className="input input--desk" value={f.produto} onChange={(e) => f.setProduto(e.target.value)} placeholder="Ex.: NexGard" autoComplete="off" />
        </DCampo>
        <DCampo label="Data da aplicação" erro={f.erros.data}>{inputData(f.data, f.setData)}</DCampo>
        <DCampo label="A cada" grupo erro={f.erros.intervalo}>
          <div className="hstack" style={{ gap: 12 }}>
            <span className="dsufixo">
              <input className="input input--desk input--mono" style={{ width: 72 }} inputMode="numeric" aria-label="Intervalo em dias" value={f.intervalo} onChange={(e) => f.setIntervalo(e.target.value)} />
              dias
            </span>
            <DChips tom="teal" opcoes={ATALHOS_INTERVALO.map((d) => ({ id: String(d), nome: `${d} dias` }))} valor={f.intervalo} onChange={f.setIntervalo} />
          </div>
          {f.proxima && <span className="dfield__dica">Próxima: <span className="mono" style={{ color: 'var(--ink)' }}>{dataBR(f.proxima)}</span></span>}
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

function DSintoma({ pet, onClose }: PropsPet) {
  const f = useFormSintoma(pet, onClose);
  return (
    <DDialogo titulo="Registrar sintoma" onClose={onClose} rodape={<DRodape salvar="Salvar sintoma" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Sinais" span2 grupo>
          <div className="chips">
            {SINAIS.map((s) => <Chip key={s} tamanho="xs" ativo={f.sinais.includes(s)} onClick={() => f.alternarSinal(s)}>{s}</Chip>)}
          </div>
        </DCampo>
        <DCampo label="Data" erro={f.erros.data}>{inputData(f.data, f.setData)}</DCampo>
        <DCampo label="Observação" span2>
          <textarea className="input input--desk input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} placeholder="Ex.: Comeu grama no passeio" />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

function DProcedimento({ pet, onClose }: PropsPet) {
  const f = useFormProcedimento(pet, onClose);
  return (
    <DDialogo titulo="Registrar procedimento" onClose={onClose} rodape={<DRodape salvar="Salvar procedimento" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Tipo" span2 grupo>
          <DChips opcoes={TIPOS_PROCEDIMENTO.map((x) => ({ id: x, nome: x }))} valor={f.tipo as TipoProcedimento} onChange={f.setTipo} />
        </DCampo>
        <DCampo label="Data" erro={f.erros.data}>{inputData(f.data, f.setData)}</DCampo>
        <DCampo label="Clínica">
          <input className="input input--desk" value={f.clinica} onChange={(e) => f.setClinica(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label="Descrição" span2>
          <input className="input input--desk" value={f.descricao} onChange={(e) => f.setDescricao(e.target.value)} placeholder="Ex.: Retirada de nódulo" autoComplete="off" />
        </DCampo>
        <DCampo label="Observações" span2>
          <textarea className="input input--desk input--area" rows={3} value={f.nota} onChange={(e) => f.setNota(e.target.value)} />
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

function DPesagem({ pet, onClose }: PropsPet) {
  const f = useFormPesagem(pet, onClose);
  return (
    <DDialogo titulo="Nova pesagem" largura={480} onClose={onClose} rodape={<DRodape salvar="Salvar pesagem" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <DCampo label="Data" erro={f.erros.data}>{inputData(f.data, f.setData)}</DCampo>
        <DCampo label="Peso" erro={f.erros.peso}>
          <span className="dsufixo">
            <input className="input input--desk input--mono" inputMode="decimal" placeholder="12,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} />
            kg
          </span>
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}

// ── Ficha de emergência (M14, leitura) ──────────────────────────────────────

export function DFichaEmergencia({ pessoaId, onClose }: Props & { pessoaId?: string }) {
  const { state } = useStore();
  const p = pessoa(state, pessoaId ?? '') ?? state.pessoas.find((x) => x.id === 'roberto') ?? eu(state);
  if (ehPet(p)) return <DFichaEmergenciaPet p={p} onClose={onClose} />;
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === p.id && !r.seNecessario);
  const plano = state.planos.find((x) => x.pessoaId === p.id);
  const condicoes = p.condicoes.filter((c) => c.tipo === 'condicao').map((c) => c.nome).join(' · ');
  const contato = p.contatoEmergencia;
  const nomeCurto = (() => { const n = p.nome.split(' '); return n.length > 2 ? `${n[0]} ${n[1][0]}. ${n[n.length - 1]}` : p.nome; })();
  const anos = idade(p);
  const alergico = p.alergias.length > 0;

  const faixa = (
    <div className="dficha__faixa">
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 12, letterSpacing: '.12em' }}>FICHA DE EMERGÊNCIA</span>
        <DFechar onClick={onClose} />
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{nomeCurto}</span>
      {(anos != null || p.nascimento) && (
        <span style={{ fontSize: 15, opacity: 0.9 }}>
          {[anos != null && `${anos} anos`, p.nascimento && `nasc. ${dataBR(p.nascimento)}`].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );

  return (
    <DDialogo
      titulo={`Ficha de emergência de ${p.nome}`}
      largura={560}
      onClose={onClose}
      cabecalho={faixa}
      imprimivel
      rodape={
        <>
          <button type="button" className="btn btn--outline btn--h40d" onClick={() => window.print()}>Imprimir</button>
          <button type="button" className="btn btn--ink btn--h40d" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16, paddingTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
          <div className="stack" style={{ borderRadius: 8, background: 'var(--bg)', padding: 14, gap: 2 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sangue</span>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{p.sangue ?? '?'}</span>
          </div>
          <div className="stack" style={{ borderRadius: 8, background: alergico ? 'var(--warn-bg)' : 'var(--bg)', padding: 14, gap: 2 }}>
            <span style={{ fontSize: 12, color: alergico ? 'var(--warn-text)' : 'var(--text-2)', fontWeight: 600 }}>{alergico ? 'ALÉRGICO A' : 'ALERGIAS'}</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: alergico ? 'var(--warn-strong)' : undefined }}>
              {alergico ? p.alergias.map((a) => a.substancia).join(', ') : 'Nenhuma conhecida'}
            </span>
          </div>
        </div>
        {condicoes && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="dficha__rot">CONDIÇÕES</span>
            <span style={{ fontSize: 18, fontWeight: 500 }}>{condicoes}</span>
          </div>
        )}
        {remedios.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="dficha__rot">REMÉDIOS EM USO</span>
            {remedios.map((r) => <span key={r.id} style={{ fontSize: 18, fontWeight: 500 }}>{r.nome} · {r.horarios.length}x ao dia</span>)}
          </div>
        )}
        {plano && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="dficha__rot">PLANO DE SAÚDE</span>
            <span style={{ fontSize: 18, fontWeight: 500 }}>{plano.operadora} · {plano.produto}</span>
            <span className="mono" style={{ fontSize: 16 }}>{plano.numero}</span>
          </div>
        )}
        {contato && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="dficha__rot">CONTATO DE EMERGÊNCIA</span>
            <a href={`tel:${contato.telefone.replace(/\D/g, '')}`} className="hstack" style={{ height: 60, borderRadius: 6, background: 'var(--ink)', color: '#fff', justifyContent: 'space-between', padding: '0 18px' }}>
              <span className="stack">
                <span style={{ fontSize: 16, fontWeight: 600 }}>Ligar para {contato.nome}</span>
                <span style={{ fontSize: 13, color: 'var(--tab-inactive)' }}>{[contato.relacao, contato.telefone].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ fontSize: 20 }} aria-hidden>›</span>
            </a>
          </div>
        )}
      </div>
    </DDialogo>
  );
}

/** Ficha de emergência do pet: a mesma faixa e impressão; o corpo vem do celular (CorpoFichaPet). */
function DFichaEmergenciaPet({ p, onClose }: Props & { p: Pessoa }) {
  const faixa = (
    <div className="dficha__faixa">
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 12, letterSpacing: '.12em' }}>FICHA DE EMERGÊNCIA</span>
        <DFechar onClick={onClose} />
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{p.nome}</span>
      <span style={{ fontSize: 15, opacity: 0.9 }}>{descricaoPet(p)}</span>
    </div>
  );
  return (
    <DDialogo
      titulo={`Ficha de emergência de ${p.nome}`}
      largura={560}
      onClose={onClose}
      cabecalho={faixa}
      imprimivel
      rodape={
        <>
          <button type="button" className="btn btn--outline btn--h40d" onClick={() => window.print()}>Imprimir</button>
          <button type="button" className="btn btn--ink btn--h40d" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16, paddingTop: 16 }}>
        <CorpoFichaPet p={p} colunaPeso={130} rotulo={(t) => <span className="dficha__rot">{t}</span>} />
      </div>
    </DDialogo>
  );
}

// ── Editar perfil ───────────────────────────────────────────────────────────

const SEXOS = [{ id: 'Feminino' as const, nome: 'Feminino' }, { id: 'Masculino' as const, nome: 'Masculino' }];

export function DEditarPerfil({ pessoaId, onClose }: Props & { pessoaId?: string }) {
  const { state } = useStore();
  const p = editaveis(state).find((x) => x.id === pessoaId);
  if (!p) return null;
  return ehPet(p) ? <EditarPerfilPet p={p} onClose={onClose} /> : <EditarPerfil p={p} onClose={onClose} />;
}

type FormPerfilHook = ReturnType<typeof useFormPerfil>;

/** Lista editável de alergias (substância · reação), igual para pessoas e pets. */
function CampoAlergias({ f, nova, onNova: novaAlergia }: { f: FormPerfilHook; nova?: string; onNova: () => void }) {
  return (
    <DCampo label="Alergias" span2 grupo>
      <Sugestoes />
      <div className="dlista">
        {f.alergias.map((a) => (
          <div key={a.chave} data-item className="dlista__item dlista__linha">
            <input
              data-campo
              className="inline-input dlista__campo"
              autoFocus={a.chave === nova}
              placeholder="Substância"
              list="sug-alergia"
              aria-label={a.substancia ? `Substância — ${a.substancia}` : 'Substância da nova alergia'}
              value={a.substancia}
              onChange={(e) => f.setAlergia(a.chave, { substancia: e.target.value })}
              onKeyDown={(e) => enterNaLinha(e, novaAlergia)}
            />
            <input
              data-campo
              className="inline-input dlista__campo dlista__campo--largo"
              placeholder="Reação"
              list="sug-reacao"
              aria-label={a.substancia ? `Reação a ${a.substancia}` : 'Reação da nova alergia'}
              value={a.reacao}
              onChange={(e) => f.setAlergia(a.chave, { reacao: e.target.value })}
              onKeyDown={(e) => enterNaLinha(e, novaAlergia)}
            />
            <button type="button" className="dlista__x" aria-label={`Remover alergia${a.substancia ? ` ${a.substancia}` : ''}`} onClick={() => f.removerAlergia(a.chave)}>×</button>
          </div>
        ))}
        <button type="button" className="dlista__item dlista__add" onClick={novaAlergia}>+ Adicionar alergia</button>
      </div>
    </DCampo>
  );
}

/** Foto do perfil com trocar/remover (topo do diálogo). */
function CampoFoto({ p, f }: { p: Pessoa; f: FormPerfilHook }) {
  const foto = useEscolherFoto(f.setFoto);
  return (
    <div className="dfield dfield--span2 dperfil__foto">
      <TrocarFoto pessoa={{ ...p, foto: f.foto }} tamanho={72} onFoto={f.setFoto} seletor={foto} />
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline btn--h36" onClick={foto.abrir}>{f.foto ? 'Trocar foto' : 'Adicionar foto'}</button>
        {f.foto && <button type="button" className="btn btn--h36 btn--danger-link" onClick={() => f.setFoto(undefined)}>Remover foto</button>}
      </div>
      {foto.elemento}
    </div>
  );
}

/** Editar perfil do pet: os campos do pet no lugar de sangue, altura, pressão e contato. O peso fica nas pesagens. */
function EditarPerfilPet({ p, onClose }: Props & { p: Pessoa }) {
  const f = useFormPerfil(p, onClose);
  const [nova, setNova] = useState<string>();
  const novaAlergia = () => setNova(f.addAlergia());
  const sexo = sexoPetDoForm(f.sexo);
  const fp = f.pet!;

  return (
    <DDialogo titulo="Editar perfil" largura={720} onClose={onClose} rodape={<DRodape salvar="Salvar" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <CampoFoto p={p} f={f} />
        <DCampo label="Nome" span2 erro={f.erros.nome}>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label="Nascimento" erro={f.erros.nasc}>
          <CampoData className="input input--desk input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        </DCampo>
        <DCampo label="Sexo" grupo>
          <DChips opcoes={SEXOS_PET} valor={sexo} onChange={(v) => v && f.setSexo(sexo === v ? '' : SEXO_DO_PET[v])} />
        </DCampo>
        <DCampo label="Raça">
          <input className="input input--desk" value={fp.raca} onChange={(e) => f.setPet({ raca: e.target.value })} placeholder="Ex.: Border Collie" autoComplete="off" />
        </DCampo>
        <DCampo label="Microchip">
          <input className="input input--desk input--mono" value={fp.microchip} onChange={(e) => f.setPet({ microchip: e.target.value })} placeholder="15 dígitos" autoComplete="off" />
        </DCampo>
        <div className="dfield dfield--span2">
          <DToggle texto={rotuloCastrado({ sexo: f.sexo })} rotulo="Castrado(a)" on={fp.castrado} onChange={(v) => f.setPet({ castrado: v })} />
        </div>

        <DCampo label="Veterinário" span2 grupo erro={f.erros.veterinario}>
          <div className="dperfil__contato">
            <input className="input input--desk" placeholder="Nome" aria-label="Nome do veterinário" value={fp.veterinario.nome} onChange={(e) => f.setVeterinario({ nome: e.target.value })} />
            <input className="input input--desk" placeholder="Clínica" aria-label="Clínica do veterinário" value={fp.veterinario.clinica} onChange={(e) => f.setVeterinario({ clinica: e.target.value })} />
            <input className="input input--desk input--mono" inputMode="tel" placeholder="(11) 3000-0000" aria-label="Telefone do veterinário" value={fp.veterinario.telefone} onChange={(e) => f.setVeterinario({ telefone: mascararTelefone(e.target.value) })} />
          </div>
        </DCampo>
        <DCampo label="Clínica 24 h" span2 grupo erro={f.erros.clinica24h}>
          <div className="dperfil__clinica">
            <input className="input input--desk" placeholder="Nome" aria-label="Nome da clínica 24 h" value={fp.clinica24h.nome} onChange={(e) => f.setClinica24h({ nome: e.target.value })} />
            <input className="input input--desk input--mono" inputMode="tel" placeholder="(11) 3000-0000" aria-label="Telefone da clínica 24 h" value={fp.clinica24h.telefone} onChange={(e) => f.setClinica24h({ telefone: mascararTelefone(e.target.value) })} />
          </div>
        </DCampo>

        <CampoAlergias f={f} nova={nova} onNova={novaAlergia} />
      </DGrade>
    </DDialogo>
  );
}

function EditarPerfil({ p, onClose }: Props & { p: Pessoa }) {
  const f = useFormPerfil(p, onClose);
  // Linha recém-adicionada recebe o foco.
  const [nova, setNova] = useState<string>();
  const novaAlergia = () => setNova(f.addAlergia());
  const novaCondicao = () => setNova(f.addCondicao());

  return (
    <DDialogo titulo="Editar perfil" largura={720} onClose={onClose} rodape={<DRodape salvar="Salvar" onSalvar={f.salvar} valido={f.valido} onCancelar={onClose} />}>
      <DGrade>
        <CampoFoto p={p} f={f} />
        <DCampo label="Nome" span2 erro={f.erros.nome}>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" />
        </DCampo>
        <DCampo label="Nascimento" erro={f.erros.nasc}>
          <CampoData className="input input--desk input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        </DCampo>
        <DCampo label="Sexo" grupo>
          <DChips opcoes={SEXOS} valor={f.sexo as 'Feminino' | 'Masculino'} onChange={(v) => f.setSexo(f.sexo === v ? '' : v)} />
        </DCampo>
        <DCampo label="Tipo sanguíneo" span2 grupo>
          <DSangue valor={f.sangue} onChange={f.setSangue} />
        </DCampo>
        <DCampo label="Peso" erro={f.erros.peso}>
          <span className="dsufixo">
            <input className="input input--desk input--mono" inputMode="decimal" placeholder="72,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} />
            kg
          </span>
        </DCampo>
        <DCampo label="Altura" erro={f.erros.altura}>
          <span className="dsufixo">
            <input className="input input--desk input--mono" inputMode="decimal" placeholder="1,74" value={f.altura} onChange={(e) => f.setAltura(e.target.value)} />
            m
          </span>
        </DCampo>
        <DCampo label="Pressão">
          <span className="dsufixo">
            <input className="input input--desk input--mono" placeholder="120/80" value={f.pressao} onChange={(e) => f.setPressao(e.target.value)} />
            {f.dataPressao && (f.dataPressao === HOJE ? 'medida hoje' : `medida em ${dataBR(f.dataPressao)}`)}
          </span>
        </DCampo>

        <CampoAlergias f={f} nova={nova} onNova={novaAlergia} />

        <DCampo label="Condições" span2 grupo>
          <div className="dlista">
            {f.condicoes.map((c) => (
              <div key={c.chave} data-item className="dlista__item dlista__linha">
                <input
                  data-campo
                  className="inline-input dlista__campo dlista__campo--largo"
                  autoFocus={c.chave === nova}
                  placeholder="Nome"
                  aria-label={c.nome ? `Nome da condição — ${c.nome}` : 'Nome da nova condição'}
                  value={c.nome}
                  list={LISTA_POR_TIPO[c.tipo]}
                  onChange={(e) => f.setCondicao(c.chave, { nome: e.target.value })}
                  onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                />
                <select
                  data-campo
                  className="inline-input dlista__campo dlista__tipo"
                  aria-label={c.nome ? `Tipo de ${c.nome}` : 'Tipo da nova condição'}
                  value={c.tipo}
                  onChange={(e) => f.setCondicao(c.chave, { tipo: e.target.value as TipoCondicao })}
                  onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                >
                  {TIPOS_CONDICAO.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
                <input
                  data-campo
                  className="inline-input mono dlista__campo dlista__desde"
                  placeholder="Desde"
                  aria-label={c.nome ? `Desde — ${c.nome}` : 'Desde — nova condição'}
                  value={c.desde}
                  onChange={(e) => f.setCondicao(c.chave, { desde: e.target.value })}
                  onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                />
                <button type="button" className="dlista__x" aria-label={`Remover ${c.nome || 'condição'}`} onClick={() => f.removerCondicao(c.chave)}>×</button>
              </div>
            ))}
            <button type="button" className="dlista__item dlista__add" onClick={novaCondicao}>+ Adicionar condição</button>
          </div>
        </DCampo>

        <DCampo label="Contato de emergência" span2 grupo erro={f.erros.contato}>
          <div className="dperfil__contato">
            <input className="input input--desk" placeholder="Nome" aria-label="Nome do contato" value={f.contato.nome} onChange={(e) => f.setContato({ nome: e.target.value })} />
            <input className="input input--desk" placeholder="Relação" aria-label="Relação" value={f.contato.relacao} onChange={(e) => f.setContato({ relacao: e.target.value })} />
            <input className="input input--desk input--mono" inputMode="tel" placeholder="(11) 90000-0000" aria-label="Telefone" value={f.contato.telefone} onChange={(e) => f.setContato({ telefone: mascararTelefone(e.target.value) })} />
          </div>
        </DCampo>
      </DGrade>
    </DDialogo>
  );
}
