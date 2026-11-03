import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { HOJE } from '../data/tempo';
import { compartilhado, editaveis, eu, pessoa, podeVer, useStore, type State } from '../data/store';
import { dataBR, diaMes, idade, numBR, numCurto, quem } from '../data/format';
import { CATEGORIAS, type Categoria, type Medicao, type Pessoa, type Plano } from '../data/types';
import { fmtMedicao, infoMedicao } from '../data/medicoes';
import { Avatar, FieldGroup, Label, Pill, Row, SecaoLista, Toggle, TopNav } from '../ui';
import { descricaoPet, ehPet, familia, pesoAtual, pets, telHref } from '../data/pets';
import { FotoDoPerfil } from '../ui/Foto';
import { PetPerfil } from './Pet';
import { MScreen, TabHeader } from './Shell';
import { GaleriaAnexos } from '../ui/Anexos';
import { ConfirmarSheet, RemoverPessoaMobile } from '../ui/Confirmar';

const NOMES_CAT: Record<Categoria, string> = { perfil: 'Perfil clínico', remedios: 'Remédios', consultas: 'Consultas', exames: 'Exames', plano: 'Plano' };

/** "Perfil completo" quando tudo; senão lista curta ("Remédios e plano"). */
export function resumoCompartilhado(cats: Categoria[], estilo: 'frase' | 'curto' = 'frase') {
  if (cats.length === 5) return 'Perfil completo';
  if (cats.length === 0) return 'Nada';
  const nomes = cats.map((c) => NOMES_CAT[c]);
  if (estilo === 'curto') return nomes[nomes.length - 1];
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1].toLowerCase()}`;
}

/** Linha de idade e nascimento do cabeçalho do perfil (M10): "61 anos · nasc. 12/03/1965". */
function linhaIdade(p: Pessoa) {
  const a = idade(p);
  return [a != null && `${a} anos`, p.nascimento && `nasc. ${dataBR(p.nascimento)}`].filter(Boolean).join(' · ');
}

function subtitulo(s: State, p: Pessoa) {
  // Pets são da casa: sem compartilhamento, só a descrição.
  if (ehPet(p)) return descricaoPet(p);
  const partes: string[] = [];
  if (p.souEu) partes.push('você');
  else {
    if (p.parentesco) partes.push(p.parentesco);
    const cats = compartilhado(s, p.id, eu(s).id);
    partes.push(cats.length === 5 ? 'compartilha tudo com você' : `compartilha ${resumoCompartilhado(cats).toLowerCase()} com você`);
  }
  return partes.join(' · ');
}

/** M12 — Família (aba). */
export function Familia() {
  const { state } = useStore();
  const nav = useNavigate();
  const me = eu(state);
  const outros = familia(state).filter((p) => !p.souEu);
  const listaPets = pets(state);
  const compartilhamComigo = outros.filter((p) => compartilhado(state, p.id, me.id).length > 0);
  const meus = state.compartilhamentos.filter((c) => c.de === me.id);

  return (
    <MScreen tabs>
      <TabHeader titulo="Família" direita={<button type="button" style={{ fontSize: 15, fontWeight: 500, color: 'var(--teal)' }} onClick={() => nav('/configuracoes')}>Configurações</button>} />
      <button type="button" className="card hstack" style={{ flexDirection: 'row', padding: 16, gap: 14, textAlign: 'left' }} onClick={() => nav(`/pessoa/${me.id}`)}>
        <Avatar pessoa={me} size={52} font={19} />
        <div className="stack" style={{ flex: 1, gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{me.nome}</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Você · {idade(me)} anos{me.sangue ? ` · ${me.sangue}` : ''}</span>
        </div>
        <span className="chev">›</span>
      </button>

      {compartilhamComigo.length > 0 && (
        <>
          <Label>Compartilhados com você</Label>
          <div className="card">
            {compartilhamComigo.map((p) => {
              const cats = compartilhado(state, p.id, me.id);
              return (
                <button type="button" key={p.id} className="row" style={{ padding: '14px 16px', gap: 14, justifyContent: 'flex-start' }} onClick={() => nav(`/pessoa/${p.id}`)}>
                  <Avatar pessoa={p} size={44} font={16} />
                  <div className="stack" style={{ flex: 1, gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{p.curto}</span>
                    <div className="hstack" style={{ gap: 4 }}>
                      {cats.length === 5 ? (
                        <Pill pequeno>Perfil completo</Pill>
                      ) : (
                        cats.map((c) => <Pill key={c} tom="neutral" pequeno>{NOMES_CAT[c]}</Pill>)
                      )}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {meus.length > 0 && (
        <>
          <Label>Você compartilha com</Label>
          <div className="card" style={{ fontSize: 15 }}>
            {meus.map((c) => (
              <Row key={c.para} mutedLabel={false} label={pessoa(state, c.para)?.curto} valor={<span className="muted">{resumoCompartilhado(c.categorias, 'curto')} ›</span>} onClick={() => nav(`/compartilhar/${c.para}`)} />
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn--dashed btn--h50" onClick={() => nav('/cadastro')}>Convidar ou adicionar pessoa</button>

      <SecaoLista rotulo="Pets" style={{ paddingTop: 8 }} />
      {listaPets.length > 0 && (
        <div className="card">
          {listaPets.map((p) => (
            <button type="button" key={p.id} className="row" style={{ padding: '14px 16px', gap: 14, justifyContent: 'flex-start' }} onClick={() => nav(`/pessoa/${p.id}`)}>
              <Avatar pessoa={p} size={44} font={16} />
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{p.curto}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{descricaoPet(p)}</span>
              </div>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn--dashed btn--h50" onClick={() => nav('/pet/novo')}>Adicionar pet</button>
    </MScreen>
  );
}

/** M04 — Perfil do membro. */
export function PerfilMembro() {
  const { id } = useParams();
  const { state } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, id ?? '');
  if (!p) return <MScreen><TopNav voltar="Família" voltarPara="/familia" /><span className="muted">Pessoa não encontrada.</span></MScreen>;
  if (ehPet(p)) return <PetPerfil key={p.id} pet={p} />;

  const ver = (c: Categoria) => podeVer(state, p.id, c);
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === p.id);
  const prox = state.consultas.find((c) => c.pessoaId === p.id && c.data >= HOJE);
  const exames = state.exames.filter((e) => e.pessoaId === p.id);
  const plano = state.planos.find((x) => x.pessoaId === p.id);
  const alergia = p.alergias[0];
  const historico = p.condicoes.filter((c) => c.tipo !== 'vacina');
  const podeEditar = editaveis(state).some((x) => x.id === p.id);
  const nasc = linhaIdade(p);

  return (
    <MScreen gap={18}>
      <TopNav voltar="Família" voltarPara="/familia" acao={podeEditar ? 'Editar' : undefined} onAcao={() => nav(`/pessoa/${p.id}/editar`)} />
      <div className="hstack" style={{ gap: 14 }}>
        <FotoDoPerfil pessoa={p} tamanho={72} podeEditar={podeEditar} />
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>{p.nome.split(' ').filter((_, i, a) => i === 0 || i === a.length - 1).join(' ')}</h1>
          {nasc && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{nasc}</span>}
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{subtitulo(state, p)}</span>
        </div>
      </div>

      {ver('perfil') && (
        <>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            {[
              ['Sangue', p.sangue ?? '—'],
              ['Peso', p.peso ? `${numCurto(p.peso)} kg` : '—'],
              ['Altura', p.altura ? `${numBR(p.altura)} m` : '—'],
            ].map(([k, v], i) => (
              <div key={k} className="stack" style={{ padding: '12px 14px', gap: 2, borderRight: i < 2 ? '1px solid var(--divider)' : undefined }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{k}</span>
                <span style={{ fontSize: 20, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          {alergia && (
            <div className="card card--warn" style={{ padding: '14px 16px', gap: 4 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--warn-text)' }}>ALERGIA</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--warn-strong)' }}>{p.alergias.map((a) => a.substancia).join(', ')}</span>
              {alergia.reacao && <span style={{ fontSize: 13, color: 'var(--warn-text)' }}>{alergia.reacao}{alergia.ano ? ` (${alergia.ano})` : ''}</span>}
            </div>
          )}
          {historico.length > 0 && (
            <div className="card">
              <span className="label" style={{ padding: '12px 16px 4px' }}>Condições e histórico</span>
              {historico.map((c) => (
                <Row key={c.nome} mutedLabel={false} label={c.nome} valor={<span className="faint">{c.desde}</span>} style={{ padding: '10px 16px', fontSize: 15 }} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="card" style={{ fontSize: 15 }}>
        {ver('perfil') && <Row mutedLabel={false} label="Histórico" valor={<span className="muted">linha do tempo ›</span>} onClick={() => nav(`/pessoa/${p.id}/historico`)} />}
        {ver('perfil') && <Row mutedLabel={false} label="Medições" valor={<span className="muted">{resumoMedicoes(state.medicoes, p.id)} ›</span>} onClick={() => nav(`/pessoa/${p.id}/medicoes`)} />}
        {ver('remedios') && <Row mutedLabel={false} label="Remédios" valor={<span className="muted">{remedios.length} em uso ›</span>} onClick={() => nav('/remedios')} />}
        {ver('consultas') && <Row mutedLabel={false} label="Consultas" valor={<span className="muted">{prox ? `próxima ${diaMes(prox.data)}` : 'nenhuma marcada'} ›</span>} onClick={() => nav('/agenda')} />}
        {ver('exames') && <Row mutedLabel={false} label="Exames" valor={<span className="muted">{exames.length} arquivados ›</span>} onClick={() => nav('/exames')} />}
        {ver('plano') && <Row mutedLabel={false} label="Plano de saúde" valor={<span className="muted">{plano ? plano.operadora.split(' ')[0] : 'adicionar'} ›</span>} onClick={() => nav(`/pessoa/${p.id}/plano`)} />}
      </div>

      {ver('perfil') && (
        <div className="card" style={{ fontSize: 15 }}>
          <span className="label" style={{ padding: '12px 16px 4px' }}>Vacinas</span>
          {state.vacinas.filter((v) => v.pessoaId === p.id).sort((a, b) => b.data.localeCompare(a.data)).map((v) => (
            <Row key={v.id} mutedLabel={false} label={v.nome} valor={<span className="faint mono" style={{ fontSize: 13 }}>{dataBR(v.data)}{v.proxima ? ` · reforço ${dataBR(v.proxima)}` : ''}</span>} style={{ padding: '10px 16px' }} />
          ))}
          {podeEditar && <Row mutedLabel={false} label={<span style={{ color: 'var(--teal)', fontWeight: 600 }}>+ Registrar vacina</span>} onClick={() => nav(`/pet/${p.id}/vacina`)} style={{ padding: '10px 16px' }} />}
        </div>
      )}
      {ver('perfil') && (
        <button type="button" className="btn btn--outline-ink btn--h50" onClick={() => nav(`/pessoa/${p.id}/emergencia`)}>Ficha de emergência</button>
      )}
      {podeEditar && <RemoverPessoaMobile p={p} />}
    </MScreen>
  );
}

/**
 * Carteirinha em tela cheia ("Mostrar no balcão"). Fecha com clique/toque ou Esc.
 * Celular (M09): camada branca dentro da tela. Desktop (D06): camada `#14202A` sobre a janela toda.
 */
