import { describe, expect, it } from 'vitest';
import { proximosLembretes } from './lembretes';
import type { State } from './store';
import type { Consulta, Pessoa, Prevencao, Remedio, Vacina } from './types';

const pessoa = (id: string, curto: string, sexo: Pessoa['sexo']): Pessoa => ({ id, nome: curto, curto, sexo, cor: '#ccc', alergias: [], condicoes: [] });

const remedio = (o: Partial<Remedio> = {}): Remedio => ({
  id: 'levo', pessoaId: 'roberto', nome: 'Levotiroxina 75 mcg', dose: '1 comp.', doseLonga: '1 comprimido', unidade: 'comprimidos',
  horarios: ['06:30', '21:00'], continuo: true, avisarDias: 5, lembrete: true, ativo: true, ...o,
});

const consulta = (o: Partial<Consulta> = {}): Consulta => ({
  id: 'cardio', tipo: 'consulta', pessoaId: 'roberto', titulo: 'Cardiologista', profissional: 'Dra. Ana', local: 'Clínica Centro',
  data: '2026-10-30', hora: '14:30', levar: [], lembretes: ['1 dia antes', '2 h antes'], ...o,
});

// Doses pendentes valem por 24 h para trás; `inicio` hoje evita as de ontem nos testes.
const HOJE_INI = '2026-10-29';

const estado = (o: Partial<State> = {}): State => ({
  pessoas: [pessoa('roberto', 'Roberto', 'Masculino'), pessoa('helena', 'Helena', 'Feminino')],
  remedios: [], doses: [], consultas: [], exames: [], planos: [], vacinas: [], prevencoes: [], sintomas: [], procedimentos: [], pesagens: [], medicoes: [], anexos: [], compartilhamentos: [], papeis: [], aparelhos: [],
  config: { esconderNomeNotif: true } as State['config'],
  bloqueado: false, temSenha: false, ...o,
});

const em = (s: string) => {
  const [d, h] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, m - 1, dd, hh, mm);
};

