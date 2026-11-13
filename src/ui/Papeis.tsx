// Hierarquia da família na tela: responsável na ficha, papéis da pessoa, pedidos e o selo de cada membro.
import { eu, pessoa as acharPessoa, useStore } from '../data/store';
import { NOME_NIVEL, nivel, papeisDaPessoa, pedidosParaMim, podeDecidir, podeMudarResponsavel, type Nivel, type NivelPapel } from '../data/papeis';
import { familia } from '../data/pets';
import { quem } from '../data/format';
import type { Pessoa } from '../data/types';
import { Avatar, cx } from '.';

/** Select "Responsável" da ficha. Travado para quem não pode trocar. */
export function CampoResponsavel({ p, valor, onChange, desktop }: { p: Pessoa; valor: string; onChange: (v: string) => void; desktop?: boolean }) {
  const { state } = useStore();
  const meu = eu(state)?.id;
  const pode = podeMudarResponsavel(state, meu, p.id);
  const opcoes = familia(state).filter((x) => x.id !== p.id);
  const atual = acharPessoa(state, p.responsavelId ?? '');
  return (
    <span className="stack" style={{ gap: 6 }}>
      <select className={cx('input', desktop && 'input--desk')} value={valor} disabled={!pode} onChange={(e) => onChange(e.target.value)} aria-label="Responsável">
        <option value="">Ninguém</option>
        {opcoes.map((x) => <option key={x.id} value={x.id}>{x.souEu ? `${x.curto} (você)` : x.curto}</option>)}
      </select>
      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>
        {pode
          ? 'O responsável edita tudo e aceita os pedidos de cuidador e administrador por esta pessoa. Em branco: ninguém é responsável.'
          : `Só ${p.curto} ou ${atual ? quem(atual) : 'o responsável'} podem trocar.`}
      </span>
    </span>
  );
}

const TOM: Record<Nivel, string> = { voce: 'pill--neutral', responsavel: 'pill--teal', administrador: 'pill--teal', cuidador: 'pill--sol' };

/** O que você é desta pessoa ("Você administra", "Você cuida"…), para a lista da família. */
export function SeloNivel({ p }: { p: Pessoa }) {
  const { state } = useStore();
  if (p.tipo === 'pet') return null;
  const meu = eu(state)?.id;
  const n = nivel(state, meu, p.id);
  const dela = meu && p.id !== meu ? nivel(state, p.id, meu) : undefined;
  const texto = n === 'responsavel' ? 'Você é responsável'
    : n === 'administrador' ? 'Você administra'
    : n === 'cuidador' ? 'Você cuida'
    : dela === 'responsavel' ? 'Responsável por você'
    : dela === 'administrador' ? 'Administra você'
    : dela === 'cuidador' ? 'Cuida de você'
    : undefined;
  if (!texto) return null;
  return <span className={cx('pill', TOM[n ?? dela ?? 'voce'])} style={{ flex: 'none' }}>{texto}</span>;
}

