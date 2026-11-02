import { describe, expect, it } from 'vitest';
import type { Lembrete } from './lembretes';
import { acaoDoPlugin, adiadoVale, adiar, idNumerico, paraAgendar, parteDose } from './lembretesAndroid';

const agora = new Date(2026, 9, 28, 20, 0);
const dose: Lembrete = { id: 'dose|losartana|2026-10-28T21:00', quando: '2026-10-28T21:00', titulo: 'Hora do remédio', corpo: 'Losartana 50 mg', acoes: true };
const consulta: Lembrete = { id: 'consulta|c1|1440', quando: '2026-10-29T09:00', titulo: 'Consulta amanhã', corpo: 'Cardiologia', acoes: false };

describe('idNumerico', () => {
  it('é estável, positivo e cabe em 32 bits com sinal', () => {
    const n = idNumerico(dose.id);
    expect(n).toBe(idNumerico(dose.id));
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(2147483647);
    expect(idNumerico(dose.id)).not.toBe(idNumerico(dose.id + '|adiado'));
  });
});

describe('paraAgendar', () => {
  it('converte data local, id e texto; ação só quando acoes', () => {
    const [a, b] = paraAgendar([dose, consulta], agora);
    expect(a.em).toEqual(new Date(2026, 9, 28, 21, 0));
    expect(a.id).toBe(idNumerico(dose.id));
    expect(a.title).toBe('Hora do remédio');
    expect(a.body).toBe('Losartana 50 mg');
    expect(a.actionTypeId).toBe('dose');
    expect(a.extra).toEqual({ id: dose.id });
    expect(b.actionTypeId).toBeUndefined();
    expect(b.em).toEqual(new Date(2026, 9, 29, 9, 0));
  });
  it('descarta o que já passou', () => {
    const passado: Lembrete = { ...dose, id: 'dose|x|2026-10-28T19:00', quando: '2026-10-28T19:00' };
    expect(paraAgendar([passado], agora)).toEqual([]);
  });
});

describe('adiar', () => {
  it('agenda daqui a 15 min com o sufixo |adiado, sem repetir o sufixo', () => {
    const a = adiar(dose.id, 'T', 'C', agora);
    expect(a.em).toEqual(new Date(2026, 9, 28, 20, 15));
    expect(a.extra.id).toBe(dose.id + '|adiado');
    expect(a.actionTypeId).toBe('dose');
    expect(adiar(a.extra.id, 'T', 'C', agora).extra.id).toBe(dose.id + '|adiado');
  });
});

describe('ações', () => {
  it('mapeia os ids do plugin', () => {
    expect(acaoDoPlugin('tomei')).toBe('tomada');
    expect(acaoDoPlugin('pular')).toBe('pulada');
    expect(acaoDoPlugin('adiar')).toBe('adiar');
    expect(acaoDoPlugin('tap')).toBeNull();
    expect(acaoDoPlugin(undefined)).toBeNull();
  });
  it('lê a dose do id, inclusive adiado', () => {
    expect(parteDose(dose.id + '|adiado')).toEqual({ remedioId: 'losartana', previstoPara: '2026-10-28T21:00' });
    expect(parteDose(consulta.id)).toBeNull();
  });
  it('adiamento só vale com a dose sem registro', () => {
    const id = dose.id + '|adiado';
    expect(adiadoVale(id, [])).toBe(true);
    expect(adiadoVale(id, [{ remedioId: 'losartana', previstoPara: '2026-10-28T21:00' } as never])).toBe(false);
    expect(adiadoVale(dose.id, [])).toBe(false);
    expect(adiadoVale(undefined, [])).toBe(false);
  });
});
