// PDF de texto simples (A4, Helvetica), escrito aqui mesmo: sem biblioteca e sem rede.
// Usado no "Exportar perfil em PDF". Função pura, testada em relatorio.test.ts.

export type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'sub'; texto: string }
  | { tipo: 'secao'; texto: string }
  | { tipo: 'item'; texto: string; detalhe?: string }
  | { tipo: 'texto'; texto: string };

const LARG = 595.28;
const ALT = 841.89;
const MARGEM = 50;
const UTIL = LARG - 2 * MARGEM;

// Larguras da Helvetica (AFM, /1000) de 32 a 126. Letras acentuadas usam a da letra sem acento.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

function largura(texto: string, tam: number, negrito: boolean) {
  let w = 0;
  for (const ch of texto.normalize('NFD').replace(/\p{Diacritic}/gu, '')) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? W[c - 32] : 556;
  }
  return (w * tam * (negrito ? 1.07 : 1)) / 1000;
}

/** Quebra em linhas que cabem em `max` pontos (palavra maior que a linha é cortada). */
export function quebrar(texto: string, tam: number, max: number, negrito = false): string[] {
  const out: string[] = [];
  for (const par of texto.split('\n')) {
    let linha = '';
    for (const palavra of par.split(/\s+/).filter(Boolean)) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (largura(tentativa, tam, negrito) <= max) { linha = tentativa; continue; }
      if (linha) out.push(linha);
      let resto = palavra;
      while (largura(resto, tam, negrito) > max) {
        let n = resto.length - 1;
        while (n > 1 && largura(resto.slice(0, n), tam, negrito) > max) n--;
        out.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      linha = resto;
    }
    out.push(linha);
  }
  return out;
}

// WinAnsiEncoding: Latin-1 + as aspas, travessões e reticências de 0x80–0x9F.
const ANSI: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
function ansi(texto: string) {
  let s = '';
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    const b = ANSI[ch] ?? (c >= 32 && c <= 255 && (c < 127 || c >= 160) ? c : 63);
    s += b === 40 || b === 41 || b === 92 ? `\\${String.fromCharCode(b)}` : String.fromCharCode(b);
  }
  return s;
}

interface Linha { x: number; y: number; tam: number; negrito: boolean; texto: string; cinza?: boolean }

/** Diagrama os blocos em páginas A4 e devolve os bytes do PDF. `rodape` vai em cada página, com "página X de Y". */
export function gerarPdf(blocos: Bloco[], rodape: string): Uint8Array {
  const paginas: Linha[][] = [[]];
  let y = ALT - MARGEM;
  const pagina = () => paginas[paginas.length - 1];
  const espaco = (h: number) => { if (y - h < MARGEM + 20) { paginas.push([]); y = ALT - MARGEM; } };
  const escrever = (texto: string, tam: number, negrito: boolean, x = MARGEM, cinza = false, depois = 0) => {
    const linhas = quebrar(texto, tam, UTIL - (x - MARGEM), negrito);
    for (const l of linhas) {
      espaco(tam * 1.35);
      y -= tam * 1.35;
      pagina().push({ x, y, tam, negrito, texto: l, cinza });
    }
    y -= depois;
  };
  for (const b of blocos) {
    if (b.tipo === 'titulo') escrever(b.texto, 20, true, MARGEM, false, 2);
    else if (b.tipo === 'sub') escrever(b.texto, 10, false, MARGEM, true, 4);
    else if (b.tipo === 'secao') {
      y -= 10;
      espaco(40); // título de seção não fica sozinho no pé da página
      escrever(b.texto.toUpperCase(), 11, true, MARGEM, false, 3);
    } else if (b.tipo === 'texto') escrever(b.texto, 10, false, MARGEM, false, 3);
    else {
      escrever(`• ${b.texto}`, 10.5, false, MARGEM, false, b.detalhe ? 0 : 3);
      if (b.detalhe) escrever(b.detalhe, 9.5, false, MARGEM + 10, true, 3);
    }
  }

  const objs: string[] = [];
  const n = paginas.length;
  // 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold; depois, por página, a página e o conteúdo.
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Count ${n} /Kids [${paginas.map((_, i) => `${5 + 2 * i} 0 R`).join(' ')}] >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  paginas.forEach((ls, i) => {
    const pe = `${rodape} · página ${i + 1} de ${n}`;
    const todas = [...ls, { x: MARGEM, y: MARGEM - 14, tam: 8, negrito: false, texto: pe, cinza: true }];
    const corpo = todas.map((l) => `BT ${l.cinza ? '0.4 g' : '0 g'} /${l.negrito ? 'F2' : 'F1'} ${l.tam} Tf ${l.x.toFixed(2)} ${l.y.toFixed(2)} Td (${ansi(l.texto)}) Tj ET`).join('\n');
    objs[5 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARG} ${ALT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`;
    objs[6 + 2 * i] = `<< /Length ${corpo.length} >>\nstream\n${corpo}\nendstream`;
  });

  // Tudo é byte a byte (cada caractere do texto já é um byte do WinAnsi): o tamanho da string é o offset.
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
