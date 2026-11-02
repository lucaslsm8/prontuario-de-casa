// Leitor de QR do convite da família (só no app Android; no resto devolve "indisponível").
import { EM_TAURI } from './tempo';

export const leitorQrDisponivel = () => EM_TAURI && /Android/i.test(navigator.userAgent);

/** Aceita só um convite `PCASA1:…` (ignora espaços em volta); qualquer outro QR vira null. */
export function conviteDoQr(conteudo: string): string | null {
  const t = conteudo.trim();
  return t.startsWith('PCASA1:') && t.length > 'PCASA1:'.length ? t : null;
}

/** Abre a câmera e devolve o convite lido. null = cancelou ou não era um convite; lança erro se a câmera foi negada. */
export async function lerConviteQr(): Promise<string | null> {
  const { scan, cancel, checkPermissions, requestPermissions, Format } = await import('@tauri-apps/plugin-barcode-scanner');
  let permissao = await checkPermissions();
  if (permissao !== 'granted') permissao = await requestPermissions();
  if (permissao !== 'granted') throw new Error('Sem acesso à câmera. Libere a câmera para o app nas configurações do celular ou cole o convite.');
  try {
    const r = await scan({ formats: [Format.QRCode], cameraDirection: 'back' });
    return conviteDoQr(r.content);
  } catch {
    await cancel().catch(() => undefined);
    return null;
  }
}
