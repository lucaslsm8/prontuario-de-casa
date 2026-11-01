import { brParaISO, isoParaBR } from '../data/formularios-puro';

/**
 * Data com o seletor nativo do sistema (calendário no Windows e no Android, sem rede).
 * O formulário continua recebendo e entregando "DD/MM/AAAA".
 */
export function CampoData({ valor, onChange, className, rotulo, max }: { valor: string; onChange: (br: string) => void; className?: string; rotulo?: string; max?: string }) {
  const iso = brParaISO(valor) ?? '';
  return (
    <input
      type="date"
      className={className}
      value={iso}
      max={max}
      aria-label={rotulo}
      onChange={(e) => onChange(e.target.value ? isoParaBR(e.target.value) : '')}
    />
  );
}
