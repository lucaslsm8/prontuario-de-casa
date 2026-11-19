import { describe, expect, it } from 'vitest';
import { POLIVALENTE, vacinasDaCarteira } from './carteiraVacina';

const HOJE = '2026-11-19';

describe('vacinasDaCarteira', () => {
  it('selos com nome, aplicação, revacinação e lote; ignora fabricação e validade do frasco', () => {
    const texto = [
      'CARTEIRA DE VACINAÇÃO',
      'Vanguard Plus V10',
      'Partida: 451203 Fab: 03/2026 Val: 03/2027',
      'Data 12/03/2026  Revacinar 12/03/2027',
      'Rabisin',
      'Lote: A12B3',
      '15/03/26',
      'Próxima dose 15/03/27',
    ].join('\n');
    expect(vacinasDaCarteira(texto, HOJE)).toEqual([
      { nome: 'V10', data: '2026-03-12', proxima: '2027-03-12', lote: '451203', trecho: expect.any(String) },
      { nome: 'Antirrábica', data: '2026-03-15', proxima: '2027-03-15', lote: 'A12B3', trecho: expect.any(String) },
    ]);
  });

  it('polivalente sem número fica para a pessoa escolher; data futura sozinha não vira aplicação', () => {
    const r = vacinasDaCarteira('Recombitek C6\n02/02/2026\nGiardiavax\nrevacinar 10/12/2026', HOJE);
    expect(r[0]).toMatchObject({ nome: POLIVALENTE, data: '2026-02-02' });
    expect(r[1].nome).toBe('Giárdia');
    expect(r[1].data).toBeUndefined();
  });

  it('marca o que já está registrado e tira repetidas', () => {
    const r = vacinasDaCarteira('V10 10/01/2026\nV10 10/01/2026\nTosse dos canis 11/01/2026', HOJE, [{ nome: 'v10', data: '2026-01-10' }]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nome: 'V10', jaRegistrada: true });
    expect(r[1]).toMatchObject({ nome: 'Gripe canina', data: '2026-01-11' });
  });

  it('datas inválidas e texto sem vacina', () => {
    expect(vacinasDaCarteira('Leishmaniose 31/02/2026', HOJE)[0].data).toBeUndefined();
    expect(vacinasDaCarteira('Nome do animal: Mel\nRaça: SRD', HOJE)).toEqual([]);
  });
});
