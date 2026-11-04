import { describe, expect, it } from 'vitest';
import { estadoExemplo, pessoa } from './store';
import { blocosDoPerfil, nomeDoPdf, pdfDoPerfil } from './relatorio';
import { gerarPdf, quebrar } from './pdfTexto';
import type { Categoria } from './types';

const HOJE = '2026-10-28';
const tudo = () => true;
const textos = (cats: (c: Categoria) => boolean, id: string) => {
  const s = estadoExemplo();
  return blocosDoPerfil(s, pessoa(s, id)!, cats, HOJE).map((b) => ('detalhe' in b && b.detalhe ? `${b.texto} | ${b.detalhe}` : b.texto));
};
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

describe('blocosDoPerfil', () => {
  it('pessoa: nome, data e as seções de cada categoria', () => {
    const t = textos(tudo, 'helena');
    expect(t[0]).toBe('Helena Almeida');
    expect(t[1]).toContain('28/10/2026');
    for (const s of ['Dados pessoais', 'Alergias', 'Vacinas', 'Remédios em uso', 'Consultas anteriores', 'Exames']) expect(t).toContain(s);
  });

  it('respeita o compartilhamento: sem "remedios", nada de remédios', () => {
    const t = textos((c) => c !== 'remedios', 'helena');
    expect(t).not.toContain('Remédios em uso');
    expect(t).toContain('Exames');
  });

  it('pet: identificação, prevenção e peso; sem plano de saúde', () => {
    const t = textos(tudo, 'mel');
    expect(t).toContain('Identificação');
    expect(t).toContain('Prevenção');
    expect(t).toContain('Peso');
    expect(t).not.toContain('Plano de saúde');
  });
});

describe('gerarPdf', () => {
  it('monta um PDF com xref e as páginas certas', () => {
    const pdf = latin1(gerarPdf([{ tipo: 'titulo', texto: 'Teste' }], 'rodapé'));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 1');
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    // O startxref aponta para o "xref".
    const pos = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(pos, pos + 4)).toBe('xref');
  });

  it('acentos em WinAnsi e parênteses escapados', () => {
    const pdf = latin1(gerarPdf([{ tipo: 'texto', texto: 'Pressão (alta)' }], 'x'));
    expect(pdf).toContain('Press\xE3o \\(alta\\)');
  });

  it('texto longo vira várias páginas', () => {
    const blocos = Array.from({ length: 200 }, (_, i) => ({ tipo: 'item' as const, texto: `Linha ${i}` }));
    expect(latin1(gerarPdf(blocos, 'x'))).toMatch(/\/Count [3-9]/);
  });

  it('o PDF do perfil sai inteiro', () => {
    const s = estadoExemplo();
    const p = pessoa(s, 'helena')!;
    expect(latin1(pdfDoPerfil(s, p, tudo, HOJE))).toContain('Helena Almeida');
    expect(nomeDoPdf(p, HOJE)).toBe('Prontuario - Helena Almeida - 28-10-2026.pdf');
  });
});

describe('quebrar', () => {
  it('quebra por palavra dentro da largura', () => {
    const l = quebrar('um dois três quatro cinco seis sete oito nove dez', 10, 80);
    expect(l.length).toBeGreaterThan(1);
    expect(l.join(' ')).toBe('um dois três quatro cinco seis sete oito nove dez');
  });
  it('corta palavra maior que a linha', () => {
    expect(quebrar('a'.repeat(200), 10, 50).length).toBeGreaterThan(3);
  });
});
