import { describe, expect, it } from 'vitest';
import { dataDoTexto, limparTexto, marcadoresDoTexto } from './laudo';

const LAUDO = `LABORATÓRIO EXEMPLO
Paciente: Helena Almeida   Data da coleta: 12/09/2026
Emitido em 14/09/2026

GLICOSE EM JEJUM ........ 92 mg/dL     70 a 99
Hemoglobina glicada  5,9 %   até 5,7
HEMOGLOBINA  13,8 g/dL   12,0 a 16,0
Colesterol total: 212 mg/dL
LDL-Colesterol 138 mg/dL
HDL-COLESTEROL 52 mg/dL
Triglicérides 1.240,0 mg/dL
Plaquetas 250 mil/mm³ 150 - 450
TSH 2,1 mUI/L`;

describe('laudo', () => {
  it('lê os valores dos marcadores conhecidos', () => {
    const r = marcadoresDoTexto(LAUDO);
    const v = Object.fromEntries(r.map((x) => [x.marcador, x.valor]));
    expect(v).toEqual({ Glicose: 92, 'Hemoglobina glicada': 5.9, 'Colesterol total': 212, LDL: 138, HDL: 52, 'Triglicerídeos': 1240, TSH: 2.1, Hemoglobina: 13.8, Plaquetas: 250 });
  });
  it('faixa de referência quando vem "x a y" ou "x - y"', () => {
    const r = marcadoresDoTexto(LAUDO);
    expect(r.find((x) => x.marcador === 'Glicose')).toMatchObject({ min: 70, max: 99, unidade: 'mg/dL' });
    expect(r.find((x) => x.marcador === 'Plaquetas')).toMatchObject({ min: 150, max: 450 });
    expect(r.find((x) => x.marcador === 'LDL')?.min).toBeUndefined();
  });
  it('laudo de imagem não inventa valores', () => {
    expect(marcadoresDoTexto('Fígado com dimensões normais. Pequeno cálculo de 3 mm no rim direito. Impressão: esteatose hepática.')).toEqual([]);
  });
  it('data da coleta', () => {
    expect(dataDoTexto(LAUDO)).toBe('2026-09-12');
    expect(dataDoTexto('Laudo emitido 03/11/2026')).toBe('2026-11-03');
    expect(dataDoTexto('sem data')).toBeUndefined();
  });
  it('limpa espaços e linhas vazias', () => {
    expect(limparTexto('  a   b \n\n\n\n c ')).toBe('a b\n\nc');
  });
});