describe('proximosLembretes', () => {
  it('lista as doses das próximas 24 h, com o nome escondido', () => {
    const l = proximosLembretes(estado({ remedios: [remedio({ inicio: HOJE_INI })] }), em('2026-10-29T08:00'));
    expect(l.map((x) => x.id)).toEqual(['dose|levo|2026-10-29T06:30', 'dose|levo|2026-10-29T21:00', 'dose|levo|2026-10-30T06:30']);
    expect(l[1]).toEqual({
      id: 'dose|levo|2026-10-29T21:00', quando: '2026-10-29T21:00',
      titulo: 'Hora do remédio do Roberto', corpo: 'Abra para ver qual. 1 dose às 21:00.', acoes: true,
    });
  });

  it('mostra o nome quando "esconder" está desligado e usa "da" para mulheres', () => {
    const s = estado({ remedios: [remedio({ pessoaId: 'helena', nome: 'Sinvastatina 20 mg', horarios: ['21:00'], inicio: HOJE_INI })] });
    const visivel = proximosLembretes({ ...s, config: { esconderNomeNotif: false } as State['config'] }, em('2026-10-29T08:00'));
    expect(visivel[0].titulo).toBe('Sinvastatina 20 mg · Helena');
    expect(visivel[0].corpo).toBe('1 comprimido às 21:00.');
    expect(proximosLembretes(s, em('2026-10-29T08:00'))[0].titulo).toBe('Hora do remédio da Helena');
  });

  it('mantém a dose não registrada na lista por 24 h (o Rust decide se ainda avisa)', () => {
    const s = estado({ remedios: [remedio({ horarios: ['06:30'] })] });
    const tem = (agora: string) => proximosLembretes(s, em(agora)).some((x) => x.id === 'dose|levo|2026-10-29T06:30');
    expect(tem('2026-10-29T06:50')).toBe(true);
    expect(tem('2026-10-29T07:01')).toBe(true);
    expect(tem('2026-10-29T23:00')).toBe(true);
    expect(tem('2026-10-30T06:30')).toBe(true);
    expect(tem('2026-10-30T06:31')).toBe(false);
  });

  it('não lembra dose já registrada', () => {
    const s = estado({
      remedios: [remedio({ horarios: ['21:00'], inicio: HOJE_INI })],
      doses: [{ remedioId: 'levo', previstoPara: '2026-10-29T21:00', status: 'tomada', registradoEm: '20:58' }],
    });
    expect(proximosLembretes(s, em('2026-10-29T20:00'))).toEqual([]);
  });

  it('ignora remédio sem lembrete, inativo, "se necessário" ou fora do período', () => {
    const s = estado({
      remedios: [
        remedio({ id: 'a', lembrete: false }),
        remedio({ id: 'b', ativo: false }),
        remedio({ id: 'c', seNecessario: true }),
        remedio({ id: 'd', inicio: HOJE_INI, fim: '2026-10-29' }),
        remedio({ id: 'e', inicio: '2026-10-30' }),
      ],
    });
    expect(proximosLembretes(s, em('2026-10-29T08:00')).map((x) => x.id)).toEqual([
      'dose|d|2026-10-29T06:30',
      'dose|d|2026-10-29T21:00',
      'dose|e|2026-10-30T06:30',
    ]);
  });

  it('lembra a consulta 1 dia antes, sem ações', () => {
    const l = proximosLembretes(estado({ consultas: [consulta()] }), em('2026-10-29T08:00'));
    expect(l).toEqual([{
      id: 'consulta|cardio|1 dia antes', quando: '2026-10-29T14:30',
      titulo: 'Cardiologista amanhã às 14:30', corpo: 'Dra. Ana · Clínica Centro', acoes: false,
    }]);
  });

  it('lembra a consulta 2 h antes e uma semana antes', () => {
    const s = estado({ consultas: [consulta(), consulta({ id: 'olho', titulo: 'Oftalmologista', profissional: undefined, local: undefined, data: '2026-11-06', hora: '13:00', lembretes: ['1 semana'] })] });
    const l = proximosLembretes(s, em('2026-10-30T12:00'));
    expect(l.map((x) => [x.id, x.titulo, x.corpo])).toEqual([
      ['consulta|cardio|2 h antes', 'Cardiologista hoje às 14:30', 'Dra. Ana · Clínica Centro'],
      ['consulta|olho|1 semana', 'Oftalmologista em 7 dias às 13:00', ''],
    ]);
  });

  it('não lembra consulta que já passou', () => {
    const s = estado({ consultas: [consulta({ data: '2026-10-29', hora: '08:10', lembretes: ['2 h antes'] })] });
    expect(proximosLembretes(s, em('2026-10-29T08:20'))).toEqual([]);
  });

  describe('pets', () => {
    const mel: Pessoa = { ...pessoa('mel', 'Mel', 'Feminino'), tipo: 'pet' };
    const thor: Pessoa = { ...pessoa('thor', 'Thor', 'Masculino'), tipo: 'pet' };
    const vac = (o: Partial<Vacina> = {}): Vacina => ({ id: 'v1', pessoaId: 'mel', nome: 'V10', data: '2025-10-29', proxima: '2026-10-29', ...o });
    const prev = (o: Partial<Prevencao> = {}): Prevencao => ({ id: 'p1', pessoaId: 'thor', tipo: 'antipulgas', produto: 'NexGard', data: '2026-09-29', intervaloDias: 30, ...o });
    const com = (o: Partial<State>) => estado({ pessoas: [mel, thor], ...o });

    it('lembra o reforço da vacina às 09:00, sem ações', () => {
      const l = proximosLembretes(com({ vacinas: [vac({ veterinario: 'Dra. Paula' })] }), em('2026-10-29T08:00'));
      expect(l).toEqual([{ id: 'vacina|v1', quando: '2026-10-29T09:00', titulo: 'Vacina da Mel: V10 hoje', corpo: 'Reforço · Dra. Paula', acoes: false }]);
    });
    it('corpo da vacina sem veterinário', () => {
      expect(proximosLembretes(com({ vacinas: [vac()] }), em('2026-10-29T08:00'))[0].corpo).toBe('Reforço');
    });
    it('lembra a prevenção do dia, com "do" para macho', () => {
      const l = proximosLembretes(com({ prevencoes: [prev()] }), em('2026-10-29T08:00'));
      expect(l).toEqual([{ id: 'prevencao|p1', quando: '2026-10-29T09:00', titulo: 'Antipulgas do Thor hoje', corpo: 'NexGard · a cada 30 dias', acoes: false }]);
    });
    it('rotula vermífugo e outro', () => {
      const l = proximosLembretes(com({ prevencoes: [prev({ tipo: 'vermifugo', produto: 'Drontal' }), prev({ id: 'p2', tipo: 'outro', produto: 'Banho' })] }), em('2026-10-29T08:00'));
      expect(l.map((x) => x.titulo)).toEqual(['Vermífugo do Thor hoje', 'Banho do Thor hoje']);
    });
    it('só a vacina mais recente de cada nome conta', () => {
      const s = com({ vacinas: [vac(), vac({ id: 'v2', data: '2026-10-01', proxima: '2027-10-01' })] });
      expect(proximosLembretes(s, em('2026-10-29T08:00'))).toEqual([]);
    });
    it('prevenção já reaplicada não repete', () => {
      const s = com({ prevencoes: [prev(), prev({ id: 'p2', data: '2026-10-20' })] });
      expect(proximosLembretes(s, em('2026-10-29T08:00'))).toEqual([]);
    });
    it('"outro" sem produto vira "Prevenção"', () => {
      const l = proximosLembretes(com({ prevencoes: [prev({ tipo: 'outro', produto: '' })] }), em('2026-10-29T08:00'));
      expect(l.map((x) => [x.titulo, x.corpo])).toEqual([['Prevenção do Thor hoje', 'a cada 30 dias']]);
    });
    it('trocar de produto do mesmo tipo cancela o lembrete do anterior', () => {
      const s = com({ prevencoes: [prev(), prev({ id: 'p2', produto: 'Bravecto', data: '2026-10-20', intervaloDias: 90 })] });
      expect(proximosLembretes(s, em('2026-10-29T08:00'))).toEqual([]);
    });
    it('janela: 30 min de atraso e 24 h à frente', () => {
      const s = com({ vacinas: [vac()] });
      const tem = (agora: string) => proximosLembretes(s, em(agora)).length === 1;
      expect(tem('2026-10-29T09:30')).toBe(true);
      expect(tem('2026-10-29T09:31')).toBe(false);
      expect(tem('2026-10-28T09:00')).toBe(true);
      expect(tem('2026-10-28T08:59')).toBe(false);
    });
    it('vacina sem próximo reforço não gera lembrete', () => {
      expect(proximosLembretes(com({ vacinas: [vac({ proxima: undefined })] }), em('2026-10-29T08:00'))).toEqual([]);
    });
  });
});
