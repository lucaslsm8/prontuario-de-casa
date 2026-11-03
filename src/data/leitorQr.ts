// Leitor de QR do convite da família (só no app Android; no resto devolve "indisponível").
import { EM_TAURI } from './tempo';

export const leitorQrDisponivel = () => EM_TAURI && /Android/i.test(navigator.userAgent);

/** Aceita só um convite `PCASA1:…` (ignora espaços em volta); qualquer outro QR vira null. */
export function conviteDoQr(conteudo: string): string | null {
  const t = conteudo.trim();
  return t.startsWith('PCASA1:') && t.length > 'PCASA1:'.length ? t : null;
}

/** Abre a câmera (tela do ZXing, que pede a permissão) e devolve o convite lido. undefined = voltou sem ler; null = não era um convite. */
export async function lerConviteQr(): Promise<string | null | undefined> {
  const { invoke } = await import('@tauri-apps/api/core');
  const lido = await invoke<string | null>('qr_ler');
  return lido ? conviteDoQr(lido) : undefined;
}
