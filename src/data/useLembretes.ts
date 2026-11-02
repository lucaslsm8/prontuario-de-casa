// Liga o estado aos lembretes do sistema. Só no app instalado: no navegador e
// nos dados de exemplo nada é agendado (a M15 continua sendo a simulação).

import { useEffect, useRef, useState } from 'react';
import { EM_TAURI } from './tempo';
import { persistencia } from './persistencia';
import { proximosLembretes } from './lembretes';
import { adiarAndroid, noCelular, ouvirAcoesAndroid, reagendarAndroid, type AcaoAndroid } from './lembretesAndroid';
import type { State } from './store';
import type { Dose } from './types';

type MarcarDose = (remedioId: string, horario: string, status: Dose['status'], dia: string) => void;

export function useLembretes(state: State, pronto: boolean, marcarDose: MarcarDose) {
  // A lista cobre 24 h; recalcular a cada hora mantém a janela andando.
  const [hora, setHora] = useState(() => new Date().getHours());
  useEffect(() => {
    if (!EM_TAURI) return;
    const t = window.setInterval(() => setHora(new Date().getHours()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!EM_TAURI || !pronto) return;
    const agora = new Date();
    const lista = proximosLembretes(state, agora);
    // No Android os avisos são agendados pelo plugin de notificações; o agendador do Rust é do desktop.
    if (noCelular()) void reagendarAndroid(lista, state.doses, agora);
    else persistencia.agendarLembretes(lista).catch((e) => console.error('lembretes:', e));
  }, [state, pronto, hora]);

  // Tomei / Pular na notificação. Funciona com o app bloqueado, como na M15.
  const ref = useRef({ state, marcarDose, pronto });
  ref.current = { state, marcarDose, pronto };
  const tratados = useRef(new Set<string>());
  // Android: o app pode abrir pela ação da notificação antes de o estado carregar; a ação espera aqui.
  const fila = useRef<{ acao: AcaoAndroid; id: string; titulo: string; corpo: string }[]>([]);

  const tratar = (id: string, acao: AcaoAndroid, titulo = '', corpo = '') => {
    const [tipo, remedioId, previstoPara] = id.split('|');
    if (tipo !== 'dose' || !remedioId || !previstoPara) return;
    if (acao === 'adiar') {
      void adiarAndroid(id, titulo, corpo, new Date());
      return;
    }
    // Ainda carregando (raro, logo após a recarga da meia-noite): ignora; a notificação segue no Centro de Ações.
    if (!ref.current.pronto) return;
    // Dois cliques quase simultâneos no mesmo aviso: só o primeiro vale. O id sai
    // do conjunto depois, para valer de novo se a dose for desfeita e lembrada outra vez.
    if (tratados.current.has(id)) return;
    tratados.current.add(id);
    window.setTimeout(() => tratados.current.delete(id), 10_000);
    // Já marcada no app (notificação antiga clicada depois): não registra de novo.
    if (ref.current.state.doses.some((d) => d.remedioId === remedioId && d.previstoPara === previstoPara)) return;
    ref.current.marcarDose(remedioId, previstoPara.slice(11), acao, previstoPara.slice(0, 10));
  };
  const tratarRef = useRef(tratar);
  tratarRef.current = tratar;

  useEffect(() => {
    if (!pronto || fila.current.length === 0) return;
    const pend = fila.current.splice(0);
    for (const a of pend) tratarRef.current(a.id, a.acao, a.titulo, a.corpo);
  }, [pronto]);

  // Android: listener registrado logo na montagem (a ação que abriu o app chega por aqui).
  useEffect(() => {
    if (!noCelular()) return;
    let vivo = true;
    let parar: (() => void) | undefined;
    ouvirAcoesAndroid((acao, id, titulo, corpo) => {
      if (!ref.current.pronto && acao !== 'adiar') fila.current.push({ acao, id, titulo, corpo });
      else tratarRef.current(id, acao, titulo, corpo);
    })
      .then((u) => {
        if (vivo) parar = u;
        else u();
      })
      .catch((e) => console.error('lembretes:', e));
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);

  useEffect(() => {
    if (!EM_TAURI || noCelular()) return;
    let vivo = true;
    let parar: (() => void) | undefined;
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ id: string; acao: 'tomada' | 'pulada' }>('lembrete-acao', ({ payload }) => tratarRef.current(payload.id, payload.acao)),
      )
      .then((u) => {
        if (vivo) parar = u;
        else u();
      })
      .catch((e) => console.error('lembretes:', e));
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);
}
