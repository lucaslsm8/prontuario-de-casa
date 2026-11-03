import { describe, expect, it } from 'vitest';
import { eventosDaAgenda } from './agendaCelular';
import type { Consulta } from './types';

const c = (x: Partial<Consulta>): Consulta => ({ id: 'c1', tipo: 'consulta', pessoaId: 'helena', titulo: 'Cardiologia', data: '2026-11-05', hora: '14:30', levar: [], lembretes: [], ...x });

describe('agenda do celular', () => {
  it('só as consultas da pessoa, do último ano em diante, com hora válida', () => {
    const ev = eventosDaAgenda([
      c({}),
      c({ id: 'c2', pessoaId: 'roberto' }),
      c({ id: 'c3', data: '2025-01-01' }),
      c({ id: 'c4', hora: '' }),
    ], 'helena', '2026-10-28');
    expect(ev.map((e) => e.chave)).toEqual(['c1']);
  });
  it('título, horário, local e descrição', () => {
    const [e] = eventosDaAgenda([c({ profissional: 'Dr. Paulo', local: 'Clínica X', endereco: 'Rua A, 10', duracaoMin: 30, preparo: 'jejum de 4 h', levar: [{ item: 'Exames', ok: true }] })], 'helena', '2026-10-28', 'Helena');
    expect(e.titulo).toBe('Cardiologia · Dr. Paulo');
    expect(e.inicio).toBe(new Date('2026-11-05T14:30:00').getTime());
    expect(e.fim - e.inicio).toBe(30 * 60_000);
    expect(e.local).toBe('Clínica X, Rua A, 10');
    expect(e.descricao).toBe('Preparo: jejum de 4 h\nLevar: Exames\nMarcada no Prontuário de Casa para Helena');
  });
  it('sem duração, 1 hora', () => {
    const [e] = eventosDaAgenda([c({})], 'helena', '2026-10-28');
    expect(e.fim - e.inicio).toBe(3_600_000);
    expect(e.local).toBeUndefined();
  });
});
