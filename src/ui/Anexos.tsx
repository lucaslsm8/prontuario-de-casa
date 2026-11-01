// Anexos: escolher arquivos, miniaturas e visualizador em tela cheia (foto ou PDF).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../data/store';
import { ACEITOS, ErroAnexo, anexosDe, blobDe, ehPdf, exportarAnexo, lerArquivo } from '../data/anexos';
import { tamanhoArquivo } from '../data/format';
import type { Anexo, TipoAnexo } from '../data/types';
import { cx } from './index';

/** Input de arquivo escondido. `abrir()` mostra a escolha; os anexos já lidos chegam em `onAnexos`. */
export function useEscolherArquivos(donoId: string, tipo: TipoAnexo, onAnexos: (lista: Anexo[]) => void, { camera = false, soFotos = false } = {}) {
  const { api } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  async function ler(files: File[]) {
    if (!files.length) return;
    setLendo(true);
    const ok: Anexo[] = [];
    for (const f of files) {
      try { ok.push(await lerArquivo(f, donoId, tipo)); } catch (e) {
        api.toast({ texto: e instanceof ErroAnexo ? e.message : `Não foi possível ler ${f.name}.` });
      }
    }
    setLendo(false);
    if (ok.length) onAnexos(ok);
  }
  const elemento = (
    <input
      ref={input}
      type="file"
      multiple
      hidden
      accept={camera || soFotos ? 'image/*' : ACEITOS}
      {...(camera ? { capture: 'environment' as const } : {})}
      onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void ler(fs); }}
    />
  );
  return { abrir: () => input.current?.click(), elemento, lendo };
}

/** Miniatura de um anexo (foto recortada ou cartão "PDF"). */
export function Miniatura({ anexo, onClick, onRemover, grande }: { anexo: Anexo; onClick?: () => void; onRemover?: () => void; grande?: boolean }) {
  return (
    <span className={cx('anexo', grande && 'anexo--grande')}>
      <button type="button" className="anexo__abrir" onClick={onClick} aria-label={`Abrir ${anexo.nome}`}>
        {ehPdf(anexo) ? (
          <span className="anexo__pdf"><b>PDF</b><span>{anexo.nome}</span></span>
        ) : (
          <img src={anexo.dados} alt="" />
        )}
      </button>
      {onRemover && <button type="button" className="anexo__x" onClick={onRemover} aria-label={`Remover ${anexo.nome}`}>×</button>}
    </span>
  );
}

/** Tela cheia: foto ou PDF, setas entre os anexos, Exportar e Esc para fechar. */
export function Visualizador({ anexos, inicio = 0, onClose }: { anexos: Anexo[]; inicio?: number; onClose: () => void }) {
  const { api } = useStore();
  const [i, setI] = useState(Math.min(inicio, anexos.length - 1));
  const a = anexos[i];
  const url = useMemo(() => (a && ehPdf(a) ? URL.createObjectURL(blobDe(a)) : undefined), [a]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, anexos.length - 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [anexos.length, onClose]);
  if (!a) return null;
  const exportar = async () => {
    try { if (await exportarAnexo(a)) api.toast({ texto: `${a.nome} exportado` }); } catch { api.toast({ texto: 'Não foi possível exportar.' }); }
  };
  return createPortal(
    <div className="visor" role="dialog" aria-modal="true" aria-label={a.nome}>
      <div className="visor__topo">
        <span className="visor__nome">{a.nome}<span>{anexos.length > 1 ? ` · ${i + 1} de ${anexos.length}` : ''} · {tamanhoArquivo(a.tamanho)}</span></span>
        <span className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--on-dark btn--h36" onClick={exportar}>Exportar</button>
          <button type="button" className="btn btn--on-dark btn--h36" onClick={onClose} aria-label="Fechar">Fechar</button>
        </span>
      </div>
      <div className="visor__corpo">
        {anexos.length > 1 && <button type="button" className="visor__seta" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Anterior">‹</button>}
        {ehPdf(a) ? <iframe className="visor__pdf" src={url} title={a.nome} /> : <img className="visor__img" src={a.dados} alt={a.nome} />}
        {anexos.length > 1 && <button type="button" className="visor__seta" disabled={i === anexos.length - 1} onClick={() => setI(i + 1)} aria-label="Próximo">›</button>}
      </div>
    </div>,
    document.body,
  );
}

/** Galeria de um registro: miniaturas, "+" para adicionar e remover com desfazer. */
export function GaleriaAnexos({ donoId, tipo, podeEditar = true, vazio, camera }: { donoId: string; tipo: TipoAnexo; podeEditar?: boolean; vazio?: string; camera?: boolean }) {
  const { state, api } = useStore();
  const lista = anexosDe(state.anexos, donoId, tipo);
  const [aberto, setAberto] = useState<number | null>(null);
  const seletor = useEscolherArquivos(donoId, tipo, api.addAnexos, { camera });
  return (
    <div className="anexos">
      {lista.map((a, n) => (
        <Miniatura key={a.id} anexo={a} onClick={() => setAberto(n)} onRemover={podeEditar ? () => api.removerAnexo(a) : undefined} />
      ))}
      {podeEditar && (
        <button type="button" className="anexo anexo--add" onClick={seletor.abrir} disabled={seletor.lendo} aria-label="Adicionar arquivo">
          {seletor.lendo ? '…' : '+'}
          <span>{camera ? 'Foto' : 'Foto ou PDF'}</span>
        </button>
      )}
      {!podeEditar && lista.length === 0 && <span className="muted" style={{ fontSize: 14 }}>{vazio ?? 'Nenhum arquivo.'}</span>}
      {seletor.elemento}
      {aberto != null && <Visualizador anexos={lista} inicio={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

/** Arquivos escolhidos num formulário que ainda não foi salvo (viram eventos só no "Salvar"). */
export function AnexosPendentes({ donoId, tipo, lista, onChange, camera }: { donoId: string; tipo: TipoAnexo; lista: Anexo[]; onChange: (l: Anexo[]) => void; camera?: boolean }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const seletor = useEscolherArquivos(donoId, tipo, (novos) => onChange([...lista, ...novos]), { camera });
  return (
    <div className="anexos">
      {lista.map((a, n) => (
        <Miniatura key={a.id} anexo={a} onClick={() => setAberto(n)} onRemover={() => onChange(lista.filter((x) => x.id !== a.id))} />
      ))}
      <button type="button" className="anexo anexo--add" onClick={seletor.abrir} disabled={seletor.lendo} aria-label="Adicionar arquivo">
        {seletor.lendo ? '…' : '+'}
        <span>{lista.length ? 'Mais páginas' : camera ? 'Foto' : 'Foto ou PDF'}</span>
      </button>
      {seletor.elemento}
      {aberto != null && <Visualizador anexos={lista} inicio={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
