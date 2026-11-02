import { describe, expect, it } from 'vitest';
import type { Lembrete } from './lembretes';
import { acaoDoPlugin, adiadoVale, adiar, CORPO_GENERICO, idNumerico, lerAcaoPlugin, paraAgendar, parteDose, pendenteFica, TITULO_GENERICO } from './lembretesAndroid';

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
    // Consulta que passou não volta, nem recente.
    expect(paraAgendar([{ ...consulta, quando: '2026-10-28T19:50' }], agora)).toEqual([]);
  });
  it('dose de até 30 min atrás avisa logo, marcada como atrasada', () => {
    const recente: Lembrete = { ...dose, id: 'dose|x|2026-10-28T19:40', quando: '2026-10-28T19:40' };
    const limite: Lembrete = { ...dose, id: 'dose|y|2026-10-28T19:30', quando: '2026-10-28T19:30' };
    const velha: Lembrete = { ...dose, id: 'dose|z|2026-10-28T19:29', quando: '2026-10-28T19:29' };
    const r = paraAgendar([recente, limite, velha, dose], agora);
    expect(r.map((a) => a.extra.id)).toEqual([recente.id, limite.id, dose.id]);
    expect(r[0].atrasado).toBe(true);
    expect(r[0].em.getTime()).toBeGreaterThan(agora.getTime());
    expect(r[0].em.getTime() - agora.getTime()).toBeLessThanOrEqual(10_000);
    expect(r[0].actionTypeId).toBe('dose');
    expect(r[2].atrasado).toBeUndefined();
  });
  it('com "esconder", só a dose mantém o texto; consulta, vacina e prevenção ficam genéricas', () => {
    const vacina: Lembrete = { id: 'vacina|v1', quando: '2026-10-29T09:00', titulo: 'Vacina do Thor: V10 hoje', corpo: 'Reforço · Dra. Ana', acoes: false };
    const prev: Lembrete = { id: 'prevencao|p1', quando: '2026-10-29T09:00', titulo: 'Antipulgas da Mel hoje', corpo: 'Bravecto', acoes: false };
    const r = paraAgendar([dose, consulta, vacina, prev], agora, true);
    expect(r[0]).toMatchObject({ title: dose.titulo, body: dose.corpo });
    for (const a of r.slice(1)) expect(a).toMatchObject({ title: TITULO_GENERICO, body: CORPO_GENERICO });
    // Desligado: texto original.
    expect(paraAgendar([consulta], agora, false)[0]).toMatchObject({ title: 'Consulta amanhã', body: 'Cardiologia' });
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
  it('lê a ação do evento ou da Intent de abertura (LembretePlugin)', () => {
    const notif = { title: 'Hora do remédio', body: 'Losartana', extra: { id: dose.id } };
    expect(lerAcaoPlugin({ actionId: 'tomei', notification: notif })).toEqual({ acao: 'tomada', id: dose.id, titulo: 'Hora do remédio', corpo: 'Losartana' });
    expect(lerAcaoPlugin({ actionId: 'pular', notification: { extra: { id: dose.id } } })).toEqual({ acao: 'pulada', id: dose.id, titulo: '', corpo: '' });
    // Sem ação pendente, toque no corpo, sem id ou resposta estranha: nada.
    expect(lerAcaoPlugin({})).toBeNull();
    expect(lerAcaoPlugin(null)).toBeNull();
    expect(lerAcaoPlugin('x')).toBeNull();
    expect(lerAcaoPlugin({ actionId: 'tap', notification: notif })).toBeNull();
    expect(lerAcaoPlugin({ actionId: 'tomei', notification: null })).toBeNull();
    expect(lerAcaoPlugin({ actionId: 'tomei', notification: { extra: { id: 7 } } })).toBeNull();
  });
  it('lê a dose do id, inclusive adiado', () => {
    expect(parteDose(dose.id + '|adiado')).toEqual({ remedioId: 'losartana', previstoPara: '2026-10-28T21:00' });
    expect(parteDose(consulta.id)).toBeNull();
  });
  it('ao reagendar, fica o adiamento e o atrasado já avisado, enquanto a dose está sem registro', () => {
    const avisados = new Set([dose.id]);
    expect(pendenteFica(dose.id, [], avisados)).toBe(true);
    expect(pendenteFica(dose.id, [], new Set())).toBe(false);
    expect(pendenteFica(dose.id + '|adiado', [], new Set())).toBe(true);
    expect(pendenteFica(dose.id, [{ remedioId: 'losartana', previstoPara: '2026-10-28T21:00' } as never], avisados)).toBe(false);
    expect(pendenteFica(consulta.id, [], new Set([consulta.id]))).toBe(false);
    expect(pendenteFica(undefined, [], avisados)).toBe(false);
  });
  it('adiamento só vale com a dose sem registro', () => {
    const id = dose.id + '|adiado';
    expect(adiadoVale(id, [])).toBe(true);
    expect(adiadoVale(id, [{ remedioId: 'losartana', previstoPara: '2026-10-28T21:00' } as never])).toBe(false);
    expect(adiadoVale(dose.id, [])).toBe(false);
    expect(adiadoVale(undefined, [])).toBe(false);
  });
});
