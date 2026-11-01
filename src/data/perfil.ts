import type { Alergia, Condicao, DadosPet, Pessoa } from './types';
import { lerNascimento } from './formularios-puro';

/** Mudanças aceitas em `editarPessoa`. `null` remove o campo (undefined some no JSON do log). */
export type PatchPessoa = { [K in keyof Omit<Pessoa, 'id' | 'souEu' | 'tipo'>]?: Pessoa[K] | null };

/** Maior quadrado centralizado dentro de w×h. */
export function recorteQuadrado(w: number, h: number): { sx: number; sy: number; lado: number } {
  const lado = Math.min(w, h);
  return { sx: Math.round((w - lado) / 2), sy: Math.round((h - lado) / 2), lado };
}

// Igualdade por JSON: depende da ordem das chaves em objetos aninhados (basta para os dados do app).
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Só os campos que mudaram de `antes` para `depois`. Campo removido vira `null`. */
export function diffPessoa(antes: Pessoa, depois: Pessoa): PatchPessoa {
  const patch: Record<string, unknown> = {};
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  for (const k of chaves) {
    if (k === 'id' || k === 'souEu' || k === 'tipo') continue;
    const a = (antes as unknown as Record<string, unknown>)[k];
    const d = (depois as unknown as Record<string, unknown>)[k];
    if (igual(a, d)) continue;
    patch[k] = d === undefined ? null : d;
  }
  return patch as PatchPessoa;
}

/** "1,74" → 1.74; "72,5 kg" → 72.5; vazio ou inválido → undefined. */
export function lerNumeroBR(texto: string): number | undefined {
  const m = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|m|cm)?$/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const LADO_FOTO = 384;

/** Acima disso nem tentamos decodificar (30 MB). */
const MAX_BYTES_FOTO = 30 * 1024 * 1024;

