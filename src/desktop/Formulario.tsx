import { useEffect, useId, useRef, type ReactNode } from 'react';
import { SANGUE } from '../data/formularios';
import { ChipGroup, Toggle, cx } from '../ui';

// Kit dos formulários desktop: diálogo largo, grade de 2 colunas, campos, select nativo e chips xs.

/** Pilha dos diálogos abertos: Esc fecha só o de cima. */
const pilha: symbol[] = [];

function useDialogo(onClose: () => void, foco: () => HTMLElement | null | undefined) {
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;
  useEffect(() => {
    const eu = Symbol('dialogo');
    pilha.push(eu);
    const antes = document.activeElement as HTMLElement | null;
    foco()?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pilha[pilha.length - 1] === eu) {
        e.preventDefault();
        fecharRef.current();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      pilha.splice(pilha.indexOf(eu), 1);
      antes?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Fecha ao clicar fora (só se o clique começou e terminou no fundo, para não fechar ao arrastar uma seleção). */
function useCliqueFora(onClose: () => void) {
  const comecou = useRef(false);
  return {
    onMouseDown: (e: React.MouseEvent) => { comecou.current = e.target === e.currentTarget; },
    onClick: (e: React.MouseEvent) => { if (comecou.current && e.target === e.currentTarget) onClose(); comecou.current = false; },
  };
}

export function DDialogo({
  titulo, largura = 640, onClose, rodape, cabecalho, imprimivel, children,
}: {
  titulo: string; largura?: number; onClose: () => void; rodape?: ReactNode;
  /** Substitui o cabeçalho padrão (título + ×), como a faixa da ficha de emergência. */
  cabecalho?: ReactNode;
  /** Na impressão, só este diálogo aparece. */
  imprimivel?: boolean;
  children: ReactNode;
}) {
  const corpo = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useDialogo(onClose, () => corpo.current?.querySelector<HTMLElement>('input:not([type=file]), select, textarea') ?? caixa.current);
  const fora = useCliqueFora(onClose);
  return (
    <div className="overlay overlay--fixed" {...fora}>
      <div
        ref={caixa}
        className={cx('dlg', imprimivel && 'dlg--print')}
        style={{ width: largura }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={cabecalho ? undefined : tituloId}
        aria-label={cabecalho ? titulo : undefined}
        tabIndex={-1}
      >
        {cabecalho ?? (
          <div className="dlg__head">
            <h2 id={tituloId} className="dlg__title">{titulo}</h2>
            <DFechar onClick={onClose} />
          </div>
        )}
        {/* Enter num campo aciona o botão principal do rodapé (o primeiro type="submit"; desativado, não salva). */}
        <form className="dlg__form" onSubmit={(e) => e.preventDefault()}>
          <div ref={corpo} className="dlg__body">{children}</div>
          {rodape && <div className="dlg__foot">{rodape}</div>}
        </form>
      </div>
    </div>
  );
}

/** Botão × de 32 px do cabeçalho. */
export function DFechar({ onClick }: { onClick: () => void }) {
  return <button type="button" className="dlg__x" onClick={onClick} aria-label="Fechar">×</button>;
}

/** Rodapé padrão: "Cancelar" + ação principal (teal), desativada sem o campo obrigatório. */
export function DRodape({ salvar, onSalvar, valido, onCancelar }: { salvar: string; onSalvar: () => void; valido: boolean; onCancelar: () => void }) {
  return (
    <>
      <button type="button" className="btn btn--outline btn--h40d" onClick={onCancelar}>Cancelar</button>
      <button type="submit" className="btn btn--teal btn--h40d" onClick={onSalvar} disabled={!valido}>{salvar}</button>
    </>
  );
}

export function DGrade({ children }: { children: ReactNode }) {
  return <div className="dgrid">{children}</div>;
}

/**
 * Campo com rótulo em cima. Com um input/select dentro, o rótulo é um <label>.
 * `grupo` (chips, toggles, listas) usa um grupo rotulado, para o clique no rótulo não acionar o primeiro botão.
 */
export function DCampo({ label, span2, grupo, erro, children }: { label: string; span2?: boolean; grupo?: boolean; erro?: string; children: ReactNode }) {
  const id = useId();
  const cls = cx('dfield', span2 && 'dfield--span2');
  if (grupo) {
    return (
      <div className={cls} role="group" aria-labelledby={id}>
        <span id={id} className="dfield__label">{label}</span>
        {children}
        {erro && <span className="dfield__erro" role="alert">{erro}</span>}
      </div>
    );
  }
  return (
    <div className={cls}>
      <label className="dfield">
        <span className="dfield__label">{label}</span>
        {children}
      </label>
      {erro && <span className="dfield__erro" role="alert">{erro}</span>}
    </div>
  );
}

/** <select> nativo com o visual do input desktop. Funciona com qualquer valor (número, objeto, undefined). */
export function DSelect<T>({ opcoes, valor, onChange }: { opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void }) {
  const i = opcoes.findIndex((o) => o.id === valor);
  return (
    <select className="input input--desk dselect" value={String(Math.max(0, i))} onChange={(e) => onChange(opcoes[Number(e.target.value)].id)}>
      {opcoes.map((o, j) => <option key={j} value={j}>{o.nome}</option>)}
    </select>
  );
}

/** Escolhas curtas em chips xs (32 px). */
export function DChips<T extends string>({ opcoes, valor, onChange, tom, separarAntes }: { opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void; tom?: 'dark' | 'teal'; separarAntes?: number }) {
  return <ChipGroup tamanho="xs" tom={tom} opcoes={opcoes} valor={valor} onChange={onChange} separarAntes={separarAntes} />;
}

/** Tipo sanguíneo em chips xs (mono) + "Não sei". Clicar de novo desmarca. */
export function DSangue({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="group" aria-label="Tipo sanguíneo">
      {[...SANGUE, 'nao-sei'].map((s) => {
        const on = valor === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? '' : s)}
            className={cx('chip chip--xs', s !== 'nao-sei' && 'chip--mono', on && 'is-teal')}
          >
            {s === 'nao-sei' ? 'Não sei' : s}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle com texto ao lado, numa linha da altura do input. */
/** `rotulo`: nome acessível fixo do interruptor (padrão: o texto). */
export function DToggle({ texto, rotulo, sub, on, onChange }: { texto: string; rotulo?: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="dtoggle" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) onChange(!on); }}>
      <Toggle on={on} onChange={onChange} label={rotulo ?? texto} />
      <span className="dtoggle__texto">
        <span>{texto}</span>
        {sub && <span className="dtoggle__sub">{sub}</span>}
      </span>
    </div>
  );
}

/** Confirmação curta (ações destrutivas e afins). */
export function DConfirmar({
  titulo, texto, confirmar, perigo, desativado, onConfirm, onClose,
}: { titulo: string; texto: ReactNode; confirmar: string; perigo?: boolean; desativado?: boolean; onConfirm: () => void; onClose: () => void }) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  useDialogo(onClose, () => cancelar.current);
  const fora = useCliqueFora(onClose);
  return (
    <div className="overlay overlay--fixed overlay--top" {...fora}>
      <div className="dlg" style={{ width: 440 }} role="alertdialog" aria-modal="true" aria-labelledby={tituloId}>
        <div className="stack" style={{ padding: '24px 24px 20px', gap: 8 }}>
          <h2 id={tituloId} className="dlg__title">{titulo}</h2>
          <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>{texto}</span>
        </div>
        <div className="dlg__foot">
          <button ref={cancelar} type="button" className="btn btn--outline btn--h40d" onClick={onClose}>Cancelar</button>
          <button type="button" className={cx('btn btn--h40d', perigo ? 'btn--danger' : 'btn--teal')} onClick={onConfirm} disabled={desativado}>{confirmar}</button>
        </div>
      </div>
    </div>
  );
}
