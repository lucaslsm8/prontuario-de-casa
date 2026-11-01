import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { HOJE } from '../data/tempo';
import { editaveis, pessoa, useStore } from '../data/store';
import { dataBR, mascararTelefone } from '../data/format';
import { SEXOS_PET, SEXO_DO_PET, sexoPetDoForm, useFormPerfil } from '../data/formularios';
import { rotuloCastrado } from '../data/pets';
import { TIPOS_CONDICAO, type FormPerfil, type TipoCondicao } from '../data/perfil';
import type { Pessoa } from '../data/types';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { ChipGroup, Field, FieldGroup, Row, Toggle, TopNav } from '../ui';
import { TrocarFoto } from '../ui/Foto';
import { enterNaLinha } from '../ui/linhas';
import { SangueGrid } from '../ui/Sangue';
import { Sugestoes } from '../ui/Sugestoes';
import { LISTA_POR_TIPO } from '../data/sugestoes';
import { MScreen } from './Shell';
import { CampoData } from '../ui/CampoData';

const SEXOS: { id: FormPerfil['sexo']; nome: string }[] = [{ id: 'Feminino', nome: 'Feminino' }, { id: 'Masculino', nome: 'Masculino' }];

export const erroTexto = (texto?: string) => texto && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{texto}</span>;

/** Tela "Editar perfil" (celular). Sem permissão ou pessoa inexistente, volta ao perfil (ou à Família). */
export function EditarPerfilMobile() {
  const { id } = useParams();
  const { state } = useStore();
  const p = editaveis(state).find((x) => x.id === id);
  if (!p) return <Navigate to={pessoa(state, id ?? '') ? `/pessoa/${id}` : '/familia'} replace />;
  return <FormEditarPerfil key={p.id} p={p} />;
}

