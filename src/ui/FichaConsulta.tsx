// Ficha da consulta (pedido em 13/11/2026): médico com foto, local e "Como chegar", trajeto e hora de sair,
// preparo, o que levar, perguntas, plano e lembretes. O resumo para o médico fica logo abaixo, na mesma tela.
import { useState, type ReactNode } from 'react';
import { editaConsulta, pessoa, useStore } from '../data/store';
import { anexosDe, tamanhoDataUrl } from '../data/anexos';
import { chaveProfissional, destinoConsulta, distancia, horaDeSair, linkRota, textoTrajeto } from '../data/consultas';
import { dataLonga } from '../data/format';
import { telHref } from '../data/pets';
import { LEMBRAR } from '../data/formularios-puro';
import { novoId } from '../data/persistencia';
import { HOJE } from '../data/tempo';
import type { Consulta } from '../data/types';
import { CarteirinhaBalcao } from '../mobile/Familia';
import { useEscolherFoto } from './Foto';
import { SimuladorReembolso } from './Reembolso';
import { cx } from '.';

function Bloco({ rotulo, children, tom, direita }: { rotulo: string; children: ReactNode; tom?: 'warn'; direita?: ReactNode }) {
  return (
    <section className={cx('card ficha__bloco', tom === 'warn' && 'card--warn')}>
      <div className="ficha__rotulo">
        <span className="label" style={tom === 'warn' ? { color: 'var(--warn-text)' } : undefined}>{rotulo}</span>
        {direita}
      </div>
      {children}
    </section>
  );
}

