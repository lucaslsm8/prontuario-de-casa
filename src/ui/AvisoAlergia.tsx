// Aviso no formulário e na tela do remédio quando ele bate com uma alergia da pessoa.
import { alergiasDoRemedio, textoAvisoAlergia } from '../data/alergias';
import { pessoa, useStore } from '../data/store';

export function AvisoAlergia({ nome, pessoaId }: { nome: string; pessoaId: string }) {
  const { state } = useStore();
  const p = pessoa(state, pessoaId);
  if (!p) return null;
  const avisos = alergiasDoRemedio(nome, p.alergias);
  if (!avisos.length) return null;
  return (
    <div className="card card--warn" role="alert" style={{ padding: '12px 14px', gap: 4 }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--warn-text)' }}>ATENÇÃO · ALERGIA{p.souEu ? '' : ` DE ${p.curto.toUpperCase()}`}</span>
      {avisos.map((a) => (
        <span key={a.alergia.substancia} style={{ fontSize: 14, fontWeight: 600, color: 'var(--warn-strong)', lineHeight: 1.4 }}>{textoAvisoAlergia(a, nome)}</span>
      ))}
      <span style={{ fontSize: 12, color: 'var(--warn-text)' }}>Confirme com o médico antes de tomar.</span>
    </div>
  );
}