function FormEditarPerfil({ p }: { p: Pessoa }) {
  const nav = useNavigate();
  // Aberta direto (sem histórico no app), "Cancelar" e "Salvar" levam ao perfil.
  const temHistorico = (window.history.state?.idx ?? 0) > 0;
  const voltar = () => (temHistorico ? nav(-1) : nav(`/pessoa/${p.id}`, { replace: true }));
  const f = useFormPerfil(p, voltar);
  const previa = { ...p, foto: f.foto };
  // Item recém-adicionado recebe o foco.
  const [novo, setNovo] = useState<string>();
  const novaAlergia = () => setNovo(f.addAlergia());
  const novaCondicao = () => setNovo(f.addCondicao());

  return (
    <MScreen gap={14}>
      <TopNav voltar="Cancelar" onVoltar={voltar} titulo="Editar perfil" acao="Salvar" onAcao={f.salvar} acaoDesativada={!f.valido} />

      <div className="hstack" style={{ gap: 16 }}>
        <TrocarFoto pessoa={previa} tamanho={72} onFoto={f.setFoto} />
        {f.foto && (
          <button type="button" className="btn--danger-link" style={{ fontSize: 15, minHeight: 44 }} onClick={() => f.setFoto(undefined)}>
            Remover foto
          </button>
        )}
      </div>

      <Field label="Nome">
        <input className="input input--50" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoComplete="off" />
        {erroTexto(f.erros.nome)}
      </Field>
      <Field label="Data de nascimento">
        <CampoData className="input input--50 input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        {erroTexto(f.erros.nasc)}
      </Field>
      {f.pet ? <CamposPet f={f} /> : (
        <>
          <FieldGroup label="Sexo">
            <ChipGroup largo opcoes={SEXOS} valor={f.sexo} onChange={(v) => f.setSexo(f.sexo === v ? '' : v)} />
          </FieldGroup>
          <FieldGroup label="Tipo sanguíneo">
            <SangueGrid valor={f.sangue} onChange={f.setSangue} />
          </FieldGroup>

          <div className="stack" style={{ gap: 6 }}>
            <div className="card" style={{ fontSize: 15 }}>
              <LinhaCampo rotulo="Peso" sufixo="kg" className="mono" inputMode="decimal" placeholder="72,5" value={f.peso} onChange={(e) => f.setPeso(e.target.value)} aria-label="Peso em kg" />
              <LinhaCampo rotulo="Altura" sufixo="m" className="mono" inputMode="decimal" placeholder="1,74" value={f.altura} onChange={(e) => f.setAltura(e.target.value)} aria-label="Altura em metros" />
              <LinhaCampo
                rotulo={
                  <span className="stack" style={{ gap: 2 }}>
                    <span>Pressão</span>
                    {f.dataPressao && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.dataPressao === HOJE ? 'medida hoje' : `medida em ${dataBR(f.dataPressao)}`}</span>}
                  </span>
                }
                className="mono"
                placeholder="120/80"
                value={f.pressao}
                onChange={(e) => f.setPressao(e.target.value)}
                aria-label="Pressão"
              />
            </div>
            {erroTexto(f.erros.peso)}
            {erroTexto(f.erros.altura)}
          </div>
        </>
      )}

      <Sugestoes />
      <FieldGroup label="Alergias">
        <div className="card" style={{ fontSize: 15 }}>
          {f.alergias.map((a) => (
            <div key={a.chave} data-item className="row" style={{ padding: '0 4px 0 16px', gap: 8 }}>
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <input
                  data-campo
                  className="inline-input"
                  style={{ textAlign: 'left', width: '100%', height: 44, paddingTop: 10 }}
                  autoFocus={a.chave === novo}
                  placeholder="Substância"
              list="sug-alergia"
                  aria-label={a.substancia ? `Substância — ${a.substancia}` : 'Substância da nova alergia'}
                  value={a.substancia}
                  onChange={(e) => f.setAlergia(a.chave, { substancia: e.target.value })}
                  onKeyDown={(e) => enterNaLinha(e, novaAlergia)}
                />
                <input
                  data-campo
                  className="inline-input"
                  style={{ textAlign: 'left', width: '100%', height: 44, paddingBottom: 10, fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}
                  placeholder="Reação"
              list="sug-reacao"
                  aria-label={a.substancia ? `Reação a ${a.substancia}` : 'Reação da nova alergia'}
                  value={a.reacao}
                  onChange={(e) => f.setAlergia(a.chave, { reacao: e.target.value })}
                  onKeyDown={(e) => enterNaLinha(e, novaAlergia)}
                />
              </div>
              <RemoverItem rotulo={`Remover alergia${a.substancia ? ` ${a.substancia}` : ''}`} onClick={() => f.removerAlergia(a.chave)} />
            </div>
          ))}
          <AdicionarItem onClick={novaAlergia}>+ Adicionar alergia</AdicionarItem>
        </div>
      </FieldGroup>

      {!f.pet && (
        <>
          <FieldGroup label="Condições">
            <div className="card" style={{ fontSize: 15 }}>
              {f.condicoes.map((c) => (
                <div key={c.chave} data-item className="row" style={{ padding: '0 4px 0 16px', gap: 8 }}>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <input
                      data-campo
                      className="inline-input"
                      style={{ textAlign: 'left', width: '100%', height: 44, paddingTop: 10 }}
                      autoFocus={c.chave === novo}
                      placeholder="Nome"
                      aria-label={c.nome ? `Nome da condição — ${c.nome}` : 'Nome da nova condição'}
                      value={c.nome}
                  list={LISTA_POR_TIPO[c.tipo]}
                      onChange={(e) => f.setCondicao(c.chave, { nome: e.target.value })}
                      onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                    />
                    <div className="hstack" style={{ gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                      <select
                        data-campo
                        className="inline-input"
                        style={{ textAlign: 'left', height: 44, paddingBottom: 10, fontWeight: 400, color: 'var(--text-2)', cursor: 'pointer' }}
                        aria-label={c.nome ? `Tipo de ${c.nome}` : 'Tipo da nova condição'}
                        value={c.tipo}
                        onChange={(e) => f.setCondicao(c.chave, { tipo: e.target.value as TipoCondicao })}
                        onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                      >
                        {TIPOS_CONDICAO.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                      <span aria-hidden style={{ color: 'var(--text-3)' }}>·</span>
                      <input
                        data-campo
                        className="inline-input mono"
                        style={{ textAlign: 'left', flex: 1, minWidth: 0, height: 44, paddingBottom: 10, color: 'var(--text-2)' }}
                        placeholder="Desde"
                        aria-label={c.nome ? `Desde — ${c.nome}` : 'Desde — nova condição'}
                        value={c.desde}
                        onChange={(e) => f.setCondicao(c.chave, { desde: e.target.value })}
                        onKeyDown={(e) => enterNaLinha(e, novaCondicao)}
                      />
                    </div>
                  </div>
                  <RemoverItem rotulo={`Remover ${c.nome || 'condição'}`} onClick={() => f.removerCondicao(c.chave)} />
                </div>
              ))}
              <AdicionarItem onClick={novaCondicao}>+ Adicionar condição</AdicionarItem>
            </div>
          </FieldGroup>

          <FieldGroup label="Contato de emergência">
            <div className="card" style={{ fontSize: 15 }}>
              <LinhaCampo rotulo="Nome" style={{ fontWeight: 400 }} placeholder="Nome" value={f.contato.nome} onChange={(e) => f.setContato({ nome: e.target.value })} aria-label="Nome do contato" />
              <LinhaCampo rotulo="Relação" style={{ fontWeight: 400 }} placeholder="Ex.: Filha" value={f.contato.relacao} onChange={(e) => f.setContato({ relacao: e.target.value })} aria-label="Relação" />
              <LinhaCampo rotulo="Telefone" className="mono" inputMode="tel" placeholder="(11) 90000-0000" value={f.contato.telefone} onChange={(e) => f.setContato({ telefone: mascararTelefone(e.target.value) })} aria-label="Telefone" />
            </div>
            {erroTexto(f.erros.contato)}
          </FieldGroup>
        </>
      )}

      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} disabled={!f.valido} onClick={f.salvar}>
        Salvar
      </button>
    </MScreen>
  );
}

type Form = ReturnType<typeof useFormPerfil>;

/** Campos do pet no lugar de sexo humano, sangue, peso, altura e pressão (o peso fica nas pesagens). */
function CamposPet({ f }: { f: Form }) {
  const fp = f.pet!;
  const sexo = sexoPetDoForm(f.sexo);
  const castrado = rotuloCastrado({ sexo: f.sexo });
  return (
    <>
      <FieldGroup label="Sexo">
        <ChipGroup largo opcoes={SEXOS_PET} valor={sexo} onChange={(v) => v && f.setSexo(sexo === v ? '' : SEXO_DO_PET[v])} />
      </FieldGroup>
      <div className="card" style={{ fontSize: 15 }}>
        <LinhaCampo rotulo="Raça" style={{ fontWeight: 400 }} placeholder="Ex.: Border Collie" value={fp.raca} onChange={(e) => f.setPet({ raca: e.target.value })} aria-label="Raça" autoComplete="off" />
        <Row tight mutedLabel={false} label={<span className="row__label">{castrado}</span>} valor={<Toggle on={fp.castrado} onChange={(v) => f.setPet({ castrado: v })} label="Castrado(a)" />} />
        <LinhaCampo rotulo="Microchip" className="mono" inputMode="numeric" placeholder="15 dígitos" value={fp.microchip} onChange={(e) => f.setPet({ microchip: e.target.value })} aria-label="Microchip" autoComplete="off" />
      </div>

      <FieldGroup label="Veterinário">
        <div className="card" style={{ fontSize: 15 }}>
          <LinhaCampo rotulo="Nome" style={{ fontWeight: 400 }} placeholder="Nome" value={fp.veterinario.nome} onChange={(e) => f.setVeterinario({ nome: e.target.value })} aria-label="Nome do veterinário" />
          <LinhaCampo rotulo="Clínica" style={{ fontWeight: 400 }} placeholder="Clínica" value={fp.veterinario.clinica} onChange={(e) => f.setVeterinario({ clinica: e.target.value })} aria-label="Clínica do veterinário" />
          <LinhaCampo rotulo="Telefone" className="mono" inputMode="tel" placeholder="(11) 3000-0000" value={fp.veterinario.telefone} onChange={(e) => f.setVeterinario({ telefone: mascararTelefone(e.target.value) })} aria-label="Telefone do veterinário" />
        </div>
        {erroTexto(f.erros.veterinario)}
      </FieldGroup>

      <FieldGroup label="Clínica 24 h">
        <div className="card" style={{ fontSize: 15 }}>
          <LinhaCampo rotulo="Nome" style={{ fontWeight: 400 }} placeholder="Nome" value={fp.clinica24h.nome} onChange={(e) => f.setClinica24h({ nome: e.target.value })} aria-label="Nome da clínica 24 h" />
          <LinhaCampo rotulo="Telefone" className="mono" inputMode="tel" placeholder="(11) 3000-0000" value={fp.clinica24h.telefone} onChange={(e) => f.setClinica24h({ telefone: mascararTelefone(e.target.value) })} aria-label="Telefone da clínica 24 h" />
        </div>
        {erroTexto(f.erros.clinica24h)}
      </FieldGroup>
    </>
  );
}

/** Linha "rótulo · campo": o `<label>` faz a linha toda focar o campo; o campo tem 44 px de altura e ocupa o espaço livre. */
export function LinhaCampo({ rotulo, sufixo, className, style, ...campo }: { rotulo: ReactNode; sufixo?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="row" style={{ padding: '0 16px', minHeight: 44, cursor: 'text' }}>
      <span className="row__label">{rotulo}</span>
      <span className="row__value hstack" style={{ flex: 1, minWidth: 0 }}>
        <input {...campo} className={['inline-input', className].filter(Boolean).join(' ')} style={{ flex: 1, minWidth: 0, height: 44, ...style }} />
        {sufixo && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>&nbsp;{sufixo}</span>}
      </span>
    </label>
  );
}

function RemoverItem({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={rotulo} onClick={onClick} style={{ width: 44, height: 44, flex: 'none', fontSize: 20, color: 'var(--text-3)' }}>
      ×
    </button>
  );
}

export function AdicionarItem({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" className="row" style={{ padding: '12px 16px', minHeight: 44, color: 'var(--teal)', fontWeight: 500, justifyContent: 'flex-start' }} onClick={onClick}>
      {children}
    </button>
  );
}
