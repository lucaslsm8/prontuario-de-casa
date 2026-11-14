// Resultado do exame (texto do laudo): prévia curta, "Ver resultado" com o texto inteiro e "Ler o resultado"
// (texto do PDF; fotos e PDF escaneado por OCR, tudo no aparelho, `data/ocr.ts`).
import { useState } from 'react';
import { useStore } from '../data/store';
import { anexosDe } from '../data/anexos';
import { lerResultado } from '../data/ocr';
import type { Exame } from '../data/types';
import { Folha } from './Backup';
import { cx } from './index';
import { estruturaDoLaudo, type SecaoLaudo } from '../data/laudo';

/**
 * Texto do laudo formatado: títulos de seção em negrito, "Rótulo: valor" com o rótulo em negrito e a conclusão
 * (impressão, conclusão, diagnóstico) em destaque. `secoes` limita o que aparece (a prévia mostra só a conclusão).
 */
export function TextoLaudo({ secoes, className }: { secoes: SecaoLaudo[]; className?: string }) {
  return (
    <div className={cx('laudo', className)}>
      {secoes.map((s, i) => (
        <section key={i} className={cx('laudo__secao', s.destaque && 'laudo__secao--destaque')}>
          {s.titulo && <h4 className="laudo__titulo">{s.titulo}</h4>}
          {s.linhas.map((l, j) => (
            <p key={j} className="laudo__linha">{l.rotulo && <strong>{l.rotulo}: </strong>}{l.texto}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

export const AVISO_SEM_TEXTO = 'Não encontrei texto no resultado. Digite o que for importante em Editar.';

export function ResultadoLaudo({ exame, podeEditar, desktop }: { exame: Exame; podeEditar: boolean; desktop?: boolean }) {
  const { state, api } = useStore();
  const [aberto, setAberto] = useState(false);
  /** null parado; 0 a 1 o andamento da leitura das imagens. */
  const [lendo, setLendo] = useState<number | null>(null);
  // Só os arquivos do resultado: o pedido médico não tem laudo.
  const arquivos = anexosDe(state.anexos, exame.id, 'exame');
  const texto = lendo === null ? undefined : lendo > 0 ? `Lendo… ${Math.round(lendo * 100)}%` : 'Lendo…';

  const ler = async () => {
    setLendo(0);
    try {
      const r = await lerResultado(arquivos, setLendo);
      if (!r) { api.toast({ texto: AVISO_SEM_TEXTO }); return; }
      const patch: Record<string, unknown> = { laudo: r.laudo };
      if (!exame.resultados?.length && r.resultados.length) patch.resultados = r.resultados;
      const n = patch.resultados ? r.resultados.length : 0;
      const valores = n ? ` · ${n} ${n === 1 ? 'valor' : 'valores'}` : '';
      api.editar('exames', exame.id, patch, r.porImagem ? `Texto lido da imagem${valores}. Confira o resultado.` : `Resultado lido do PDF${valores}`);
    } catch {
      api.toast({ texto: 'Não foi possível ler o resultado.' });
    } finally {
      setLendo(null);
    }
  };

  if (!exame.laudo) {
    if (!podeEditar || !arquivos.length) return null;
    return (
      <div className="card card--dashed" style={{ padding: '12px 14px', gap: 8, borderRadius: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Resultado</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>O app lê o texto do resultado (PDF ou foto), aqui no aparelho, e guarda o texto e os valores.</span>
        <button type="button" className="btn btn--soft btn--h40" style={{ minHeight: 44 }} disabled={lendo !== null} onClick={ler}>{texto ?? 'Ler o resultado'}</button>
      </div>
    );
  }

  // Prévia: a conclusão do laudo, quando ele tem uma; senão o começo do texto (cortado em algumas linhas).
  const secoes = estruturaDoLaudo(exame.laudo);
  const conclusao = secoes.filter((s) => s.destaque);
  return (
    <div className="card" style={{ padding: '12px 14px', gap: 8, borderRadius: 8, alignItems: 'stretch' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Resultado</span>
      {conclusao.length ? <TextoLaudo secoes={conclusao} /> : <TextoLaudo secoes={secoes} className="laudo--previa" />}
      <div className="hstack" style={{ gap: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--link" style={{ minHeight: 44, fontSize: 14 }} onClick={() => setAberto(true)}>{conclusao.length ? 'Ver o laudo completo' : 'Ver resultado'}</button>
        {podeEditar && arquivos.length > 0 && (
          <button type="button" className="btn btn--link" style={{ minHeight: 44, fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }} disabled={lendo !== null} onClick={ler}>{texto ?? 'Ler de novo'}</button>
        )}
      </div>
      {aberto && (
        <Folha desktop={desktop} titulo={`Resultado · ${exame.nome}`} onClose={() => setAberto(false)}>
          <TextoLaudo secoes={secoes} className="laudo--inteiro" />
          <button type="button" className={desktop ? 'btn btn--outline btn--h40d' : 'btn btn--outline btn--h50'} style={{ alignSelf: desktop ? 'flex-end' : undefined }} onClick={() => setAberto(false)}>Fechar</button>
        </Folha>
      )}
    </div>
  );
}
