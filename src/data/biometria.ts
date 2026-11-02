// Biometria (digital/rosto) para abrir o app no celular. Só no app Android; no resto devolve "indisponível".
import { EM_TAURI } from './tempo';

const noCelular = () => EM_TAURI && /Android/i.test(navigator.userAgent);

export async function biometriaDisponivel(): Promise<boolean> {
  if (!noCelular()) return false;
  try {
    const { checkStatus } = await import('@tauri-apps/plugin-biometric');
    return (await checkStatus()).isAvailable;
  } catch {
    return false;
  }
}

/** true se a pessoa confirmou; false se cancelou ou falhou (o PIN continua valendo). */
export async function autenticarBiometria(motivo: string): Promise<boolean> {
  try {
    const { authenticate } = await import('@tauri-apps/plugin-biometric');
    await authenticate(motivo, { allowDeviceCredential: false, cancelTitle: 'Usar PIN' });
    return true;
  } catch {
    return false;
  }
}
