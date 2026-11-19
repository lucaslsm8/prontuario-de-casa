import { describe, expect, it } from 'vitest';
import { avisoReceita, comDoseDoDia, diasCobertos, etapaNoDia, fimDoDesmame, qtdNoDia, resumoDias, textoDesmame, textoDias, tomaNoDia } from './frequencia';
import { diasDoModo, modoDosDias } from './formularios';
import { proximosLembretes } from './lembretes';
import type { State } from './store';
import type { Remedio } from './types';

const base: Remedio = {
  id: 'r', pessoaId: 'helena', nome: 'Prednisona 20 mg', dose: '2 comp.', doseLonga: '2 comprimidos', unidade: 'comprimidos',
  horarios: ['08:00'], continuo: true, inicio: '2026-11-02', estoque: 30, avisarDias: 3, lembrete: true, ativo: true,
};
// 02/11/2026 é segunda-feira.

describe('tomaNoDia', () => {
  it('todo dia, respeitando início e fim', () => {
    expect(tomaNoDia(base, '2026-11-01')).toBe(false);
    expect(tomaNoDia(base, '2026-11-05')).toBe(true);
    expect(tomaNoDia({ ...base, fim: '2026-11-04' }, '2026-11-05')).toBe(false);
    expect(tomaNoDia({ ...base, fim: '2026-11-04' }, '2026-11-05', { ignorarFim: true })).toBe(true);
  });
  it('dias da semana', () => {
    const r = { ...base, dias: { semana: [1, 3, 5] } };
    expect(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06', '2026-11-08'].map((d) => tomaNoDia(r, d))).toEqual([true, false, true, true, false]);
  });
  it('dia sim, dia não e semanal contam do início', () => {
    const alt = { ...base, dias: { cada: 2 } };
    expect(['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => tomaNoDia(alt, d))).toEqual([true, false, true]);
    const sem = { ...base, dias: { cada: 7 } };
    expect(tomaNoDia(sem, '2026-11-09')).toBe(true);
    expect(tomaNoDia(sem, '2026-11-10')).toBe(false);
  });
});

describe('desmame', () => {
  const r: Remedio = { ...base, desmame: [{ qtd: 2, dias: 3 }, { qtd: 1, dias: 3 }, { qtd: 0.5, dias: 2 }], fim: '2026-11-09' };
  it('etapa e dose de cada dia', () => {
    expect(etapaNoDia(r, '2026-11-02')).toBe(0);
    expect(etapaNoDia(r, '2026-11-05')).toBe(1);
    expect(etapaNoDia(r, '2026-11-09')).toBe(2);
    expect(etapaNoDia(r, '2026-11-10')).toBeUndefined();
    expect(qtdNoDia(r, '2026-11-08')).toBe(0.5);
    expect(comDoseDoDia(r, '2026-11-05').doseLonga).toBe('1 comprimido');
    expect(comDoseDoDia(r, '2026-11-09').dose).toBe('½ comp.');
  });
  it('fim e textos', () => {
    expect(fimDoDesmame('2026-11-02', r.desmame!)).toBe('2026-11-09');
    expect(textoDesmame(r)).toBe('2 comp. por 3 dias, depois 1 comp. por 3 dias, depois ½ comp. por 2 dias');
    expect(resumoDias(r)).toBe('desmame (2 → 1 → ½ comp.)');
  });
  it('estoque: para no fim do desmame', () => {
    // 2+2+2+1+1+1+½+½ = 10 comprimidos no desmame todo.
    expect(diasCobertos({ ...r, estoque: 10 }, '2026-11-02', 1)).toBe(730);
    expect(diasCobertos({ ...r, estoque: 6 }, '2026-11-02', 1)).toBe(3);
  });
});

describe('textos e estoque', () => {
  it('textoDias', () => {
    expect(textoDias({ dias: { semana: [1, 3, 5] } })).toBe('segunda, quarta e sexta');
    expect(textoDias({ dias: { semana: [1, 2, 3, 4, 5] } })).toBe('de segunda a sexta');
    expect(textoDias({ dias: { semana: [0, 2, 4, 6] } })).toBe('dom, ter, qui e sáb');
    expect(textoDias({ dias: { semana: [2] } })).toBe('toda terça');
    expect(textoDias({ dias: { cada: 2 } })).toBe('dia sim, dia não');
    expect(textoDias({ dias: { cada: 7 }, inicio: '2026-11-07' })).toBe('todo sábado');
    expect(textoDias({ dias: { cada: 3 } })).toBe('a cada 3 dias');
    expect(textoDias({})).toBe('');
  });
  it('dia sim, dia não dura o dobro', () => {
    expect(diasCobertos({ ...base, dose: '1 comp.', doseLonga: '1 comprimido', estoque: 5, dias: { cada: 2 } }, '2026-11-02', 1)).toBe(10);
  });
  it('validade da receita', () => {
    expect(avisoReceita({ receitaValidade: '2026-11-30' }, '2026-11-20')).toBe('');
    expect(avisoReceita({ receitaValidade: '2026-11-25' }, '2026-11-20')).toBe('Receita vence em 5 dias');
    expect(avisoReceita({ receitaValidade: '2026-11-21' }, '2026-11-20')).toBe('Receita vence amanhã');
    expect(avisoReceita({ receitaValidade: '2026-11-17' }, '2026-11-20')).toBe('Receita vencida há 3 dias');
  });
});

describe('formulário', () => {
  it('modo ↔ dias', () => {
    expect(diasDoModo('todo', [], '')).toBeUndefined();
    expect(diasDoModo('semana', [], '')).toBeNull();
    expect(diasDoModo('semana', [0, 1, 2, 3, 4, 5, 6], '')).toBeUndefined();
    expect(diasDoModo('semana', [5, 1], '')).toEqual({ semana: [1, 5] });
    expect(diasDoModo('cada', [], '1')).toBeNull();
    expect(diasDoModo('cada', [], '10')).toEqual({ cada: 10 });
    expect(modoDosDias({ cada: 2 })).toBe('alternado');
    expect(modoDosDias({ cada: 7 })).toBe('semanal');
    expect(modoDosDias({ semana: [1] })).toBe('semana');
  });
});

describe('lembretes', () => {
  it('sem lembrete de dose nos dias em que não toma; receita avisa 7 dias antes', () => {
    const r: Remedio = { ...base, id: 'novo', dias: { semana: [1] }, receitaValidade: '2026-11-27' };
    const st = {
      pessoas: [{ id: 'helena', nome: 'Helena', curto: 'Helena', sexo: 'Feminino', cor: '#ccc', alergias: [], condicoes: [] }],
      remedios: [r], doses: [], consultas: [], exames: [], planos: [], vacinas: [], prevencoes: [], sintomas: [], procedimentos: [], pesagens: [], medicoes: [], anexos: [], compartilhamentos: [], papeis: [], aparelhos: [],
      config: { esconderNomeNotif: true }, bloqueado: false, temSenha: false,
    } as unknown as State;
    // 19/11/2026 é quinta: nenhuma dose; a receita vence em 27/11, aviso em 20/11 às 09:00.
    const l = proximosLembretes(st, new Date(2026, 10, 19, 12, 0), 24);
    expect(l.filter((x) => x.id.startsWith('dose|'))).toEqual([]);
    expect(l.map((x) => x.id)).toContain('receita|novo|2026-11-20');
  });
});
