import { describe, expect, it } from 'vitest';
import { pendenciaDoPerfil } from './seletorPerfil';
import { minutos } from './inicio';
import type { DoseHoje } from './store';
import type { Consulta, Pessoa, Remedio } from './types';

const ana: Pessoa = { id: 'ana', nome: 'Ana', curto: 'Ana', cor: '#ccc', alergias: [], condicoes: [] };
const rem = (extra: Partial<Remedio> = {}): Remedio =>
  ({ id: 'r', pessoaId: 'ana', nome: 'Losartana 50 mg', dose: '1 comp.', unidade: 'comprimidos', horarios: ['08:00'], continuo: true, avisarDias: 0, lembrete: false, ativo: true, ...extra }) as Remedio;
const dose = (horario: string, tomada = false): DoseHoje => ({
  remedio: rem(), pessoa: ana, horario,
  dose: tomada ? { remedioId: 'r', previstoPara: `2026-10-28T${horario}`, status: 'tomada', registradoEm: horario } : undefined,
});
const consulta = (data: string, titulo = 'Cardiologista'): Consulta => ({ id: data, pessoaId: 'ana', titulo, data, hora: '09:00' }) as Consulta;

describe('pendenciaDoPerfil', () => {
  const hoje = '2026-10-28';
  it('dose atrasada vem antes de tudo', () => {
    expect(pendenciaDoPerfil([dose('08:00'), dose('09:00')], [], [consulta('2026-11-02')], minutos('14:00'), hoje)).toEqual({ texto: '2 doses atrasadas', alerta: true });
  });
  it('dose dentro de 15 min é "Dose agora"', () => {
    expect(pendenciaDoPerfil([dose('14:10')], [], [], minutos('14:00'), hoje)).toEqual({ texto: 'Dose agora', alerta: true });
  });
  it('remédio acabando, sem a concentração', () => {
    const r = rem({ estoque: 3, avisarDias: 5 });
    expect(pendenciaDoPerfil([dose('08:00', true)], [r], [], minutos('14:00'), hoje).texto).toBe('Losartana acabando');
  });
  it('próxima consulta, ignorando as passadas', () => {
    expect(pendenciaDoPerfil([], [], [consulta('2026-10-01', 'Antiga'), consulta('2026-11-12')], minutos('14:00'), hoje)).toEqual({ texto: 'Cardiologista · 12/11', alerta: false });
  });
  it('nada pendente', () => {
    expect(pendenciaDoPerfil([dose('08:00', true)], [rem()], [], minutos('14:00'), hoje)).toEqual({ texto: 'Tudo em dia', alerta: false });
  });
});
