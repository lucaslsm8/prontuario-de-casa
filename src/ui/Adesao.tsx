import { useMemo, type CSSProperties } from 'react';
import { historicoAdesao, useStore } from '../data/store';
import { adesaoPorSemana } from '../data/medicoes';
import { HOJE } from '../data/tempo';
import { Grafico } from './Grafico';

/** % de doses tomadas por semana nas últimas 8 semanas (some se não houver ao menos 2 semanas). */
export function AdesaoSemanal({ remedioId, altura = 140, className, style }: { remedioId: string; altura?: number; className?: string; style?: CSSProperties }) {
  const { state } = useStore();
  const pontos = useMemo(() => adesaoPorSemana(historicoAdesao(state, remedioId, 57), HOJE, 8), [state, remedioId]);
  if (pontos.length < 2) return null;
  return (
    <div className={`stack ${className ?? ''}`} style={{ gap: 6, ...style }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Por semana · últimas {pontos.length}</span>
      <Grafico rotulo="Adesão por semana" series={[{ nome: 'Adesão', cor: 'var(--teal)', pontos }]} faixas={[{ de: 80, ate: 100 }]} yMin={0} yMax={100} altura={altura} />
    </div>
  );
}
