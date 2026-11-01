// No app real, HOJE é fixado ao abrir. Se o app ficar aberto de um dia para o
// outro, a janela recarrega para tudo (Início, adesão, lembretes) usar a data
// nova. Espera 2 min sem uso para não perder um formulário pela metade.
// O agendador no Rust continua rodando e recebe a lista de novo ao recarregar.

import { useEffect } from 'react';
import { HOJE, MODO_REAL, iso } from './tempo';

export function useViradaDoDia() {
  useEffect(() => {
    if (!MODO_REAL) return;
    let ultimoUso = Date.now();
    const usou = () => {
      ultimoUso = Date.now();
    };
    window.addEventListener('pointerdown', usou);
    window.addEventListener('keydown', usou);
    const t = window.setInterval(() => {
      if (iso(new Date()) !== HOJE && Date.now() - ultimoUso > 120_000) location.reload();
    }, 60_000);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pointerdown', usou);
      window.removeEventListener('keydown', usou);
    };
  }, []);
}
