// Resultado do exame (texto do laudo): prévia curta, "Ver resultado" com o texto inteiro e "Ler do PDF".
import { useState } from 'react';
import { useStore } from '../data/store';
import { anexosDe, ehPdf } from '../data/anexos';
import { lerDosPdfs } from '../data/pdf';
import type { Exame } from '../data/types';
import { Folha } from './Backup';

export const AVISO_ESCANEADO = 'Este PDF é uma imagem escaneada, sem texto para ler. Digite o resultado em Editar.';

export function ResultadoLaudo({ exame, podeEditar, desktop }: { exame: Exame; podeEditar: boolean; desktop?: boolean }) {
  const { state, api } = useStore();
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const pdfs = anexosDe(state.anexos, exame.id).filter(ehPdf);

  const ler = async () => {
    setLendo(true);
    try {
      const r = await lerDosPdfs(pdfs);
      if (!r) { api.toast({ texto: AVISO_ESCANEADO }); return; }
      const patch: Record<string, unknown> = { laudo: r.laudo };
      if (!exame.resultados?.length && r.resultados.length) patch.resultados = r.resultados;
      const n = r.resultados.length;
      api.editar('exames', exame.id, patch, n && patch.resultados ? `Resultado lido do PDF · ${n} ${n === 1 ? 'valor' : 'valores'}` : 'Resultado lido do PDF');
    } catch {
      api.toast({ texto: 'Não foi possível ler este PDF.' });
    } finally {
      setLendo(false);
    }
  };

  if (!exame.laudo) {
    if (!podeEditar || !pdfs.length) return null;
    return (
      <div className="card card--dashed" style={{ padding: '12px 14px', gap: 8, borderRadius: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Resultado</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>O app lê o texto do PDF e guarda o resultado e os valores.</span>
        <button type="button" className="btn btn--soft btn--h40" style={{ minHeight: 44 }} disabled={lendo} onClick={ler}>{lendo ? 'Lendo…' : 'Ler resultado do PDF'}</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '12px 14px', gap: 8, borderRadius: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Resultado</span>
      <span className="laudo laudo--previa">{exame.laudo}</span>
      <div className="hstack" style={{ gap: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--link" style={{ minHeight: 44, fontSize: 14 }} onClick={() => setAberto(true)}>Ver resultado</button>
        {podeEditar && pdfs.length > 0 && (
          <button type="button" className="btn btn--link" style={{ minHeight: 44, fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }} disabled={lendo} onClick={ler}>{lendo ? 'Lendo…' : 'Ler de novo do PDF'}</button>
        )}
      </div>
      {aberto && (
        <Folha desktop={desktop} titulo={`Resultado · ${exame.nome}`} onClose={() => setAberto(false)}>
          <div className="laudo laudo--inteiro">{exame.laudo}</div>
          <button type="button" className={desktop ? 'btn btn--outline btn--h40d' : 'btn btn--outline btn--h50'} style={{ alignSelf: desktop ? 'flex-end' : undefined }} onClick={() => setAberto(false)}>Fechar</button>
        </Folha>
      )}
    </div>
  );
}