/** Ficha da pessoa: quem é responsável, quem administra e quem cuida; pedir, sair ou tirar. */
export function PapeisDaPessoa({ p, desktop }: { p: Pessoa; desktop?: boolean }) {
  const { state, api } = useStore();
  if (p.tipo === 'pet') return null;
  const meu = eu(state)?.id;
  const lista = papeisDaPessoa(state, p.id);
  const decide = podeDecidir(state, meu, p.id);
  const meuPapel = state.papeis.find((x) => x.de === p.id && x.para === meu);
  const meuNivel = nivel(state, meu, p.id);
  const pendentes = state.papeis.filter((x) => x.de === p.id && x.pedido);
  const btn = desktop ? 'btn btn--h40d' : 'btn btn--h40';
  const pedir = (papel: NivelPapel) => api.pedirPapel(p.id, papel);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="card" style={{ fontSize: 14 }}>
        {lista.length === 0 && <span style={{ padding: '12px 16px', color: 'var(--text-2)' }}>Ninguém cuida ou administra {p.souEu ? 'você' : p.curto}.</span>}
        {lista.map((x) => {
          const pessoa = acharPessoa(state, x.quem);
          if (!pessoa) return null;
          const podeTirar = x.nivel !== 'responsavel' && (decide || x.quem === meu);
          return (
            <div key={x.quem} className="row" style={{ padding: '10px 16px', gap: 10 }}>
              <span className="hstack" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
                <Avatar pessoa={pessoa} size={30} font={11} />
                <span className="stack" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{quem(pessoa)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{NOME_NIVEL[x.nivel]}</span>
                </span>
              </span>
              {podeTirar && (
                <button type="button" className="btn btn--h36" style={{ color: 'var(--danger)', fontSize: 13 }} onClick={() => api.removerPapel(p.id, x.quem)}>
                  {x.quem === meu ? 'Deixar' : 'Tirar'}
                </button>
              )}
            </div>
          );
        })}
        {pendentes.map((x) => {
          const pessoa = acharPessoa(state, x.para);
          if (!pessoa) return null;
          return (
            <div key={`p-${x.para}`} className="row" style={{ padding: '10px 16px', gap: 10, background: 'var(--sol-light)' }}>
              <span style={{ minWidth: 0 }}><b>{quem(pessoa)}</b> pediu para ser {x.pedido === 'administrador' ? 'administrador' : 'cuidador'}</span>
              {decide ? (
                <span className="hstack" style={{ gap: 6, flex: 'none' }}>
                  <button type="button" className="btn btn--teal btn--h36" onClick={() => api.responderPapel(p.id, x.para, true)}>Aceitar</button>
                  <button type="button" className="btn btn--h36" onClick={() => api.responderPapel(p.id, x.para, false)}>Recusar</button>
                </span>
              ) : x.para === meu ? (
                <button type="button" className="btn btn--h36" style={{ fontSize: 13 }} onClick={() => api.removerPapel(p.id, x.para)}>Cancelar pedido</button>
              ) : <span className="muted" style={{ fontSize: 12 }}>aguardando</span>}
            </div>
          );
        })}
      </div>
      {!p.souEu && meu && !meuPapel?.pedido && meuNivel !== 'responsavel' && meuNivel !== 'administrador' && (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
          {meuNivel !== 'cuidador' && <button type="button" className={cx(btn, 'btn--soft')} onClick={() => pedir('cuidador')}>Pedir para ser cuidador</button>}
          <button type="button" className={cx(btn, 'btn--outline')} onClick={() => pedir('administrador')}>Pedir para ser administrador</button>
        </div>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
        Cuidador vê tudo e marca as doses. Administrador também cadastra e edita. {p.souEu ? 'Você' : `${p.curto}${p.responsavelId ? ' ou o responsável' : ''}`} aceita os pedidos.
      </span>
    </div>
  );
}

/** Pedidos esperando a sua resposta (para você ou para quem você é responsável), no Início. */
export function PedidosPendentes() {
  const { state, api } = useStore();
  const meu = eu(state)?.id;
  const pedidos = pedidosParaMim(state, meu);
  if (!pedidos.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {pedidos.map((x) => {
        const quemPede = acharPessoa(state, x.para);
        const de = acharPessoa(state, x.de);
        if (!quemPede || !de) return null;
        return (
          <div key={`${x.de}-${x.para}`} className="card" style={{ padding: '12px 16px', gap: 10, background: 'var(--sol-light)', borderColor: 'transparent' }}>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>
              <b>{quemPede.curto}</b> quer ser {x.de === meu ? 'seu ' : ''}{x.pedido === 'administrador' ? 'administrador' : 'cuidador'}{x.de === meu ? '' : ` de ${de.curto}`}.{' '}
              <span style={{ color: 'var(--text-2)' }}>{x.pedido === 'administrador' ? 'Vai ver tudo e poder cadastrar e editar.' : 'Vai ver tudo e marcar as doses, sem editar.'}</span>
            </span>
            <span className="hstack" style={{ gap: 8 }}>
              <button type="button" className="btn btn--teal btn--h36" onClick={() => api.responderPapel(x.de, x.para, true)}>Aceitar</button>
              <button type="button" className="btn btn--outline btn--h36" onClick={() => api.responderPapel(x.de, x.para, false)}>Recusar</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