export function CarteirinhaBalcao({ plano, nome, onClose, desktop = false }: { plano: Plano; nome: string; onClose: () => void; desktop?: boolean }) {
  const camada = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abriu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    camada.current?.focus();
    return () => abriu?.focus();
  }, []);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onClose]);

  if (desktop) {
    return (
      <div ref={camada} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Carteirinha" className="balcao" onClick={onClose}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>{plano.operadora}</span>
        <span className="mono" style={{ fontSize: 56, fontWeight: 500, lineHeight: 1.15, letterSpacing: '.02em' }}>{plano.numero}</span>
        <span style={{ fontSize: 20 }}>{nome}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 32 }}>Esc ou clique para fechar</span>
      </div>
    );
  }

  return (
    <div
      ref={camada}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Carteirinha"
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', cursor: 'pointer', outline: 'none' }}
    >
      <span style={{ fontSize: 18, fontWeight: 600 }}>{plano.operadora} · {plano.produto}</span>
      <span className="mono" style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.2, letterSpacing: '.02em' }}>
        {plano.numero.split(' ').slice(0, 3).join(' ')}<br />{plano.numero.split(' ').slice(3).join(' ')}
      </span>
      <span style={{ fontSize: 17 }}>{nome}</span>
      <span style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 24 }}>Toque para fechar</span>
    </div>
  );
}

