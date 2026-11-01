// Liga o estado aos lembretes do sistema. Só no app instalado: no navegador e
// nos dados de exemplo nada é agendado (a M15 continua sendo a simulação).

import { useEffect, useRef, useState } from 'react';
import { EM_TAURI } from './tempo';
import { persistencia } from './persistencia';
import { proximosLembretes } from './lembretes';
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
    persistencia.agendarLembretes(proximosLembretes(state, new Date())).catch((e) => console.error('lembretes:', e));
  }, [state, pronto, hora]);

  // Tomei / Pular na notificação. Funciona com o app bloqueado, como na M15.
  const ref = useRef({ state, marcarDose, pronto });
  ref.current = { state, marcarDose, pronto };
  const tratados = useRef(new Set<string>());
  useEffect(() => {
    if (!EM_TAURI) return;
    let vivo = true;
    let parar: (() => void) | undefined;
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ id: string; acao: 'tomada' | 'pulada' }>('lembrete-acao', ({ payload }) => {
          const [tipo, remedioId, previstoPara] = payload.id.split('|');
          if (tipo !== 'dose' || !remedioId || !previstoPara) return;
          // Ainda carregando (raro, logo após a recarga da meia-noite): ignora; a notificação segue no Centro de Ações.
          if (!ref.current.pronto) return;
          // Dois cliques quase simultâneos no mesmo aviso: só o primeiro vale. O id sai
          // do conjunto depois, para valer de novo se a dose for desfeita e lembrada outra vez.
          if (tratados.current.has(payload.id)) return;
          tratados.current.add(payload.id);
          window.setTimeout(() => tratados.current.delete(payload.id), 10_000);
          // Já marcada no app (notificação antiga clicada depois): não registra de novo.
          if (ref.current.state.doses.some((d) => d.remedioId === remedioId && d.previstoPara === previstoPara)) return;
          ref.current.marcarDose(remedioId, previstoPara.slice(11), payload.acao, previstoPara.slice(0, 10));
        }),
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
