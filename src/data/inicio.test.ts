import { describe, expect, it } from 'vitest';
import { chaveDose, doseEmFoco, estadoDose, hhmm, minutos, posDia, saudacao, separarConcentracao } from './inicio';
import type { DoseHoje } from './store';
import type { Pessoa, Remedio } from './types';

const ana: Pessoa = { id: 'ana', nome: 'Ana', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [], souEu: true };
const rem = (id: string): Remedio =>
  ({ id, pessoaId: 'ana', nome: `${id} 10 mg`, dose: '1 comp.', unidade: 'comprimidos', horarios: [], continuo: true, avisarDias: 0, lembrete: false, ativo: true }) as Remedio;
const dose = (id: string, horario: string, status?: 'tomada' | 'pulada'): DoseHoje => ({
  remedio: rem(id),
  pessoa: ana,
  horario,
  dose: status && { remedioId: id, previstoPara: `2026-10-28T${horario}`, status, registradoEm: horario },
});

describe('doseEmFoco', () => {
  const dia = [dose('a', '06:30', 'tomada'), dose('b', '08:00'), dose('c', '21:00')];

  it('a atrasada mais antiga vem primeiro', () => {
    const f = doseEmFoco(dia, minutos('14:20'))!;
    expect(f.dose.remedio.id).toBe('b');
    expect(f.tom).toBe('atrasada');
    expect(f.rotulo).toBe('ATRASADA HÁ 6 H 20 MIN');
  });
  it('dentro de 15 min do horário é AGORA', () => {
    expect(doseEmFoco(dia, minutos('07:50'))!.rotulo).toBe('AGORA');
    expect(doseEmFoco(dia, minutos('08:15'))!.rotulo).toBe('AGORA');
  });
  it('antes da janela é PRÓXIMA', () => {
    expect(doseEmFoco(dia, minutos('07:00'))!.rotulo).toBe('PRÓXIMA · EM 1 H');
    expect(doseEmFoco(dia, minutos('07:20'))!.rotulo).toBe('PRÓXIMA · EM 40 MIN');
  });
  it('adiada sai da vez e volta depois de 15 min', () => {
    const adiadas = { [chaveDose(dia[1])]: minutos('14:35') };
    expect(doseEmFoco(dia, minutos('14:20'), adiadas)!.dose.remedio.id).toBe('c');
    expect(doseEmFoco(dia, minutos('14:35'), adiadas)!.dose.remedio.id).toBe('b');
  });
  it('só adiadas: mostra a que volta primeiro', () => {
    const so = [dose('b', '08:00')];
    const f = doseEmFoco(so, minutos('14:20'), { [chaveDose(so[0])]: minutos('14:35') })!;
    expect([f.tom, f.rotulo]).toEqual(['adiada', 'LEMBRAR ÀS 14:35']);
  });
  it('tudo registrado ou nada: sem foco', () => {
    expect(doseEmFoco([dose('a', '06:30', 'tomada'), dose('b', '08:00', 'pulada')], 600)).toBeUndefined();
    expect(doseEmFoco([], 600)).toBeUndefined();
  });
});

describe('estadoDose', () => {
  it('tomada, pulada, atrasada e futura', () => {
    expect(estadoDose(dose('a', '06:30', 'tomada'), 0)).toBe('tomada');
    expect(estadoDose(dose('a', '06:30', 'pulada'), 0)).toBe('pulada');
    expect(estadoDose(dose('a', '08:00'), minutos('08:16'))).toBe('atrasada');
    expect(estadoDose(dose('a', '08:00'), minutos('08:15'))).toBe('futura');
  });
});

describe('linha do dia e textos', () => {
  it('posDia vai de 06:00 a 22:00 e prende nas pontas', () => {
    expect(posDia(minutos('06:00'))).toBe(0);
    expect(posDia(minutos('14:00'))).toBe(50);
    expect(posDia(minutos('22:00'))).toBe(100);
    expect(posDia(minutos('05:00'))).toBe(0);
    expect(posDia(minutos('23:30'))).toBe(100);
  });
  it('hhmm passa da meia-noite', () => {
    expect(hhmm(minutos('23:55') + 15)).toBe('00:10');
  });
  it('separarConcentracao', () => {
    expect(separarConcentracao('Apoquel 16 mg')).toEqual(['Apoquel', '16 mg']);
    expect(separarConcentracao('Levotiroxina 75 mcg')).toEqual(['Levotiroxina', '75 mcg']);
    expect(separarConcentracao('Vitamina D')).toEqual(['Vitamina D', '']);
  });
  it('saudacao pelo horário', () => {
    expect([saudacao(minutos('08:00')), saudacao(minutos('14:20')), saudacao(minutos('19:00'))]).toEqual(['Bom dia', 'Boa tarde', 'Boa noite']);
  });
});
