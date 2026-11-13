// Cartela visual do remédio: a cartela aberta sai do estoque, sem evento novo.
// Funções puras, testadas em cartela.test.ts. Esboço: docs/cartela-remedio.html.

import type { Aparencia, CorPilula, FormaPilula, Remedio } from './types';

export type EstadoPilula = 'cheio' | 'metade' | 'contorno';

export const FORMAS_PILULA: { id: FormaPilula; nome: string }[] = [
  { id: 'redondo', nome: 'Redondo' },
  { id: 'oval', nome: 'Oval' },
  { id: 'oblongo', nome: 'Oblongo' },
  { id: 'capsula', nome: 'Cápsula' },
];

/** Poucas cores, nomeadas, para o desenho ficar bom e a pessoa achar rápido. */
export const CORES_PILULA: { id: CorPilula; nome: string; hex: string }[] = [
  { id: 'branco', nome: 'branco', hex: '#FBFBF8' },
  { id: 'amarelo', nome: 'amarelo', hex: '#F2D46B' },
  { id: 'rosa', nome: 'rosa', hex: '#F2A9B8' },
  { id: 'laranja', nome: 'laranja', hex: '#F0A35A' },
  { id: 'azul', nome: 'azul', hex: '#7FA9DA' },
  { id: 'verde', nome: 'verde', hex: '#8CC7A1' },
  { id: 'vermelho', nome: 'vermelho', hex: '#D9665B' },
  { id: 'marrom', nome: 'marrom', hex: '#A97A57' },
];
export const hexCor = (c: CorPilula | undefined) => CORES_PILULA.find((x) => x.id === c)?.hex ?? CORES_PILULA[0].hex;

/** "Redondo, branco, com sulco" · "Cápsula, azul e branco". */
export function descricaoAparencia(a: Aparencia) {
  const forma = FORMAS_PILULA.find((f) => f.id === a.forma)?.nome ?? '';
  if (a.forma === 'capsula') return `${forma}, ${a.cor}${a.cor2 && a.cor2 !== a.cor ? ` e ${a.cor2}` : ''}`;
  return [forma, a.cor, a.sulco ? 'com sulco' : ''].filter(Boolean).join(', ');
}

/**
 * A cartela aberta: o resto do estoque por `porCartela` (cartela cheia quando o resto é zero).
 * As primeiras bolhas (ordem de leitura) são as tomadas; meia unidade vira "metade".
 */
export function estadosCartela(estoque: number, porCartela: number) {
  const n = Math.max(1, Math.round(porCartela));
  const e = Math.max(0, estoque);
  const r = Math.round((e % n) * 100) / 100;
  const resto = e <= 0 ? 0 : r === 0 ? n : r;
  const inteiros = Math.floor(resto + 1e-9);
  const meio = resto - inteiros > 1e-6;
  const vazias = n - inteiros - (meio ? 1 : 0);
  const estados: EstadoPilula[] = Array.from({ length: n }, (_, i) => (i < vazias ? 'contorno' : meio && i === vazias ? 'metade' : 'cheio'));
  const fechadas = Math.max(0, Math.round((e - resto) / n));
  return { estados, resto, fechadas };
}

/** Colunas da grade: comprimidos por cartela divididos pelas fileiras (14 em 2 fileiras = 7 colunas). */
export const colunasCartela = (c: { porCartela: number; fileiras: number }) => Math.max(1, Math.ceil(c.porCartela / Math.max(1, c.fileiras)));

/** Só mostra a cartela com o tamanho dela e o estoque contado em unidades. */
export const temCartela = (r: Remedio) => !!r.cartela && r.cartela.porCartela > 0 && r.estoque != null;

/** Lê "14" ou "2" dos campos do formulário; vazio ou fora da faixa = undefined. */
export function lerCartela(porCartela: string, fileiras: string): Remedio['cartela'] {
  const p = Number(porCartela.trim());
  const f = Number(fileiras.trim() || '1');
  if (!Number.isInteger(p) || p < 1 || p > 200) return undefined;
  if (!Number.isInteger(f) || f < 1 || f > p) return undefined;
  return { porCartela: p, fileiras: f };
}

// ── Frasco (gotas e mL) ─────────────────────────────────────────────────────

/** Gotas por mL (padrão da farmacopeia; o conta-gotas do remédio pode variar). */
export const GOTAS_POR_ML = 20;
/** Remédio contado em gotas ou mL: mostra frasco no lugar da cartela. */
export const ehLiquido = (r: Pick<Remedio, 'unidade'>) => r.unidade === 'gotas' || r.unidade === 'mL';
/** Estoque em mL (gotas ÷ 20). */
export const emMl = (r: Pick<Remedio, 'unidade'>, qtd: number) => (r.unidade === 'gotas' ? qtd / GOTAS_POR_ML : qtd);

/**
 * O frasco aberto: como a cartela, o resto do estoque pela capacidade (`frasco`, na unidade do estoque).
 * `pct` de 0 a 1; `fechados` = frascos ainda lacrados.
 */
export function nivelFrasco(estoque: number, capacidade: number) {
  const cap = Math.max(1, capacidade);
  const e = Math.max(0, estoque);
  const r = Math.round((e % cap) * 100) / 100;
  const resto = e <= 0 ? 0 : r === 0 ? cap : r;
  return { resto, pct: Math.min(1, resto / cap), fechados: Math.max(0, Math.round((e - resto) / cap)) };
}

/** Tamanhos comuns para os atalhos da tela do remédio. */
export const CARTELAS_COMUNS = [10, 14, 15, 20, 28, 30];
export const FRASCOS_COMUNS_ML = [10, 15, 20, 30, 100, 120];
