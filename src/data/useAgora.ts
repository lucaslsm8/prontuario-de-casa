// Minuto do dia para o Início (cartão da dose e linha do dia).
// Nos dados de exemplo fica em 14:20, como nos mockups.

import { useEffect, useState } from 'react';
import { AGORA_EXEMPLO as HORA_EXEMPLO, MODO_EXEMPLO } from './tempo';

const AGORA_EXEMPLO = Number(HORA_EXEMPLO.slice(0, 2)) * 60 + Number(HORA_EXEMPLO.slice(3));
const doRelogio = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function useAgora() {
  const [agora, setAgora] = useState(() => (MODO_EXEMPLO ? AGORA_EXEMPLO : doRelogio()));
  useEffect(() => {
    if (MODO_EXEMPLO) return;
    const t = window.setInterval(() => setAgora(doRelogio()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return agora;
}
