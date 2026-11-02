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
/** Dose que passou há até 30 min sem aviso (ex.: remédio cadastrado depois do horário) avisa logo, como no desktop (lembretes.rs). */
export const ATRASO_MAX_MIN = 30;
/** Quanto depois de `agora` sai o aviso atrasado. */
const LOGO_MS = 3_000;
/** Texto dos avisos que não são de dose com "Esconder nomes" ligado. O plugin guarda título e corpo de cada
 *  agendamento em claro (SharedPreferences) até disparar; assim nada de título, profissional, local ou pet fica lá. */
export const TITULO_GENERICO = 'Lembrete do Prontuário de Casa';
export const CORPO_GENERICO = 'Hora de um cuidado';

/** Notificação pronta para o plugin (sem depender dele: o `Schedule` é montado na hora de agendar). */
export interface Agendamento {
  id: number;                    // inteiro de 32 bits, exigido pelo Android
  title: string;
  body: string;
  em: Date;
  actionTypeId?: string;
  extra: { id: string };         // id de texto do lembrete, devolvido quando a ação é tocada
  atrasado?: true;               // dose de até 30 min atrás, avisada logo (uma vez por sessão: ver `reagendar`)
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

/** Lembretes que ainda não passaram viram notificações agendadas. Dos que passaram, só a dose de até
 *  `ATRASO_MAX_MIN` atrás entra, para logo (`atrasado`); o resto fica de fora. Com `esconder`, os avisos que não são
 *  de dose (consulta, vacina, prevenção) levam o texto genérico; os de dose já vêm sem o nome do remédio. */
export function paraAgendar(lista: Lembrete[], agora: Date, esconder = false): Agendamento[] {
  const out: Agendamento[] = [];
  for (const l of lista) {
    let em = data(l.quando);
    let atrasado = false;
    if (em.getTime() <= agora.getTime()) {
      if (!parteDose(l.id) || em.getTime() < agora.getTime() - ATRASO_MAX_MIN * 60_000) continue;
      em = new Date(agora.getTime() + LOGO_MS);
      atrasado = true;
    }
    const generico = esconder && !parteDose(l.id);
    out.push({
      id: idNumerico(l.id),
      title: generico ? TITULO_GENERICO : l.titulo,
      body: generico ? CORPO_GENERICO : l.corpo,
      em,
      ...(l.acoes ? { actionTypeId: TIPO_ACAO_DOSE } : {}),
      extra: { id: l.id },
      ...(atrasado ? { atrasado: true as const } : {}),
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

/** Ação tocada, como o plugin entrega (`{ actionId, notification }`, no evento ou na Intent de abertura) → ação do app; null se não for ação de lembrete. */
export function lerAcaoPlugin(payload: unknown): { acao: AcaoAndroid; id: string; titulo: string; corpo: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const r = payload as { actionId?: string | null; notification?: { title?: string; body?: string; extra?: { id?: string } } | null };
  const acao = acaoDoPlugin(r.actionId);
  const id = r.notification?.extra?.id;
  if (!acao || typeof id !== 'string' || !id) return null;
  return { acao, id, titulo: r.notification?.title ?? '', corpo: r.notification?.body ?? '' };
}

/** Id "dose|<remedio>|<previstoPara>[|adiado]" → partes; null se não for de dose. */
export function parteDose(id: string): { remedioId: string; previstoPara: string } | null {
  const [tipo, remedioId, previstoPara] = id.split('|');
  if (tipo !== 'dose' || !remedioId || !previstoPara) return null;
  return { remedioId, previstoPara };
}

/** Dose ainda sem registro (id de lembrete de dose, com ou sem "|adiado"). */
function doseSemRegistro(extraId: string, doses: Dose[]): boolean {
  const p = parteDose(extraId);
  return !!p && !doses.some((d) => d.remedioId === p.remedioId && d.previstoPara === p.previstoPara);
}

/** Adiamento pendente que ainda vale: dose ainda sem registro. Os demais pendentes são cancelados. */
export function adiadoVale(extraId: string | undefined, doses: Dose[]): boolean {
  if (!extraId || !extraId.endsWith(SUFIXO_ADIADO)) return false;
  return doseSemRegistro(extraId, doses);
}

/** Pendente que fica ao reagendar: adiamento que vale ou aviso atrasado desta sessão (`avisados`) de dose ainda sem registro. */
export function pendenteFica(extraId: string | undefined, doses: Dose[], avisados: ReadonlySet<string>): boolean {
  if (!extraId) return false;
  return adiadoVale(extraId, doses) || (avisados.has(extraId) && doseSemRegistro(extraId, doses));
}

// ---------- chamadas ao plugin (só no app Android) ----------

export const noCelular = () => EM_TAURI && /Android/i.test(navigator.userAgent);

let tiposRegistrados = false;
let fila: Promise<void> = Promise.resolve();
/** Doses atrasadas já avisadas nesta sessão (só em memória): cada uma avisa uma vez, mesmo reagendando a cada mudança. */
const avisados = new Set<string>();
/** Doses já agendadas nesta sessão: a que tocou na hora com o app aberto não volta como atrasada. */
const agendados = new Set<string>();

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
export function reagendarAndroid(lista: Lembrete[], doses: Dose[], agora: Date, esconder: boolean): Promise<void> {
  fila = fila.then(() => reagendar(lista, doses, agora, esconder)).catch((e) => console.error('lembretes:', e));
  return fila;
}

async function reagendar(lista: Lembrete[], doses: Dose[], agora: Date, esconder: boolean) {
  const p = await plugin();
  let novos = paraAgendar(lista, agora, esconder);
  // Atrasada: só se não foi agendada nesta sessão nem está na bandeja (o alarme dela já tocou com o app fechado).
  // Tocou com o app fechado e a pessoa já tirou da bandeja: avisa de novo ao abrir (a dose segue sem registro).
  if (novos.some((a) => a.atrasado)) {
    const ativos = new Set((await p.active().catch(() => [])).map((n) => n.id));
    novos = novos.filter((a) => !a.atrasado || (!agendados.has(a.extra.id) && !ativos.has(a.id)));
  }
  // A permissão só é pedida na primeira vez que há algum lembrete.
  if (novos.length > 0 && !(await p.isPermissionGranted())) {
    if ((await p.requestPermission()) !== 'granted') return;
  }
  await registrarTipos(p);
  const pendentes = await p.pending();
  const cancelar = pendentes
    .filter((n) => !pendenteFica((n as { extra?: { id?: string } }).extra?.id, doses, avisados))
    .map((n) => n.id);
  if (cancelar.length > 0) await p.cancel(cancelar);
  for (const a of novos) {
    agendar(p, a);
    if (a.atrasado) avisados.add(a.extra.id);
    if (parteDose(a.extra.id)) agendados.add(a.extra.id);
  }
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
    const a = lerAcaoPlugin(payload);
    if (a) cb(a.acao, a.id, a.titulo, a.corpo);
  });
  return () => { void l.unregister(); };
}
