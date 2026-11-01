import { useEffect, useState } from 'react';

export type Layout = 'mobile' | 'desktop';
const LIMITE = 760;
const KEY = 'ui-forcado';

function ler(): Layout | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'mobile' || v === 'desktop' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Layout por largura da janela (Android = mobile, desktop = sidebar).
 * Em desenvolvimento dá para forçar um dos dois; o mobile numa tela larga
 * aparece dentro de uma moldura de 390×844, igual aos mockups.
 */
export function useLayout() {
  const [largura, setLargura] = useState(() => window.innerWidth);
  const [forcado, setF] = useState<Layout | null>(ler);
  useEffect(() => {
    const on = () => setLargura(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const natural: Layout = largura < LIMITE ? 'mobile' : 'desktop';
  const layout = forcado ?? natural;
  const setForcado = (v: Layout | null) => {
    setF(v);
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch { /* armazenamento indisponível */ }
  };
  return { layout, frame: layout === 'mobile' && largura >= LIMITE, forcado, setForcado };
}

export function useEmTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