/** Corta o centro em quadrado e reduz para 384×384 JPEG (qualidade 0,82), devolvendo um data URL. */
export async function reduzirFoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Não é uma imagem');
  if (file.size > MAX_BYTES_FOTO) throw new Error('Imagem grande demais');
  let fonte: CanvasImageSource;
  let w: number;
  let h: number;
  let liberar = () => {};
  if (typeof createImageBitmap === 'function') {
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bmp = await createImageBitmap(file);
    }
    fonte = bmp; w = bmp.width; h = bmp.height; liberar = () => bmp.close();
  } else {
    const url = URL.createObjectURL(file);
    liberar = () => URL.revokeObjectURL(url);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      fonte = img; w = img.naturalWidth; h = img.naturalHeight;
    } catch (e) { liberar(); throw e; }
  }
  try {
    if (!w || !h) throw new Error('Imagem vazia');
    const { sx, sy, lado } = recorteQuadrado(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = LADO_FOTO; canvas.height = LADO_FOTO;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sem canvas');
    // Fundo branco: o JPEG não tem transparência (PNG transparente ficaria preto).
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
    ctx.drawImage(fonte, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    liberar();
  }
}

// ── Formulário "Editar perfil" (estado em texto ↔ Pessoa) ──────────────────

export type TipoCondicao = Condicao['tipo'];
export const TIPOS_CONDICAO: { id: TipoCondicao; nome: string }[] = [
  { id: 'condicao', nome: 'Condição' },
  { id: 'cirurgia', nome: 'Cirurgia' },
  { id: 'vacina', nome: 'Vacina' },
];

/** Linhas das listas editáveis. `chave` só identifica a linha na tela; `orig` guarda os campos que o formulário não mostra. */
export interface LinhaAlergia { chave: string; substancia: string; reacao: string; orig?: Alergia }
export interface LinhaCondicao { chave: string; nome: string; tipo: TipoCondicao; desde: string; orig?: Condicao }

export interface FormPerfil {
  nome: string;
  nasc: string;      // DD/MM/AAAA
  sexo: '' | 'Masculino' | 'Feminino';
  sangue: string;    // '' ou 'nao-sei' = sem tipo
  peso: string;      // "72,5"
  altura: string;    // "1,74"
  pressao: string;   // "130/80"
  alergias: LinhaAlergia[];
  condicoes: LinhaCondicao[];
  contato: { nome: string; relacao: string; telefone: string };
  foto?: string;
  /** Só nos pets: campos no lugar de sangue, altura, pressão e contato (o peso vem das pesagens). */
  pet?: FormPet;
}

export interface FormPet {
  raca: string;
  castrado: boolean;
  microchip: string;
  veterinario: { nome: string; clinica: string; telefone: string };
  clinica24h: { nome: string; telefone: string };
}

export type ErrosPerfil = Partial<Record<'nome' | 'nasc' | 'peso' | 'altura' | 'contato' | 'veterinario' | 'clinica24h', string>>;

let seq = 0;
export const novaChave = () => `l${++seq}`;

const numTexto = (n?: number) => (n == null ? '' : String(n).replace('.', ','));
const isoBR = (iso?: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

/** Estado inicial do formulário a partir da pessoa. */
export function formDePessoa(p: Pessoa): FormPerfil {
  return {
    nome: p.nome,
    nasc: isoBR(p.nascimento),
    sexo: p.sexo ?? '',
    sangue: p.sangue ?? '',
    peso: numTexto(p.peso),
    altura: numTexto(p.altura),
    pressao: p.pressao?.valor ?? '',
    alergias: p.alergias.map((a) => ({ chave: novaChave(), substancia: a.substancia, reacao: a.reacao ?? '', orig: a })),
    condicoes: p.condicoes.map((c) => ({ chave: novaChave(), nome: c.nome, tipo: c.tipo, desde: c.desde ?? '', orig: c })),
    contato: { nome: p.contatoEmergencia?.nome ?? '', relacao: p.contatoEmergencia?.relacao ?? '', telefone: p.contatoEmergencia?.telefone ?? '' },
    foto: p.foto,
    pet: p.tipo === 'pet' ? formDoPet(p.pet) : undefined,
  };
}

function formDoPet(d?: DadosPet): FormPet {
  return {
    raca: d?.raca ?? '',
    castrado: !!d?.castrado,
    microchip: d?.microchip ?? '',
    veterinario: { nome: d?.veterinario?.nome ?? '', clinica: d?.veterinario?.clinica ?? '', telefone: d?.veterinario?.telefone ?? '' },
    clinica24h: { nome: d?.clinica24h?.nome ?? '', telefone: d?.clinica24h?.telefone ?? '' },
  };
}

/** Tira chaves `undefined`, mantendo a ordem das demais (o diff compara por JSON). */
function limpar<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
/** Tira espaços das pontas e junta os repetidos. */
export const normalizarTexto = (s: string) => s.trim().replace(/\s+/g, ' ');
const t = normalizarTexto;
const ou = (s: string) => t(s) || undefined;

/**
 * Formulário → Pessoa (para `diffPessoa`). Linhas vazias das listas somem; campos vazios saem da pessoa.
 * Altura entre 100 e 250 é lida em centímetros ("174" → 1,74 m); em metros, vale de 0,3 a 3. Pressão alterada leva a data de `hoje`.
 */
export function pessoaDoForm(p: Pessoa, f: FormPerfil, hoje: string): { pessoa?: Pessoa; erros: ErrosPerfil } {
  const erros: ErrosPerfil = {};
  const nome = t(f.nome);
  if (!nome) erros.nome = 'Informe o nome.';

  const nasc = lerNascimento(f.nasc, hoje);
  if (nasc.erro) erros.nasc = nasc.erro;

  if (p.tipo === 'pet') return petDoForm(p, f, nome, nasc.iso, erros);

  const peso = f.peso.trim() ? lerNumeroBR(f.peso) : undefined;
  if (f.peso.trim() && peso == null) erros.peso = 'Use números, como 72,5.';
  let altura = f.altura.trim() ? lerNumeroBR(f.altura) : undefined;
  if (altura != null && altura >= 100 && altura <= 250) altura = Math.round(altura) / 100;
  if (f.altura.trim() && (altura == null || altura < 0.3 || altura > 3)) erros.altura = 'Use metros, como 1,74.';

  const c = { nome: t(f.contato.nome), relacao: t(f.contato.relacao), telefone: t(f.contato.telefone) };
  const temContato = !!(c.nome || c.relacao || c.telefone);
  if (temContato && (!c.nome || !c.telefone)) erros.contato = 'Informe nome e telefone do contato.';

  if (Object.keys(erros).length) return { erros };

  const valorPressao = t(f.pressao);
  const pressao = !valorPressao ? undefined : valorPressao === p.pressao?.valor ? p.pressao : { valor: valorPressao, data: hoje };


  const pessoa: Pessoa = limpar({
    ...p,
    nome,
    curto: curtoDe(p, nome),
    nascimento: nasc.iso,
    sexo: f.sexo || undefined,
    sangue: f.sangue && f.sangue !== 'nao-sei' ? f.sangue : undefined,
    peso,
    altura,
    pressao,
    alergias: alergiasDoForm(f),
    condicoes: f.condicoes
      .filter((x) => t(x.nome))
      .map((x) => {
        // Nome trocado: o nome clínico antigo deixa de valer.
        const nomeClinico = x.orig && t(x.nome) === x.orig.nome ? x.orig.nomeClinico : undefined;
        return limpar({ ...x.orig, nome: t(x.nome), desde: ou(x.desde), tipo: x.tipo, nomeClinico }) as Condicao;
      }),
    contatoEmergencia: temContato ? limpar({ ...p.contatoEmergencia, ...c }) : undefined,
    foto: f.foto,
  });
  return { pessoa, erros };
}

/** Mantém o nome curto escolhido; se era o primeiro nome, acompanha a troca do nome. */
const curtoDe = (p: Pessoa, nome: string) => (p.curto === p.nome.split(' ')[0] ? nome.split(' ')[0] : p.curto);

const alergiasDoForm = (f: FormPerfil) =>
  f.alergias.filter((a) => t(a.substancia)).map((a) => limpar({ ...a.orig, substancia: t(a.substancia), reacao: ou(a.reacao) }) as Alergia);

/**
 * Ramo do pet: nome, nascimento, sexo, alergias, foto e os dados do pet. Sangue, peso, altura,
 * pressão, condições e contato ficam como estão (o peso muda pelas pesagens).
 */
function petDoForm(p: Pessoa, f: FormPerfil, nome: string, nascimento: string | undefined, erros: ErrosPerfil): { pessoa?: Pessoa; erros: ErrosPerfil } {
  const fp = f.pet ?? formDoPet(p.pet);
  const vet = { nome: t(fp.veterinario.nome), clinica: ou(fp.veterinario.clinica), telefone: ou(fp.veterinario.telefone) };
  const temVet = !!(vet.nome || vet.clinica || vet.telefone);
  if (temVet && !vet.nome) erros.veterinario = 'Informe o nome do veterinário.';
  const c24 = { nome: t(fp.clinica24h.nome), telefone: t(fp.clinica24h.telefone) };
  const temC24 = !!(c24.nome || c24.telefone);
  if (temC24 && (!c24.nome || !c24.telefone)) erros.clinica24h = 'Informe nome e telefone da clínica.';
  if (Object.keys(erros).length) return { erros };

  const dados: DadosPet = limpar({
    ...p.pet,
    especie: 'cachorro' as const,
    raca: ou(fp.raca),
    // Sem a informação antes e toggle desligado: continua sem a informação.
    castrado: fp.castrado ? true : p.pet?.castrado === undefined ? undefined : false,
    microchip: ou(fp.microchip),
    veterinario: temVet ? limpar({ ...p.pet?.veterinario, ...vet }) : undefined,
    clinica24h: temC24 ? limpar({ ...p.pet?.clinica24h, ...c24 }) : undefined,
  });
  const pessoa: Pessoa = limpar({
    ...p,
    nome,
    curto: curtoDe(p, nome),
    nascimento,
    sexo: f.sexo || undefined,
    alergias: alergiasDoForm(f),
    foto: f.foto,
    pet: dados,
  });
  return { pessoa, erros };
}
