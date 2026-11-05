// Ícones de traço (redesign 30/10/2026): só na navegação e nas ações do cartão da dose.
import type { ReactNode } from 'react';

function Svg({ size = 18, traco = 1.8, children }: { size?: number; traco?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
type P = { size?: number };

export const IcMarca = ({ size = 20 }: P) => <Svg size={size}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /><path d="M7 12h3l1.5-2.5L14 14l1.5-2H17" /></Svg>;
/** Marca do app (mesmo desenho do ícone do aplicativo, sem fundo). */
export const IcMarcaCheia = ({ size = 40 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21.2s-8.6-5.3-8.6-12A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.6 3.2c0 6.7-8.6 12-8.6 12z" fill="var(--teal)" />
    <path d="M6.2 12.2h3.4l1.7-2.9 2.6 5.6 1.7-2.7h2.3" stroke="#fff" strokeWidth={1.7} />
  </svg>
);
export const IcInicio = (p: P) => <Svg {...p}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></Svg>;
export const IcRemedio = (p: P) => <Svg {...p}><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></Svg>;
export const IcAgenda = (p: P) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>;
export const IcConsulta = (p: P) => <Svg {...p}><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 12v2a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="11" r="2" /></Svg>;
export const IcExame = (p: P) => <Svg {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></Svg>;
export const IcPlano = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.5 1.7-2 3-2s2.4.5 3 2M14 10h4M14 13h3" /></Svg>;
export const IcFotos = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 3.5 3.5L15 14l5 4.5" /></Svg>;
/** Engrenagem (desenho do Lucide "settings", licença ISC). */
export const IcConfig = (p: P) => <Svg {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IcCadeado = (p: P) => <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>;
export const IcEmergencia = (p: P) => <Svg {...p}><path d="M7 18v-6a5 5 0 0 1 10 0v6M5 18h14v3H5zM12 3v2M4.5 6.5 6 8M19.5 6.5 18 8" /></Svg>;
export const IcSino = ({ size = 16 }: P) => <Svg size={size}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>;
export const IcPular = ({ size = 16 }: P) => <Svg size={size}><path d="m6 6 9 6-9 6z" /><path d="M18 6v12" /></Svg>;
export const IcCheck = ({ size = 16 }: P) => <Svg size={size} traco={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IcDesfazer = ({ size = 16 }: P) => <Svg size={size}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
export const IcEstoque = (p: P) => <Svg {...p}><path d="M4 8 12 4l8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></Svg>;
