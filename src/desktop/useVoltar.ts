import { useNavigate } from 'react-router-dom';

/** Volta no histórico do app; se esta é a primeira entrada (aba aberta direto), chama `semHistorico`. */
export function useVoltar(semHistorico: () => void) {
  const nav = useNavigate();
  return () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : semHistorico());
}
