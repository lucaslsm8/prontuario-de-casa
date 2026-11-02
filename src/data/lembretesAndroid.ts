// Lembretes no Android: o plugin de notificações agenda cada aviso no sistema (o agendador do
// Rust só roda no desktop). A conversão Lembrete → notificação é pura (testada em
// lembretesAndroid.test.ts); as chamadas ao plugin ficam em `reagendarAndroid` e afins.

import type { Lembrete } from './lembretes';
import type { Dose } from './types';
import { EM_TAURI } from './tempo';

/** Tipo de ação registrado no plugin: Tomei / 15 min / Pular. */
export const TIPO_ACAO_DOSE = 'dose';
export const ADIAR_MIN = 15;
const SUFIXO_ADIADO = '|adiado';

/** Notificação pronta para o plugin (sem depender dele: o `Schedule` é montado na hora de agendar). */
export interface Agendamento {
  id: number;                    // inteiro de 32 bits, exigido pelo Android
  title: string;
  body: string;
  em: Date;
  actionTypeId?: string;
  extra: { id: string };         // id de texto do lembrete, devolvido quando a ação é tocada
}

export type AcaoAndroid = 'tomada' | 'pulada' | 'adiar';

/** "2026-10-29T21:00" (hora local) → Date. */
function data(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const [hh, mm] = s.slice(11, 16).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** FNV-1a de 32 bits, sempre positivo (cabe num inteiro com sinal). Mesmo id de texto, mesmo número. */
export function idNumerico(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

/** Lembretes que ainda não passaram viram notificações agendadas; os de antes de `agora` ficam de fora. */
export function paraAgendar(lista: Lembrete[], agora: Date): Agendamento[] {
  const out: Agendamento[] = [];
  for (const l of lista) {
    const em = data(l.quando);
    if (em.getTime() <= agora.getTime()) continue;
    out.push({
      id: idNumerico(l.id),
      title: l.titulo,
      body: l.corpo,
      em,
      ...(l.acoes ? { actionTypeId: TIPO_ACAO_DOSE } : {}),
      extra: { id: l.id },
    });
  }
  return out;
}

/** "Lembrar em 15 min": mesmo aviso, daqui a 15 min, com o id terminado em "|adiado". */
export function adiar(idTexto: string, titulo: string, corpo: string, agora: Date): Agendamento {
  const id = idTexto.endsWith(SUFIXO_ADIADO) ? idTexto : idTexto + SUFIXO_ADIADO;
  return {
    id: idNumerico(id),
    title: titulo,
    body: corpo,
    em: new Date(agora.getTime() + ADIAR_MIN * 60_000),
    actionTypeId: TIPO_ACAO_DOSE,
    extra: { id },
  };
}

/** id da ação do plugin → ação do app. O toque no corpo da notificação ("tap") não é ação. */
export function acaoDoPlugin(actionId: string | null | undefined): AcaoAndroid | null {
  if (actionId === 'tomei') return 'tomada';
  if (actionId === 'pular') return 'pulada';
  if (actionId === 'adiar') return 'adiar';
  return null;
}

/** Id "dose|<remedio>|<previstoPara>[|adiado]" → partes; null se não for de dose. */
export function parteDose(id: string): { remedioId: string; previstoPara: string } | null {
  const [tipo, remedioId, previstoPara] = id.split('|');
  if (tipo !== 'dose' || !remedioId || !previstoPara) return null;
  return { remedioId, previstoPara };
}

/** Adiamento pendente que ainda vale: dose ainda sem registro. Os demais pendentes são cancelados. */
export function adiadoVale(extraId: string | undefined, doses: Dose[]): boolean {
  if (!extraId || !extraId.endsWith(SUFIXO_ADIADO)) return false;
  const p = parteDose(extraId);
  if (!p) return false;
  return !doses.some((d) => d.remedioId === p.remedioId && d.previstoPara === p.previstoPara);
}

// ---------- chamadas ao plugin (só no app Android) ----------

export const noCelular = () => EM_TAURI && /Android/i.test(navigator.userAgent);

let tiposRegistrados = false;
let fila: Promise<void> = Promise.resolve();

const plugin = () => import('@tauri-apps/plugin-notification');
type Plugin = Awaited<ReturnType<typeof plugin>>;

async function registrarTipos(p: Plugin) {
  if (tiposRegistrados) return;
  await p.registerActionTypes([
    {
      id: TIPO_ACAO_DOSE,
      actions: [
        { id: 'tomei', title: 'Tomei' },
        { id: 'adiar', title: '15 min' },
        { id: 'pular', title: 'Pular' },
      ],
    },
  ]);
  tiposRegistrados = true;
}

function agendar(p: Plugin, a: Agendamento) {
  p.sendNotification({
    id: a.id,
    title: a.title,
    body: a.body,
    schedule: p.Schedule.at(a.em, false, true),
    actionTypeId: a.actionTypeId,
    extra: a.extra,
  });
}

/** Cancela as pendentes do app (menos adiamentos ainda válidos) e agenda a lista de novo. Uma por vez. */
export function reagendarAndroid(lista: Lembrete[], doses: Dose[], agora: Date): Promise<void> {
  fila = fila.then(() => reagendar(lista, doses, agora)).catch((e) => console.error('lembretes:', e));
  return fila;
}

async function reagendar(lista: Lembrete[], doses: Dose[], agora: Date) {
  const p = await plugin();
  const novos = paraAgendar(lista, agora);
  // A permissão só é pedida na primeira vez que há algum lembrete.
  if (novos.length > 0 && !(await p.isPermissionGranted())) {
    if ((await p.requestPermission()) !== 'granted') return;
  }
  await registrarTipos(p);
  const pendentes = await p.pending();
  const cancelar = pendentes
    .filter((n) => !adiadoVale((n as { extra?: { id?: string } }).extra?.id, doses))
    .map((n) => n.id);
  if (cancelar.length > 0) await p.cancel(cancelar);
  for (const a of novos) agendar(p, a);
}

/** Agenda o "15 min" de uma dose. */
export function adiarAndroid(idTexto: string, titulo: string, corpo: string, agora: Date): Promise<void> {
  fila = fila
    .then(async () => {
      const p = await plugin();
      await registrarTipos(p);
      agendar(p, adiar(idTexto, titulo, corpo, agora));
    })
    .catch((e) => console.error('lembretes:', e));
  return fila;
}

/** Escuta o toque nas ações. Devolve a função que desfaz o registro. */
export async function ouvirAcoesAndroid(
  cb: (acao: AcaoAndroid, idTexto: string, titulo: string, corpo: string) => void,
): Promise<() => void> {
  const p = await plugin();
  // O plugin entrega { actionId, notification } (o tipo exportado diz Options).
  const l = await p.onAction((payload) => {
    const r = payload as unknown as { actionId?: string; notification?: { title?: string; body?: string; extra?: { id?: string } } };
    const acao = acaoDoPlugin(r.actionId);
    const id = r.notification?.extra?.id;
    if (!acao || !id) return;
    cb(acao, id, r.notification?.title ?? '', r.notification?.body ?? '');
  });
  return () => { void l.unregister(); };
}
