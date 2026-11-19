// Atalhos de teclado do desktop: uma tecla, sem Ctrl, fora de campos de texto e sem diálogo aberto.
// "?" mostra a lista. Ctrl+K (busca), Enter, Ctrl+Enter e Esc nos diálogos ficam onde estão.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { DDialogo, temDialogoAberto } from './Formulario';
import { useAbrir } from './Shell';

export const ATALHOS: { teclas: string[]; texto: string }[] = [
  { teclas: ['N'], texto: 'Nova consulta' },
  { teclas: ['R'], texto: 'Novo remédio' },
  { teclas: ['E'], texto: 'Novo exame' },
  { teclas: ['/'], texto: 'Buscar' },
  { teclas: ['Ctrl', 'K'], texto: 'Buscar' },
  { teclas: ['1'], texto: 'Início' },
  { teclas: ['2'], texto: 'Agenda' },
  { teclas: ['3'], texto: 'Remédios' },
  { teclas: ['4'], texto: 'Exames' },
  { teclas: ['5'], texto: 'Carteirinhas' },
  { teclas: ['Enter'], texto: 'Salvar o formulário aberto' },
  { teclas: ['Ctrl', 'Enter'], texto: 'Salvar, de dentro de um texto longo' },
  { teclas: ['Esc'], texto: 'Fechar o diálogo' },
  { teclas: ['?'], texto: 'Esta lista' },
];

const PAGINAS: Record<string, string> = { 1: '/', 2: '/agenda', 3: '/remedios', 4: '/exames', 5: '/planos' };

/** Digitando (campo, área de texto, select ou editável)? */
function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Liga os atalhos. Devolve o estado da lista ("?"). */
export function useAtalhos() {
  const { state } = useStore();
  const nav = useNavigate();
  const abrir = useAbrir();
  const [ajuda, setAjuda] = useState(false);
  const ref = useRef({ abrir, nav, bloqueado: state.bloqueado });
  ref.current = { abrir, nav, bloqueado: state.bloqueado };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (digitando(e.target) || ref.current.bloqueado || temDialogoAberto()) return;
      // Busca, visualizador e outras camadas modais por cima.
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const { abrir: a, nav: n } = ref.current;
      const fazer: Record<string, () => void> = {
        n: () => a('consulta'),
        r: () => a('remedio'),
        e: () => a('exame'),
        '/': () => window.dispatchEvent(new Event('abrir-busca')),
        '?': () => setAjuda(true),
      };
      const f = fazer[k] ?? (PAGINAS[k] ? () => n(PAGINAS[k]) : undefined);
      if (!f) return;
      e.preventDefault();
      f();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  return { ajuda, setAjuda };
}

export function AjudaAtalhos({ onClose }: { onClose: () => void }) {
  return (
    <DDialogo titulo="Atalhos do teclado" largura={460} onClose={onClose}>
      <div className="stack" style={{ gap: 0 }}>
        {ATALHOS.map((a) => (
          <div key={a.texto + a.teclas.join()} className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--divider)', fontSize: 14 }}>
            <span>{a.texto}</span>
            <span className="hstack" style={{ gap: 4 }}>
              {a.teclas.map((t) => <kbd key={t} className="mono" style={{ fontSize: 12, padding: '2px 8px', border: '1px solid var(--border-input)', borderRadius: 6, background: 'var(--bg)' }}>{t}</kbd>)}
            </span>
          </div>
        ))}
      </div>
    </DDialogo>
  );
}
