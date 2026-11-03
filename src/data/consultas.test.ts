import { describe, expect, it } from 'vitest';
import { distancia, filtrarConsultas, porMesConsultas } from './consultas';
import type { Consulta } from './types';

const c = (id: string, x: Partial<Consulta>): Consulta => ({ id, tipo: 'consulta', pessoaId: 'helena', titulo: 'Clínico', data: '2026-11-05', hora: '10:00', levar: [], lembretes: [], ...x });
const lista = [
  c('a', { data: '2026-11-20', titulo: 'Cardiologia', pessoaId: 'roberto', profissional: 'Dr. Paulo Mendes' }),
  c('b', { data: '2026-11-05', hora: '09:00' }),
  c('c', { data: '2026-10-01', tipo: 'exame', titulo: 'Ultrassom' }),
  c('d', { data: '2026-09-15', titulo: 'Dermatologia', pessoaId: 'pedro' }),
];
const f = { quando: 'proximas' as const, pessoa: 'todos', tipo: 'todos' as const, busca: '' };

describe('consultas', () => {
  it('próximas em ordem crescente; passadas da mais recente', () => {
    expect(filtrarConsultas(lista, f, '2026-10-28').map((x) => x.id)).toEqual(['b', 'a']);
    expect(filtrarConsultas(lista, { ...f, quando: 'passadas' }, '2026-10-28').map((x) => x.id)).toEqual(['c', 'd']);
  });
  it('filtra por pessoa, tipo e busca (sem acento, inclui o nome da pessoa)', () => {
    expect(filtrarConsultas(lista, { ...f, quando: 'todas', pessoa: 'roberto' }, '2026-10-28').map((x) => x.id)).toEqual(['a']);
    expect(filtrarConsultas(lista, { ...f, quando: 'todas', tipo: 'exame' }, '2026-10-28').map((x) => x.id)).toEqual(['c']);
    expect(filtrarConsultas(lista, { ...f, quando: 'todas', busca: 'paulo' }, '2026-10-28').map((x) => x.id)).toEqual(['a']);
    expect(filtrarConsultas(lista, { ...f, quando: 'todas', busca: 'pedr' }, '2026-10-28', (id) => (id === 'pedro' ? 'Pedro' : '')).map((x) => x.id)).toEqual(['d']);
  });
  it('agrupa por mês e diz a distância', () => {
    expect(porMesConsultas(filtrarConsultas(lista, f, '2026-10-28')).map(([m, xs]) => [m, xs.length])).toEqual([['NOVEMBRO 2026', 2]]);
    expect(distancia('2026-10-28', '2026-10-28')).toBe('hoje');
    expect(distancia('2026-10-29', '2026-10-28')).toBe('amanhã');
    expect(distancia('2026-11-02', '2026-10-28')).toBe('em 5 dias');
    expect(distancia('2026-10-25', '2026-10-28')).toBe('há 3 dias');
  });
});

describe('perfil (celular)', () => {
  it('recorte só com os registros da pessoa; pessoas ficam todas', async () => {
    const { estadoExemplo, recortarPerfil } = await import('./store');
    const s = estadoExemplo();
    const r = recortarPerfil(s, 'roberto');
    expect(r.pessoas.length).toBe(s.pessoas.length);
    expect(r.remedios.length).toBeGreaterThan(0);
    expect(r.remedios.every((x) => x.pessoaId === 'roberto')).toBe(true);
    expect(r.consultas.every((x) => x.pessoaId === 'roberto')).toBe(true);
    expect(r.exames.every((x) => x.pessoaId === 'roberto')).toBe(true);
    const ids = new Set(r.remedios.map((x) => x.id));
    expect(r.doses.every((d) => ids.has(d.remedioId))).toBe(true);
  });
});
