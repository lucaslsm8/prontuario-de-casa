import { describe, expect, it } from 'vitest';
import { dataDoTexto, estruturaDoLaudo, limparTexto, marcadoresDoTexto, textoDoLaudo } from './laudo';

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
  it('resultado sem cabeçalho, rodapé, identificação e assinatura (laudo de imagem em 2 páginas)', () => {
    const rodape = [
      'Nome: HELENA ALMEIDA Prontuário: 000123',
      'Data de Nascimento: 12/03/1965 AN: 000999',
      'Solicitante: DRA. MARTA LINS Data: 27/10/2026 09:10:00',
      'ULTRASSONOGRAFIA DE ABDOME TOTAL',
      'Este é um exame complementar e, como tal, deverá ser analisado pelo médico assistente para correlação clínica e decisão terapêutica.',
      'Av. Paulista, 1000 - Bela Vista - São Paulo - SP - CEP: 01310-100 - Tel.: 3000-0000',
      'www.imagemexemplo.com.br',
    ];
    const p1 = ['Técnica:', 'Exame realizado com transdutor convexo.', 'Análise:', 'Exame anterior realizado em 01/02/2026.', 'Fígado com dimensões normais.', 'Impressão:', 'Exame dentro da normalidade.', ...rodape.slice(0, 4), '1/2', ...rodape.slice(4)].join('\n');
    const p2 = ['Laudo e', 'Revisão por:', ...rodape.slice(0, 4), '2/2', ...rodape.slice(4)].join('\n');
    expect(textoDoLaudo([p1, p2])).toBe(
      'Técnica:\nExame realizado com transdutor convexo.\nAnálise:\nExame anterior realizado em 01/02/2026.\nFígado com dimensões normais.\nImpressão:\nExame dentro da normalidade.',
    );
    expect(dataDoTexto([p1, p2].join('\n'))).toBe('2026-10-27');
  });
  it('página única: tira identificação e rodapé, mantém os valores', () => {
    const t = textoDoLaudo(['Paciente: Helena Almeida', 'Glicose 92 mg/dL', 'Página 1 de 1', 'Assinado eletronicamente por Dr. X'].map((l) => l).join('\n').split('\n\n'));
    expect(t).toBe('Glicose 92 mg/dL');
  });
});

describe('estruturaDoLaudo', () => {
  const LAUDO = [
    'Técnica:',
    'Exame realizado com aquisição volumétrica, sem contraste.',
    'Análise:',
    'Fígado com dimensões normais.',
    'Rins tópicos, sem cálculos.',
    'Impressão:',
    'Exame dentro da normalidade.',
  ].join('\n');

  it('títulos sozinhos na linha abrem seções; a impressão fica em destaque', () => {
    const s = estruturaDoLaudo(LAUDO);
    expect(s.map((x) => x.titulo)).toEqual(['Técnica', 'Análise', 'Impressão']);
    expect(s.map((x) => x.destaque)).toEqual([false, false, true]);
    expect(s[1].linhas.map((l) => l.texto)).toEqual(['Fígado com dimensões normais.', 'Rins tópicos, sem cálculos.']);
  });

  it('seção conhecida com o conteúdo na mesma linha', () => {
    const s = estruturaDoLaudo('Conclusão: Sem alterações.\nObservação: repetir em 6 meses.');
    expect(s).toEqual([
      { titulo: 'Conclusão', destaque: true, linhas: [{ texto: 'Sem alterações.' }] },
      { titulo: 'Observação', destaque: false, linhas: [{ texto: 'repetir em 6 meses.' }] },
    ]);
  });

  it('título em maiúsculas e linhas "Rótulo: valor"', () => {
    const s = estruturaDoLaudo('LABORATÓRIO CENTRAL\nData da coleta: 05/11/2026\nBIOQUÍMICA\nCreatinina 1,8 mg/dL (0,7 a 1,3)\nMaterial: soro');
    expect(s.map((x) => x.titulo)).toEqual(['LABORATÓRIO CENTRAL', 'BIOQUÍMICA']);
    expect(s[0].linhas).toEqual([{ rotulo: 'Data da coleta', texto: '05/11/2026' }]);
    expect(s[1].linhas).toEqual([{ texto: 'Creatinina 1,8 mg/dL (0,7 a 1,3)' }, { rotulo: 'Material', texto: 'soro' }]);
  });

  it('não confunde hora, frase longa nem texto sem estrutura', () => {
    expect(estruturaDoLaudo('Coleta às 10:30 no laboratório')[0].linhas[0]).toEqual({ texto: 'Coleta às 10:30 no laboratório' });
    expect(estruturaDoLaudo('Comparado ao exame anterior realizado no mesmo serviço: sem mudanças.')[0].linhas[0].rotulo).toBeUndefined();
    expect(estruturaDoLaudo('Texto simples.\nOutra linha.')).toEqual([{ destaque: false, linhas: [{ texto: 'Texto simples.' }, { texto: 'Outra linha.' }] }]);
  });
});
