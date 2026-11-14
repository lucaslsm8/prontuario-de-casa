// Leitura do resultado do exame: texto dos PDFs (pdf.js) e, para fotos e PDFs escaneados, OCR com o tesseract.js
// em português. Tudo roda no aparelho: o worker, o núcleo WebAssembly e o modelo `por` vêm do próprio app (`/ocr/`,
// plugin `ocrLocal` no vite.config.ts) e nada é enviado. Carregado só quando há algo para ler.
import type { Anexo } from './types';
import { ehPdf } from './anexos';
import { abrirPdf, desenharPagina, paginasDoPdf, type LidoDoPdf } from './pdf';
import { dataDoTexto, limparTexto, marcadoresDoTexto, textoDoLaudo } from './laudo';

/** O que foi lido e se alguma parte veio de imagem (OCR pode errar letras: vale conferir). */
export interface LidoDoResultado extends LidoDoPdf { porImagem: boolean }

/** Largura em que a página do PDF escaneado é desenhada para o OCR (texto de laudo legível sem pesar demais). */
const LARGURA_OCR = 1700;

async function imagemDaPagina(a: Anexo, n: number): Promise<string> {
  const doc = await abrirPdf(a);
  try {
    const c = document.createElement('canvas');
    await desenharPagina(doc, n, c, LARGURA_OCR);
    return c.toDataURL('image/png');
  } finally {
    void doc.destroy();
  }
}

/** Texto de cada imagem, com um worker só (ele é criado e encerrado aqui). `progresso`: 0 a 1 do conjunto. */
export async function textoDasImagens(imagens: (() => Promise<string>)[], progresso?: (p: number) => void): Promise<string[]> {
  if (!imagens.length) return [];
  const { createWorker } = await import('tesseract.js');
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, document.baseURI).href;
  let atual = 0;
  const worker = await createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    // Worker pela URL do app (não blob:) e sem guardar o modelo no IndexedDB: ele já está no app.
    workerBlobURL: false,
    cacheMethod: 'none',
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progresso?.((atual + m.progress) / imagens.length);
    },
  });
  try {
    const textos: string[] = [];
    for (; atual < imagens.length; atual++) {
      const { data } = await worker.recognize(await imagens[atual]());
      textos.push(limparTexto(data.text));
    }
    progresso?.(1);
    return textos;
  } finally {
    await worker.terminate();
  }
}

/**
 * Lê o resultado: o texto das páginas de PDF que têm texto e, por OCR, as fotos e as páginas escaneadas.
 * null = nada legível. Os valores e a data saem do texto inteiro; o laudo guardado fica sem cabeçalho e rodapé.
 */
export async function lerResultado(anexos: Anexo[], progresso?: (p: number) => void): Promise<LidoDoResultado | null> {
  const textos: string[] = [];
  const imagens: (() => Promise<string>)[] = [];
  for (const a of anexos) {
    if (ehPdf(a)) {
      const paginas = await paginasDoPdf(a);
      paginas.forEach((t, i) => (t.trim() ? textos.push(t) : imagens.push(() => imagemDaPagina(a, i + 1))));
    } else if (a.mime.startsWith('image/')) {
      imagens.push(async () => a.dados);
    }
  }
  const lidas = (await textoDasImagens(imagens, progresso)).filter((t) => t.trim());
  const paginas = [...textos, ...lidas];
  if (!paginas.length) return null;
  const tudo = paginas.join('\n\n');
  return { laudo: textoDoLaudo(paginas) || tudo, resultados: marcadoresDoTexto(tudo), dataColeta: dataDoTexto(tudo), porImagem: lidas.length > 0 };
}
