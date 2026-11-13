import { describe, expect, it } from 'vitest';
import { foraDaFaixa, fmtValor, marcadoresDaPessoa, montarResultado, qtdForaDaFaixa, serieMarcador, textoForaDaFaixa } from './resultados';
import { compararAgenda, gerarIcs, idDaAgenda, lerIcs } from './ics';
import { buscar, linhaDoTempo } from './busca';
import { estadoExemplo } from './store';
import type { Consulta, Exame } from './types';
import { dataDoRelease, lerNotas } from './atualizacao';

const ex = (id: string, data: string, resultados: Exame['resultados']): Exame =>
  ({ id, pessoaId: 'ana', nome: 'Perfil lipídico', categoria: 'Sangue', dataColeta: data, laboratorio: 'Lab', arquivo: 'PDF', paginas: 1, resultados }) as Exame;

describe('valores de exame', () => {
  it('formata, monta e marca fora da faixa', () => {
    expect([fmtValor(212), fmtValor(5.9), fmtValor(2.15), fmtValor(210)]).toEqual(['212', '5,9', '2,15', '210']);
    expect(montarResultado('ldl', '138', '')).toEqual({ marcador: 'LDL', valor: 138, unidade: 'mg/dL' });
    expect(montarResultado('Ômega 3', '8,2', '%')).toEqual({ marcador: 'Ômega 3', valor: 8.2, unidade: '%' });
    expect(montarResultado('LDL', 'abc', '')).toBeUndefined();
    expect(foraDaFaixa({ marcador: 'LDL', valor: 138, unidade: 'mg/dL' })).toBe('alto');
    expect(foraDaFaixa({ marcador: 'HDL', valor: 38, unidade: 'mg/dL' })).toBe('baixo');
    expect(foraDaFaixa({ marcador: 'Glicose', valor: 90, unidade: 'mg/dL' })).toBeUndefined();
  });
  it('série do marcador entre exames, em ordem de coleta', () => {
    const exames = [ex('b', '2026-09-01', [{ marcador: 'LDL', valor: 130, unidade: 'mg/dL' }]), ex('a', '2026-03-01', [{ marcador: 'LDL', valor: 160, unidade: 'mg/dL' }, { marcador: 'Xyz', valor: 1, unidade: '' }])];
    expect(serieMarcador(exames, 'ana', 'ldl').map((p) => p.valor)).toEqual([160, 130]);
    expect(marcadoresDaPessoa(exames, 'ana')).toEqual(['LDL', 'Xyz']);
  });
});

describe('.ics', () => {
  const c: Consulta = { id: 'c1', tipo: 'consulta', pessoaId: 'ana', titulo: 'Cardiologista', profissional: 'Dr. Paulo; clínica', local: 'Rua A, 10', data: '2026-11-05', hora: '10:00', duracaoMin: 45, levar: [], lembretes: [] };
  it('gera e lê de volta', () => {
    const txt = gerarIcs([c], () => 'Ana', new Date(Date.UTC(2026, 9, 31, 12, 0)));
    expect(txt).toContain('DTSTART:20261105T100000');
    expect(txt).toContain('DTEND:20261105T104500');
    expect(lerIcs(txt)).toEqual([{ titulo: 'Cardiologista · Ana', data: '2026-11-05', hora: '10:00', local: 'Rua A, 10', descricao: 'Dr. Paulo; clínica', uid: 'c1@arquivo-da-familia' }]);
  });
  it('dia inteiro, TZID e linhas dobradas', () => {
    const txt = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Exame de \r\n sangue\r\nDTSTART;VALUE=DATE:20261201\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Dentista\r\nDTSTART;TZID=America/Sao_Paulo:20261203T143000\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(lerIcs(txt).map((e) => [e.titulo, e.data, e.hora])).toEqual([['Exame de sangue', '2026-12-01', '09:00'], ['Dentista', '2026-12-03', '14:30']]);
  });
});

describe('busca e linha do tempo', () => {
  const s = estadoExemplo();
  const tudo = () => true;
  it('acha por nome, sem acento e por valor de exame', () => {
    expect(buscar(s, 'losartana', tudo).some((a) => a.tipo === 'Remédio')).toBe(true);
    expect(buscar(s, 'lipidico roberto', tudo).some((a) => a.tipo === 'Exame')).toBe(true);
    expect(buscar(s, 'LDL', tudo).find((a) => a.tipo === 'Exame')?.sub).toContain('LDL 138 mg/dL');
    expect(buscar(s, '', tudo)).toEqual([]);
  });
  it('respeita o que não é compartilhado', () => {
    const r = buscar(s, 'losartana', (pid) => pid !== 'roberto');
    expect(r.some((a) => a.tipo === 'Remédio')).toBe(false);
  });
  it('linha do tempo em ordem decrescente', () => {
    const t = linhaDoTempo(s, 'roberto', tudo, '2026-10-28');
    expect(t.length).toBeGreaterThan(5);
    expect(t.every((e, i) => i === 0 || t[i - 1].data >= e.data)).toBe(true);
  });
});

describe('agenda conectada', () => {
  const ev = (uid: string, data: string, hora = '10:00', titulo = 'Dentista') => ({ uid, titulo, data, hora });
  it('novas, alteradas e canceladas (só de hoje em diante)', () => {
    const hoje = '2026-10-31';
    const primeira = compararAgenda([ev('a', '2026-11-05'), ev('b', '2026-11-10', '08:00', 'Coleta de sangue'), ev('velho', '2026-10-01')], [], 'ana', hoje);
    expect(primeira.novas.map((c) => [c.titulo, c.tipo])).toEqual([['Dentista', 'consulta'], ['Coleta de sangue', 'exame']]);
    const consultas = primeira.novas;
    const segunda = compararAgenda([ev('a', '2026-11-05', '11:30')], consultas, 'ana', hoje);
    expect(segunda.novas).toEqual([]);
    expect(segunda.alteradas).toEqual([{ id: idDaAgenda('a', ev('a', '2026-11-05')), patch: { hora: '11:30' } }]);
    expect(segunda.removidas.map((c) => c.titulo)).toEqual(['Coleta de sangue']);
  });
});

describe('atualização', () => {
  it('notas do release viram lista e a data vira DD/MM/AAAA', () => {
    expect(lerNotas('## Novidades\n- Álbum de fotos dos pets\n* Central 0800 certa\n\n')).toEqual(['Álbum de fotos dos pets', 'Central 0800 certa']);
    expect(lerNotas(undefined)).toEqual([]);
    expect(dataDoRelease('2026-11-02T13:00:00Z')).toBe('02/11/2026');
    expect(dataDoRelease('2026-11-02 13:00:00.0 +00:00:00')).toBe('02/11/2026');
    expect(dataDoRelease(undefined)).toBe('');
  });
});

describe('valores fora da faixa na lista', () => {
  it('conta e escreve', () => {
    const e = { resultados: [{ marcador: 'LDL', valor: 138, unidade: 'mg/dL' }, { marcador: 'HDL', valor: 38, unidade: 'mg/dL' }, { marcador: 'HDL', valor: 60, unidade: 'mg/dL' }] };
    expect(qtdForaDaFaixa(e)).toBe(2);
    expect(qtdForaDaFaixa({})).toBe(0);
    expect(textoForaDaFaixa(1)).toBe('1 valor fora da faixa');
    expect(textoForaDaFaixa(2)).toBe('2 valores fora da faixa');
    expect(textoForaDaFaixa(0)).toBe('');
  });
});