/** "pressão 130/80", "peso 82 kg" ou "registrar". */
function resumoMedicoes(ms: Medicao[], pessoaId: string) {
  const ult = [...ms].filter((m) => m.pessoaId === pessoaId).sort((a, b) => a.data.localeCompare(b.data)).pop();
  return ult ? `${infoMedicao(ult.tipo).nome.toLowerCase()} ${fmtMedicao(ult)}` : 'registrar';
}

/** Aba Plano: as carteirinhas da família (você primeiro). Toque abre a carteirinha (M09). */
export function Planos() {
  const { state, perfil } = useStore();
  const nav = useNavigate();
  const doPerfil = perfil ? pessoa(state, perfil) : undefined;
  // No perfil de alguém: só a carteirinha dele. Pet não tem plano de saúde.
  if (doPerfil && ehPet(doPerfil)) {
    return (
      <MScreen tabs>
        <TabHeader titulo="Plano de saúde" />
        <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{doPerfil.curto} não tem plano de saúde</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>Veterinário e clínica 24 h ficam no perfil do pet.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => nav(`/pessoa/${doPerfil.id}`)}>Abrir perfil do pet</button>
        </div>
      </MScreen>
    );
  }
  const pessoas = (doPerfil ? [doPerfil] : familia(state))
    .filter((p) => p.souEu || podeVer(state, p.id, 'plano'))
    .sort((a, b) => Number(!!b.souEu) - Number(!!a.souEu));
  const comPlano = pessoas.flatMap((p) => state.planos.filter((x) => x.pessoaId === p.id).map((pl) => ({ p, pl })));
  const semPlano = pessoas.filter((p) => !state.planos.some((x) => x.pessoaId === p.id) && editaveis(state).some((x) => x.id === p.id));

  return (
    <MScreen tabs>
      <TabHeader titulo="Plano de saúde" />
      {comPlano.length === 0 && (
        <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma carteirinha guardada</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>Guarde os dados da carteirinha para ter o número à mão no balcão.</span>
        </div>
      )}
      {comPlano.length > 0 && (
        <div className="card">
          {comPlano.map(({ p, pl }) => (
            <button type="button" key={pl.id} className="row" style={{ padding: '14px 16px', gap: 14, justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => nav(`/pessoa/${p.id}/plano`)}>
              <Avatar pessoa={p} size={44} font={16} />
              <div className="stack" style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{p.souEu ? 'Você' : p.curto}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{[pl.operadora, pl.produto].filter(Boolean).join(' · ')}</span>
                <span className="mono" style={{ fontSize: 13 }}>{pl.numero}</span>
              </div>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
      {semPlano.length > 0 && (
        <>
          <Label>Sem carteirinha</Label>
          <div className="card">
            {semPlano.map((p) => (
              <button type="button" key={p.id} className="row" style={{ padding: '12px 16px', gap: 14, justifyContent: 'flex-start', textAlign: 'left', minHeight: 44 }} onClick={() => nav(`/pessoa/${p.id}/plano/novo`)}>
                <Avatar pessoa={p} size={36} font={13} />
                <span style={{ flex: 1, fontSize: 15 }}>{p.souEu ? 'Você' : p.curto}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>Adicionar</span>
              </button>
            ))}
          </div>
        </>
      )}
    </MScreen>
  );
}

/** M09 — Plano de saúde / carteirinha. */
export function PlanoSaude() {
  const { id } = useParams();
  const { state, api } = useStore();
  const p = pessoa(state, id ?? '');
  const plano = state.planos.find((x) => x.pessoaId === id);
  const [balcao, setBalcao] = useState(false);
  const [apagar, setApagar] = useState(false);
  const nav = useNavigate();
  const podeEditarPlano = !!plano && editaveis(state).some((x) => x.id === plano.pessoaId);

  if (!p) return null;
  if (!plano) {
    return (
      <MScreen gap={18}>
        <TopNav voltar={quem(p) === 'Você' ? 'Perfil' : p.curto} />
        <h1 className="title" style={{ margin: 0 }}>Plano de saúde</h1>
        <div className="card card--dashed" style={{ padding: 18, gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma carteirinha guardada</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>Guarde os dados da carteirinha para ter o número à mão no balcão.</span>
          <button type="button" className="btn btn--soft btn--h40" style={{ marginTop: 6 }} onClick={() => nav(`/pessoa/${p.id}/plano/novo`)}>Adicionar plano</button>
        </div>
      </MScreen>
    );
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(plano.numero.replace(/\s/g, '')); } catch { /* sem permissão de área de transferência */ }
    api.toast({ texto: 'Número da carteirinha copiado' });
  };
  const mini = { fontSize: 11, color: 'var(--tab-inactive)' };

  return (
    <MScreen gap={18}>
      <TopNav voltar={p.souEu ? 'Perfil' : p.curto} acao={podeEditarPlano ? 'Editar' : undefined} onAcao={() => nav(`/pessoa/${p.id}/plano/editar`)} />
      <h1 className="title" style={{ margin: 0 }}>Plano de saúde</h1>
      <div className="stack" style={{ borderRadius: 12, background: 'var(--ink)', color: '#fff', padding: 20, gap: 22, boxShadow: 'var(--shadow-plan)' }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{plano.operadora}</span>
          <span className="mono" style={{ ...mini }}>ANS {plano.registroAns}</span>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--tab-inactive)' }}>CARTEIRINHA</span>
          <span className="mono" style={{ fontSize: 21, fontWeight: 500, letterSpacing: '.02em' }}>{plano.numero}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10, fontSize: 14 }}>
          <div className="stack" style={{ gap: 2 }}><span style={mini}>Titular</span><span>{plano.titularNome}</span></div>
          <div className="stack" style={{ gap: 2 }}><span style={mini}>Plano</span><span>{plano.produto}</span></div>
          <div className="stack" style={{ gap: 2 }}><span style={mini}>Validade</span><span>{plano.validade}</span></div>
        </div>
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--teal btn--h50 btn--grow" onClick={() => setBalcao(true)}>Mostrar no balcão</button>
        <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={copiar}>Copiar nº</button>
      </div>
      <div className="card" style={{ fontSize: 14 }}>
        <Row label="Acomodação" valor={plano.acomodacao} />
        <Row label="Segmentação" valor={plano.segmentacao} />
        <Row label="Abrangência" valor={plano.abrangencia} />
        <Row label="Carências" valor={plano.carencias} />
        {plano.cns && <Row label="Cartão SUS (CNS)" valor={<span className="mono">{plano.cns}</span>} />}
        {plano.central && <Row label="Central 24 h" valor={<a href={`tel:${plano.central.replace(/\s/g, '')}`} style={{ fontWeight: 600 }}>{plano.central}</a>} />}
      </div>
      <FieldGroup label="Fotos da carteirinha (frente e verso)">
        <GaleriaAnexos donoId={plano.id} tipo="carteirinha" camera podeEditar={editaveis(state).some((x) => x.id === plano.pessoaId)} />
      </FieldGroup>
      <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>Informações digitadas por você. Em caso de dúvida, confirme com a operadora.</span>
      {podeEditarPlano && <button type="button" className="btn btn--danger-link" style={{ minHeight: 44, fontSize: 15 }} onClick={() => setApagar(true)}>Apagar plano</button>}
      {apagar && (
        <ConfirmarSheet
          titulo={`Apagar o plano ${plano.operadora}?`}
          texto="A carteirinha e as fotos dela saem do arquivo."
          confirmar="Apagar plano"
          onConfirm={() => { setApagar(false); api.remover('planos', plano, 'Plano apagado'); }}
          onClose={() => setApagar(false)}
        />
      )}

      {balcao && <CarteirinhaBalcao plano={plano} nome={p.nome} onClose={() => setBalcao(false)} />}
    </MScreen>
  );
}

/** M13 — Compartilhar meu perfil (passo 1 de 2). */
export function Compartilhar() {
  const { id } = useParams();
  const { state, api } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, id ?? '');
  const atual = compartilhado(state, eu(state).id, id ?? '');
  const [cats, setCats] = useState<Categoria[]>(atual.length ? atual : ['perfil', 'remedios', 'plano']);
  const [qr, setQr] = useState<string | null>(null);

  const gerar = async () => {
    const payload = JSON.stringify({ v: 1, de: eu(state).id, para: id, cats, nonce: crypto.getRandomValues(new Uint32Array(2)).join('') });
    setQr(await QRCode.toDataURL(payload, { margin: 0, width: 192, color: { dark: '#14202A', light: '#FFFFFF' } }));
  };

  // Pets não entram em compartilhamento.
  if (!p || ehPet(p)) return null;
  const toggle = (c: Categoria, on: boolean) => {
    setCats(on ? [...cats, c].sort((a, b) => CATEGORIAS.findIndex((x) => x.id === a) - CATEGORIAS.findIndex((x) => x.id === b)) : cats.filter((x) => x !== c));
    setQr(null);
  };
  const concluir = () => {
    api.compartilhar(p.id, cats);
    api.toast({ texto: `Compartilhamento com ${p.curto} atualizado` });
    nav('/familia');
  };

  return (
    <MScreen gap={16}>
      <TopNav voltar="Cancelar" voltarPara="/familia" extra={<span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>1 de 2</span>} />
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title title--26" style={{ margin: 0 }}>O que {p.sexo === 'Feminino' ? 'a' : 'o'} {p.curto} pode ver?</h1>
        <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--text-2)' }}>Você pode mudar ou parar de compartilhar quando quiser.</span>
      </div>
      <div className="card" style={{ fontSize: 15 }}>
        {CATEGORIAS.map((c) => (
          <Row
            key={c.id}
            mutedLabel={false}
            label={
              <span className="stack" style={{ gap: 2 }}>
                <span>{c.nome}</span>
                {(c.id === 'perfil' || c.id === 'remedios') && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.detalhe}</span>}
              </span>
            }
            valor={<Toggle on={cats.includes(c.id)} onChange={(v) => toggle(c.id, v)} label={c.nome} />}
          />
        ))}
      </div>
      <div className="card" style={{ padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        {qr ? (
          <img src={qr} alt="QR code de pareamento" width={96} height={96} style={{ borderRadius: 6, flex: 'none' }} />
        ) : (
          <span className="ph" style={{ width: 96, height: 96, borderRadius: 6, flex: 'none', fontSize: 10 }}>QR code</span>
        )}
        <div className="stack" style={{ gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{qr ? 'Código pronto' : 'Próximo passo'}</span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-2)' }}>
            {p.curto} lê este código no aparelho dele. A conexão é direta entre os dois celulares.
          </span>
        </div>
      </div>
      <button type="button" className="btn btn--cta" style={{ marginTop: 'auto' }} onClick={() => (qr ? concluir() : gerar())}>
        {qr ? 'Concluir' : 'Gerar código'}
      </button>
    </MScreen>
  );
}

/** M14 — Ficha de emergência. */
export function FichaEmergencia({ onClose, pessoaId }: { onClose?: () => void; pessoaId?: string }) {
  const params = useParams();
  const id = pessoaId ?? params.id;
  const { state } = useStore();
  const nav = useNavigate();
  const p = pessoa(state, id ?? '') ?? state.pessoas.find((x) => x.id === 'roberto') ?? eu(state);
  const fechar = () => (onClose ? onClose() : nav(-1));
  if (ehPet(p)) return <FichaEmergenciaPet p={p} onClose={fechar} />;
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === p.id && !r.seNecessario);
  const plano = state.planos.find((x) => x.pessoaId === p.id);
  const condicoes = p.condicoes.filter((c) => c.tipo === 'condicao').map((c) => c.nome).join(' · ');
  const contato = p.contatoEmergencia;
  const nomeCurto = (() => { const n = p.nome.split(' '); return n.length > 2 ? `${n[0]} ${n[1][0]}. ${n[n.length - 1]}` : p.nome; })();

  return (
    <MScreen bg="#fff" pad="0" gap={0} statusStyle={{ background: 'var(--danger)', color: '#fff' }}>
      <div className="stack" style={{ background: 'var(--danger)', color: '#fff', padding: '10px 22px 22px', gap: 6 }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '.12em' }}>FICHA DE EMERGÊNCIA</span>
          <button type="button" style={{ fontSize: 15, fontWeight: 600, minHeight: 44, margin: '-11px 0' }} onClick={fechar}>Fechar</button>
        </div>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{nomeCurto}</span>
        <span style={{ fontSize: 15, opacity: 0.9 }}>{idade(p)} anos{p.nascimento ? ` · nasc. ${dataBR(p.nascimento)}` : ''}</span>
      </div>
      <div className="stack" style={{ flex: 1, padding: '18px 22px 30px', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
          <div className="stack" style={{ borderRadius: 8, background: 'var(--bg)', padding: 14, gap: 2 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sangue</span>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{p.sangue ?? '?'}</span>
          </div>
          <div className="stack" style={{ borderRadius: 8, background: p.alergias.length ? 'var(--warn-bg)' : 'var(--bg)', padding: 14, gap: 2 }}>
            <span style={{ fontSize: 12, color: p.alergias.length ? 'var(--warn-text)' : 'var(--text-2)', fontWeight: 600 }}>{p.alergias.length ? 'ALÉRGICO A' : 'ALERGIAS'}</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: p.alergias.length ? 'var(--warn-strong)' : undefined }}>
              {p.alergias.length ? p.alergias.map((a) => a.substancia).join(', ') : 'Nenhuma conhecida'}
            </span>
          </div>
        </div>
        {condicoes && (
          <div className="stack" style={{ gap: 6 }}><span style={rot}>CONDIÇÕES</span><span style={{ fontSize: 18, fontWeight: 500 }}>{condicoes}</span></div>
        )}
        {remedios.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span style={rot}>REMÉDIOS EM USO</span>
            {remedios.map((r) => <span key={r.id} style={{ fontSize: 18, fontWeight: 500 }}>{r.nome} · {r.horarios.length}x ao dia</span>)}
          </div>
        )}
        {plano && (
          <div className="stack" style={{ gap: 6 }}>
            <span style={rot}>PLANO DE SAÚDE</span>
            <span style={{ fontSize: 18, fontWeight: 500 }}>{plano.operadora} · {plano.produto}</span>
            <span className="mono" style={{ fontSize: 16 }}>{plano.numero}</span>
          </div>
        )}
        <div className="stack" style={{ marginTop: 'auto', gap: 8 }}>
          {contato && (
            <>
              <span style={rot}>CONTATO DE EMERGÊNCIA</span>
              <a href={`tel:${contato.telefone.replace(/\D/g, '')}`} className="hstack" style={{ height: 60, borderRadius: 6, background: 'var(--ink)', color: '#fff', justifyContent: 'space-between', padding: '0 18px' }}>
                <span className="stack">
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Ligar para {contato.nome}</span>
                  <span style={{ fontSize: 13, color: 'var(--tab-inactive)' }}>{[contato.relacao, contato.telefone].filter(Boolean).join(' · ')}</span>
                </span>
                <span style={{ fontSize: 20 }}>›</span>
              </a>
            </>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Visível na tela bloqueada, se você ativar</span>
        </div>
      </div>
    </MScreen>
  );
}

const rot = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.06em' };

/** Ficha de emergência do pet no celular: mesma faixa vermelha; peso, alergias, microchip, remédios e as ligações. */
function FichaEmergenciaPet({ p, onClose }: { p: Pessoa; onClose: () => void }) {
  return (
    <MScreen bg="#fff" pad="0" gap={0} statusStyle={{ background: 'var(--danger)', color: '#fff' }}>
      <div className="stack" style={{ background: 'var(--danger)', color: '#fff', padding: '10px 22px 22px', gap: 6 }}>
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '.12em' }}>FICHA DE EMERGÊNCIA</span>
          <button type="button" style={{ fontSize: 15, fontWeight: 600, minHeight: 44, margin: '-11px 0' }} onClick={onClose}>Fechar</button>
        </div>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{p.nome}</span>
        <span style={{ fontSize: 15, opacity: 0.9 }}>{descricaoPet(p)}</span>
      </div>
      <div className="stack" style={{ flex: 1, padding: '18px 22px 30px', gap: 14 }}>
        <CorpoFichaPet p={p} colunaPeso={120} rotulo={(t) => <span style={rot}>{t}</span>} />
      </div>
    </MScreen>
  );
}

/**
 * Corpo da ficha do pet, compartilhado com o desktop (DFichaEmergencia): peso e alergias lado a lado
 * (como sangue e alergias nas pessoas), microchip, remédios em uso e, no fim, veterinário e clínica 24 h.
 */
export function CorpoFichaPet({ p, colunaPeso, rotulo }: { p: Pessoa; colunaPeso: number; rotulo: (t: string) => ReactNode }) {
  const { state } = useStore();
  const peso = pesoAtual(state, p.id);
  const remedios = state.remedios.filter((r) => r.ativo && r.pessoaId === p.id && !r.seNecessario);
  const alergico = p.alergias.length > 0;
  const vet = p.pet?.veterinario;
  const c24 = p.pet?.clinica24h;
  const microchip = p.pet?.microchip;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `${colunaPeso}px 1fr`, gap: 10 }}>
        <div className="stack" style={{ borderRadius: 8, background: 'var(--bg)', padding: 14, gap: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Peso</span>
          <span style={{ fontSize: 28, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {peso ? <>{numCurto(peso.kg)}<span style={{ fontSize: 16, fontWeight: 600 }}> kg</span></> : '?'}
          </span>
          {peso && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>em {diaMes(peso.data)}</span>}
        </div>
        <div className="stack" style={{ borderRadius: 8, background: alergico ? 'var(--warn-bg)' : 'var(--bg)', padding: 14, gap: 2 }}>
          <span style={{ fontSize: 12, color: alergico ? 'var(--warn-text)' : 'var(--text-2)', fontWeight: 600 }}>{alergico ? 'ALÉRGICO A' : 'ALERGIAS'}</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: alergico ? 'var(--warn-strong)' : undefined }}>
            {alergico ? p.alergias.map((a) => a.substancia).join(', ') : 'Nenhuma conhecida'}
          </span>
        </div>
      </div>
      {microchip && (
        <div className="stack" style={{ gap: 6 }}>{rotulo('MICROCHIP')}<span className="mono" style={{ fontSize: 18 }}>{microchip}</span></div>
      )}
      {remedios.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {rotulo('REMÉDIOS EM USO')}
          {remedios.map((r) => <span key={r.id} style={{ fontSize: 18, fontWeight: 500 }}>{r.nome} · {r.horarios.length}x ao dia</span>)}
        </div>
      )}
      {(vet || c24) && (
        <div className="stack" style={{ marginTop: 'auto', gap: 14 }}>
          {vet && <div className="stack" style={{ gap: 8 }}>{rotulo('VETERINÁRIO')}<Ligacao nome={vet.nome} detalhe={vet.clinica} tel={vet.telefone} /></div>}
          {c24 && <div className="stack" style={{ gap: 8 }}>{rotulo('CLÍNICA 24 H')}<Ligacao nome={c24.nome} tel={c24.telefone} /></div>}
        </div>
      )}
    </>
  );
}

/** Botão escuro "Ligar para …" (o mesmo do contato de emergência); sem telefone, só o nome. */
function Ligacao({ nome, detalhe, tel }: { nome: string; detalhe?: string; tel?: string }) {
  const linha2 = [detalhe, tel].filter(Boolean).join(' · ');
  if (!tel) {
    return (
      <span className="stack" style={{ gap: 2 }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{nome}</span>
        {detalhe && <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{detalhe}</span>}
      </span>
    );
  }
  return (
    <a href={telHref(tel)} className="hstack" style={{ height: 60, borderRadius: 6, background: 'var(--ink)', color: '#fff', justifyContent: 'space-between', padding: '0 18px' }}>
      <span className="stack" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Ligar para {nome}</span>
        {linha2 && <span style={{ fontSize: 13, color: 'var(--tab-inactive)' }}>{linha2}</span>}
      </span>
      <span style={{ fontSize: 20 }} aria-hidden>›</span>
    </a>
  );
}