/** Foto do profissional: a mesma em todas as consultas com ele (anexo `profissional`, chave pelo nome). */
function FotoProfissional({ nome, podeEditar }: { nome: string; podeEditar: boolean }) {
  const { state, api } = useStore();
  const chave = chaveProfissional(nome);
  const atual = anexosDe(state.anexos, chave, 'profissional').sort((a, b) => b.em.localeCompare(a.em))[0];
  const foto = useEscolherFoto((dados) => {
    anexosDe(state.anexos, chave, 'profissional').forEach((a) => api.removerAnexo(a));
    api.addAnexos([{ id: `anx-${novoId()}`, donoId: chave, tipo: 'profissional', nome: `${nome}.jpg`, mime: 'image/jpeg', dados, tamanho: tamanhoDataUrl(dados), em: new Date().toISOString() }]);
  });
  const iniciais = nome.replace(/^(dra?|dr\(a\))\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
  const conteudo = atual ? <img src={atual.dados} alt={`Foto de ${nome}`} /> : <span>{iniciais || '?'}</span>;
  return (
    <>
      {podeEditar ? (
        <button type="button" className="ficha__foto" onClick={foto.abrir} aria-label={atual ? `Trocar foto de ${nome}` : `Adicionar foto de ${nome}`}>
          {conteudo}
          <span className="ficha__foto-faixa">{atual ? 'Trocar' : 'Foto'}</span>
        </button>
      ) : <span className="ficha__foto">{conteudo}</span>}
      {foto.elemento}
    </>
  );
}

/** Perguntas para o médico: a pessoa vai juntando antes da consulta. */
function Perguntas({ c, podeEditar }: { c: Consulta; podeEditar: boolean }) {
  const { api } = useStore();
  const [nova, setNova] = useState('');
  const lista = c.perguntas ?? [];
  const salvar = (perguntas: string[]) => api.editar('consultas', c.id, { perguntas: perguntas.length ? perguntas : null }, 'Perguntas salvas');
  const adicionar = () => { if (nova.trim()) { salvar([...lista, nova.trim()]); setNova(''); } };
  if (!podeEditar && !lista.length) return null;
  return (
    <Bloco rotulo="Perguntas para o médico">
      {lista.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Anote aqui o que você quer perguntar.</span>}
      {lista.map((p, i) => (
        <div key={`${i}-${p}`} className="hstack ficha__linha">
          <span style={{ flex: 1 }}>{i + 1}. {p}</span>
          {podeEditar && <button type="button" className="ficha__x" onClick={() => salvar(lista.filter((_, j) => j !== i))} aria-label={`Tirar a pergunta ${i + 1}`}>×</button>}
        </div>
      ))}
      {podeEditar && (
        <form className="hstack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <input className="input" style={{ flex: 1 }} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Ex.: posso parar o remédio X?" aria-label="Nova pergunta" />
          <button type="submit" className="btn btn--soft btn--h40" disabled={!nova.trim()}>Adicionar</button>
        </form>
      )}
    </Bloco>
  );
}

/** A ficha inteira. `desktop`: duas colunas de blocos. */
export function FichaConsulta({ c, desktop }: { c: Consulta; desktop?: boolean }) {
  const { state, api } = useStore();
  const [carteirinha, setCarteirinha] = useState(false);
  const [simular, setSimular] = useState(false);
  const p = pessoa(state, c.pessoaId);
  if (!p) return null;
  const pode = editaConsulta(state, c.pessoaId);
  const destino = destinoConsulta(c);
  const sair = horaDeSair(c.hora, c.trajetoMin);
  const plano = state.planos.find((x) => x.pessoaId === c.pessoaId);
  const passou = c.data < HOJE;
  const dist = distancia(c.data, HOJE);

  return (
    <div className={cx('ficha', desktop && 'ficha--desk')}>
      <section className="card ficha__topo">
        <span className="ficha__quando">
          <span className="mono">{c.hora}</span>
          <span>{dataLonga(c.data)}{c.duracaoMin ? ` · ${c.duracaoMin} min` : ''}</span>
          <span className={cx('pill', passou ? 'pill--neutral' : dist === 'hoje' || dist === 'amanhã' ? 'pill--sol' : 'pill--teal')}>{dist}</span>
        </span>
        <div className="hstack" style={{ gap: 14, alignItems: 'center' }}>
          {c.profissional ? <FotoProfissional nome={c.profissional} podeEditar={pode} /> : null}
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span className="ficha__medico">{c.profissional ?? c.titulo}</span>
            <span className="muted" style={{ fontSize: 14 }}>{c.profissional ? c.titulo : 'Profissional não informado'}</span>
            <span className="muted" style={{ fontSize: 13 }}>Para {p.souEu ? 'você' : p.curto}</span>
          </span>
        </div>
        {c.telefone && (
          <a className="btn btn--outline btn--h40" href={telHref(c.telefone)} style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', gap: 8, display: 'inline-flex', alignItems: 'center' }}>Ligar <span className="mono" style={{ fontWeight: 400 }}>{c.telefone}</span></a>
        )}
      </section>

      {(c.local || c.endereco) && (
        <Bloco rotulo="Local">
          <span className="stack" style={{ gap: 2 }}>
            {c.local && <span style={{ fontWeight: 600 }}>{c.local}</span>}
            {c.endereco && <span className="muted" style={{ fontSize: 14 }}>{c.endereco}</span>}
          </span>
          {!passou && c.trajetoMin ? (
            <div className="ficha__trajeto">
              <span><b>{textoTrajeto(c.trajetoMin)}</b> de trajeto</span>
              {sair && <span>Saia às <b className="mono">{sair}</b> para chegar 15 min antes</span>}
            </div>
          ) : !passou && pode ? (
            <span className="muted" style={{ fontSize: 13 }}>Informe o tempo de trajeto em "Editar consulta" para saber que horas sair.</span>
          ) : null}
          {destino && (
            <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn--teal btn--h40" href={linkRota(c)} target="_blank" rel="noreferrer">Como chegar</a>
              <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Abre a rota no Google Maps, com o tempo de agora.</span>
            </div>
          )}
        </Bloco>
      )}

      {c.preparo && (
        <Bloco rotulo="Preparo" tom="warn">
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--warn-strong)' }}>{c.preparo}</span>
        </Bloco>
      )}

      {(c.levar.length > 0 || pode) && (
        <Bloco rotulo="O que levar" direita={c.levar.length ? <span className="muted" style={{ fontSize: 12 }}>{c.levar.filter((l) => l.ok).length} de {c.levar.length} separados</span> : undefined}>
          {c.levar.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Nada na lista. Adicione itens em "Editar consulta".</span>}
          {c.levar.map((l, i) => (
            <button type="button" key={`${i}-${l.item}`} className="hstack ficha__linha ficha__levar" disabled={!pode} aria-pressed={l.ok} onClick={() => api.toggleLevar(c.id, i)}>
              <span className={cx('ficha__check', l.ok && 'is-ok')}>{l.ok ? '✓' : ''}</span>
              <span>{l.item}</span>
            </button>
          ))}
        </Bloco>
      )}

      <Perguntas c={c} podeEditar={pode} />

      {(c.peloPlano || plano) && (
        <Bloco rotulo="Plano">
          <span>{c.peloPlano ? `Pelo plano · ${plano?.operadora ?? c.peloPlano.split(' · ')[0]}` : 'Particular'}</span>
          {plano && <span className="muted mono" style={{ fontSize: 13 }}>Carteirinha {plano.numero}</span>}
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            {plano && c.peloPlano && <button type="button" className="btn btn--soft btn--h40" onClick={() => setCarteirinha(true)}>Mostrar carteirinha</button>}
            {plano && <button type="button" className="btn btn--outline btn--h40" onClick={() => setSimular(true)}>Simular reembolso</button>}
          </div>
        </Bloco>
      )}

      {!passou && (
        <Bloco rotulo="Lembrar">
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {LEMBRAR.map((x) => (
              <button key={x} type="button" className={cx('chip chip--sm', c.lembretes.includes(x) && 'is-teal')} aria-pressed={c.lembretes.includes(x)} disabled={!pode} onClick={() => api.toggleLembrete(c.id, x)}>{x}</button>
            ))}
          </div>
        </Bloco>
      )}

      {simular && plano && <SimuladorReembolso plano={plano} servicoInicial={/psic/i.test(c.titulo) ? '50000470' : c.tipo === 'consulta' ? '10101012' : undefined} onClose={() => setSimular(false)} />}
      {carteirinha && plano && <CarteirinhaBalcao plano={plano} nome={p.nome} desktop={desktop} onClose={() => setCarteirinha(false)} />}
    </div>
  );
}
