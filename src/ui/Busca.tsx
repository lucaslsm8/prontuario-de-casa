// Busca global (desktop: Ctrl+K; celular: /busca) e a linha do tempo da pessoa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { eu, podeVer, useStore } from '../data/store';
import { buscar, type Achado, type Evento } from '../data/busca';
import { mesAno } from '../data/format';
import { cx } from './index';

/** No desktop o plano da pessoa mora em /planos. */
const rotaDesktop = (r: string) => (/^\/pessoa\/[^/]+\/plano$/.test(r) ? '/planos' : r);

export function useBusca(termo: string) {
  const { state } = useStore();
  const me = eu(state).id;
  return useMemo(() => buscar(state, termo, (pid, c) => pid === me || podeVer(state, pid, c)), [state, termo, me]);
}

function Resultados({ lista, ativo, onEscolher }: { lista: Achado[]; ativo: number; onEscolher: (a: Achado) => void }) {
  return (
    <div className="busca__lista" role="listbox">
      {lista.map((a, i) => (
        <button key={`${a.tipo}-${a.rota}-${i}`} type="button" role="option" aria-selected={i === ativo} className={cx('busca__item', i === ativo && 'is-ativo')} onClick={() => onEscolher(a)}>
          <span className="busca__tipo">{a.tipo}</span>
          <span className="stack" style={{ minWidth: 0, flex: 1 }}>
            <span className="busca__titulo">{a.titulo}</span>
            {a.sub && <span className="busca__sub">{a.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Ctrl+K (ou o botão da barra lateral) abre a busca por cima de qualquer tela do desktop. */
export function BuscaDesktop() {
  const nav = useNavigate();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const lista = useBusca(termo);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta(true); }
    };
    const abrir = () => setAberta(true);
    window.addEventListener('keydown', tecla);
    window.addEventListener('abrir-busca', abrir);
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('abrir-busca', abrir); };
  }, []);
  useEffect(() => { if (aberta) { setTermo(''); setAtivo(0); setTimeout(() => input.current?.focus(), 0); } }, [aberta]);
  useEffect(() => setAtivo(0), [termo]);
  if (!aberta) return null;
  const escolher = (a: Achado) => { setAberta(false); nav(rotaDesktop(a.rota)); };
  return createPortal(
    <div className="overlay overlay--fixed overlay--top busca__fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberta(false); }}>
      <div className="busca" role="dialog" aria-modal="true" aria-label="Buscar">
        <input
          ref={input}
          className="busca__input"
          placeholder="Buscar remédio, exame, consulta, pessoa, valor (ex.: LDL)…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAberta(false);
            if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((x) => Math.min(x + 1, lista.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((x) => Math.max(x - 1, 0)); }
            if (e.key === 'Enter' && lista[ativo]) escolher(lista[ativo]);
          }}
          aria-label="Buscar"
        />
        {termo.trim() && (lista.length ? <Resultados lista={lista} ativo={ativo} onEscolher={escolher} /> : <span className="busca__vazio">Nada encontrado para “{termo}”.</span>)}
        {!termo.trim() && <span className="busca__vazio">↑ ↓ para escolher · Enter para abrir · Esc para fechar</span>}
      </div>
    </div>,
    document.body,
  );
}

/** Conteúdo da busca do celular (a tela fica em src/mobile/Busca.tsx). */
export function BuscaMobile() {
  const nav = useNavigate();
  const [termo, setTermo] = useState('');
  const lista = useBusca(termo);
  return (
    <>
      <input className="input input--search" autoFocus placeholder="Remédio, exame, consulta, pessoa…" value={termo} onChange={(e) => setTermo(e.target.value)} aria-label="Buscar" />
      {termo.trim() && (lista.length ? <Resultados lista={lista} ativo={-1} onEscolher={(a) => nav(a.rota)} /> : <span className="busca__vazio">Nada encontrado para “{termo}”.</span>)}
    </>
  );
}

/** Linha do tempo agrupada por mês. */
export function LinhaDoTempo({ eventos, desktop }: { eventos: Evento[]; desktop?: boolean }) {
  const nav = useNavigate();
  if (!eventos.length) return <span className="muted" style={{ fontSize: 14 }}>Nada registrado ainda.</span>;
  const meses: [string, Evento[]][] = [];
  for (const e of eventos) {
    const m = mesAno(e.data);
    const g = meses[meses.length - 1];
    if (g && g[0] === m) g[1].push(e); else meses.push([m, [e]]);
  }
  return (
    <div className="tempo">
      {meses.map(([m, evs]) => (
        <div key={m} className="tempo__mes">
          <span className="label">{m}</span>
          {evs.map((e, i) => {
            const conteudo = (
              <>
                <span className="tempo__dia mono">{e.data.slice(8, 10)}</span>
                <span className="tempo__ponto" />
                <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span><span className="tempo__tipo">{e.tipo}</span> {e.titulo}</span>
                  {e.sub && <span className="tempo__sub">{e.sub}</span>}
                </span>
              </>
            );
            return e.rota
              ? <button key={i} type="button" className="tempo__item" onClick={() => nav(desktop ? rotaDesktop(e.rota!) : e.rota!)}>{conteudo}</button>
              : <div key={i} className="tempo__item">{conteudo}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
