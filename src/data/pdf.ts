// PDF dos anexos com o pdf.js (empacotado no app, offline): páginas em canvas e o texto do laudo.
// Carregado só quando um PDF aparece na tela, para não pesar a abertura do app.

import type { PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';
import type { Anexo, Resultado } from './types';
import { dataDoTexto, limparTexto, marcadoresDoTexto, textoDoLaudo } from './laudo';
import { ehPdf } from './anexos';

let trabalhador: PDFWorker | undefined;

async function pdfjs() {
  const lib = await import('pdfjs-dist');
  // Um worker só, empacotado pelo Vite (.js comum, mesma origem: passa pela CSP do app). Passado em
  // `worker`, ele sobrevive ao `destroy()` de cada documento (miniatura e leitura do texto rodam juntas).
  if (!trabalhador) {
    const Trabalhador = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    trabalhador = lib.PDFWorker.fromPort({ port: new Trabalhador() }) as PDFWorker;
  }
  return { lib, worker: trabalhador };
}

function bytes(a: Pick<Anexo, 'dados'>): Uint8Array {
  const bin = atob(a.dados.slice(a.dados.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function abrirPdf(a: Pick<Anexo, 'dados'>): Promise<PDFDocumentProxy> {
  const { lib, worker } = await pdfjs();
  // Sem eval (CSP do app) e sem buscar nada fora: fontes padrão embutidas no próprio PDF ou do sistema.
  return lib.getDocument({ data: bytes(a), worker, isEvalSupported: false, useSystemFonts: true }).promise;
}

/** Desenha a página `n` (1…) num canvas com `largura` CSS px (nítido em telas de alta densidade). */
export async function desenharPagina(doc: PDFDocumentProxy, n: number, canvas: HTMLCanvasElement, largura: number) {
  const pagina = await doc.getPage(n);
  const base = pagina.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const vp = pagina.getViewport({ scale: (largura / base.width) * dpr });
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width = `${largura}px`;
  canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
}

/** Texto de cada página, uma linha por linha do PDF. Páginas vazias = PDF escaneado (só imagem). */
export async function paginasDoPdf(a: Pick<Anexo, 'dados'>): Promise<string[]> {
  const doc = await abrirPdf(a);
  try {
    const paginas: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      let t = '';
      for (const it of c.items) {
        if (!('str' in it)) continue;
        t += it.str + (it.hasEOL ? '\n' : '');
      }
      paginas.push(limparTexto(t));
    }
    return paginas;
  } finally {
    void doc.destroy();
  }
}

const capas = new Map<string, Promise<string>>();
/** Primeira página como imagem (miniatura), guardada em memória por anexo. */
export function capaDoPdf(a: Pick<Anexo, 'id' | 'dados'>, largura = 480): Promise<string> {
  const k = `${a.id}:${largura}`;
  let p = capas.get(k);
  if (!p) {
    p = (async () => {
      const doc = await abrirPdf(a);
      try {
        const c = document.createElement('canvas');
        await desenharPagina(doc, 1, c, largura);
        return c.toDataURL('image/jpeg', 0.85);
      } finally {
        void doc.destroy();
      }
    })();
    p.catch(() => capas.delete(k));
    capas.set(k, p);
  }
  return p;
}

export interface LidoDoPdf { laudo: string; resultados: Resultado[]; dataColeta?: string }

/** Lê o texto dos PDFs anexados. null = nenhum PDF tem texto (escaneado). */
export async function lerDosPdfs(anexos: Anexo[]): Promise<LidoDoPdf | null> {
  const paginas: string[] = [];
  for (const a of anexos.filter(ehPdf)) paginas.push(...(await paginasDoPdf(a)).filter(Boolean));
  if (!paginas.length) return null;
  // Valores e data saem do texto inteiro; o resultado guardado fica sem cabeçalho, rodapé e identificação.
  const tudo = paginas.join('\n\n');
  return { laudo: textoDoLaudo(paginas) || tudo, resultados: marcadoresDoTexto(tudo), dataColeta: dataDoTexto(tudo) };
}
