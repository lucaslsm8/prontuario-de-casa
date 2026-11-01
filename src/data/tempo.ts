// Modo do app e data de referência.
//
// - App instalado (Tauri) ou navegador com `?persistir=1`: dados reais, data de hoje.
// - Navegador em desenvolvimento: dados de exemplo dos mockups, "hoje" = 28/10/2026.

export const EM_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const PERSISTIR_NO_NAVEGADOR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('persistir');

export const MODO_REAL = EM_TAURI || PERSISTIR_NO_NAVEGADOR;
export const MODO_EXEMPLO = !MODO_REAL;

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const HOJE = MODO_EXEMPLO ? '2026-10-28' : iso(new Date());

/** Hora do relógio ("HH:MM"); nos dados de exemplo, fixa em 14:20 como nos mockups. */
export const AGORA_EXEMPLO = '14:20';
export const horaAgora = () => {
  if (MODO_EXEMPLO) return AGORA_EXEMPLO;
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Valor pré-preenchido só nos dados de exemplo (para bater com os mockups). */
export const ex = <T,>(exemplo: T, real: T): T => (MODO_EXEMPLO ? exemplo : real);
