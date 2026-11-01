// Anexos (fotos e PDFs de exames, receitas e carteirinhas).
// O arquivo vira data URL dentro do evento `addAnexo`: fica cifrado no banco e vai junto no backup.

import { EM_TAURI } from './tempo';
import { novoId } from './persistencia';
import type { Anexo, TipoAnexo } from './types';

/** Lado maior das fotos guardadas (legível para laudo, ~300–600 KB em JPEG). */
const LADO_MAX = 2000;
export const PDF_MAX = 10 * 1024 * 1024;
export const ACEITOS = 'image/*,application/pdf';

export const ehPdf = (a: Pick<Anexo, 'mime'>) => a.mime === 'application/pdf';
export const tamanhoDataUrl = (d: string) => Math.round(((d.length - d.indexOf(',') - 1) * 3) / 4);

/** Lado maior limitado a `max`, mantendo a proporção. */
export function encaixar(w: number, h: number, max = LADO_MAX): [number, number] {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

function lerComoDataUrl(file: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsDataURL(file);
  });
}

async function reduzirImagem(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => createImageBitmap(file));
  try {
    const [w, h] = encaixar(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Sem canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    bmp.close();
  }
}

export class ErroAnexo extends Error {}

/** Lê o arquivo escolhido: imagem reduzida para JPEG; PDF como está (até 10 MB). */
export async function lerArquivo(file: File, donoId: string, tipo: TipoAnexo): Promise<Anexo> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let dados: string;
  let mime: string;
  if (pdf && tipo === 'foto') throw new ErroAnexo(`${file.name}: escolha uma foto.`);
  if (pdf) {
    if (file.size > PDF_MAX) throw new ErroAnexo(`${file.name} passa de 10 MB.`);
    dados = (await lerComoDataUrl(file)).replace(/^data:[^;,]*/, 'data:application/pdf');
    mime = 'application/pdf';
  } else if (file.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(file.name)) {
    try { dados = await reduzirImagem(file); } catch { throw new ErroAnexo(`Não foi possível abrir ${file.name}.`); }
    mime = 'image/jpeg';
  } else {
    throw new ErroAnexo(`${file.name}: use foto ou PDF.`);
  }
  const nome = pdf ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { id: `anx-${novoId()}`, donoId, tipo, nome, mime, dados, tamanho: tamanhoDataUrl(dados), em: new Date().toISOString() };
}

/** Data URL → Blob (para abrir PDF num iframe sem passar a URL gigante). */
export function blobDe(a: Pick<Anexo, 'dados' | 'mime'>): Blob {
  const b64 = a.dados.slice(a.dados.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: a.mime });
}

/**
 * Exporta o arquivo para onde a pessoa escolher (ação explícita: o arquivo sai do cofre e fica em claro).
 * No app instalado: diálogo "Salvar" + comando Rust. No navegador: download comum.
 */
export async function exportarAnexo(a: Anexo): Promise<boolean> {
  if (EM_TAURI) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const ext = a.nome.split('.').pop() || (ehPdf(a) ? 'pdf' : 'jpg');
    const caminho = await save({ defaultPath: a.nome, filters: [{ name: ehPdf(a) ? 'PDF' : ext === 'ics' ? 'Agenda' : 'Imagem', extensions: [ext] }] });
    if (!caminho) return false;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('exportar_arquivo', { caminho, dados: a.dados.slice(a.dados.indexOf(',') + 1) });
    return true;
  }
  const url = URL.createObjectURL(blobDe(a));
  const link = document.createElement('a');
  link.href = url;
  link.download = a.nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export const anexosDe = (anexos: Anexo[], donoId: string, tipo?: TipoAnexo) => anexos.filter((a) => a.donoId === donoId && (!tipo || a.tipo === tipo));

/** Álbum do pet, da foto mais nova para a mais antiga. */
export const fotosDoPet = (anexos: Anexo[], petId: string) => anexosDe(anexos, petId, 'foto').sort((a, b) => b.em.localeCompare(a.em));

/** Salva um texto (ex.: agenda .ics) onde a pessoa escolher. */
export function exportarTexto(nome: string, mime: string, texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return exportarAnexo({ id: 'texto', donoId: '', tipo: 'exame', nome, mime, dados: `data:${mime};base64,${btoa(bin)}`, tamanho: bytes.length, em: '' });
}
