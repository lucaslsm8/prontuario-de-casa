// O texto assinado sobrevive a gravar e reler no banco do Rust? Compila o Rust (lento): só com TESTE_RUST=1.
// `TESTE_RUST=1 npx vitest run src/data/idaVolta.test.ts`
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoAssinado } from './assinatura';
import type { Evento } from './persistencia';

const dir = join(process.cwd(), 'src-tauri', 'target');
const ida = join(dir, 'assinatura-ida.json');
const volta = join(dir, 'assinatura-volta.json');

const ev = (id: string, tipo: string, dados: Record<string, unknown>): Evento => ({ id, em: '2026-11-19T21:04:05.123Z', autor: 'helena', aparelho: 'pc-abc123', hlc: '0001795123456789-0003-pc-abc123', tipo, dados });

describe.skipIf(!process.env.TESTE_RUST)('ida e volta pelo Rust', () => {
  it('textoAssinado igual depois de gravar e reler', () => {
    const numeros = [0.1, 0.2, 0.1 + 0.2, 61.8, 89.9, 1 / 3, 2 / 3, 123456.789, 1e-7, 5e-324, 1.7976931348623157e308, 9007199254740993, -0, 1e21, 0.000123456789012345, 72.5, 20.5, 0.5, 1.5, 450, 1640.0, 3.14159265358979];
    const aleatorios = Array.from({ length: 300 }, (_, i) => Math.sin(i + 1) * 10 ** ((i % 9) - 3));
    const evs: Evento[] = [
      ev('e1', 'addRemedio', { remedio: { id: 'r', nome: 'Prednisona 20 mg', dose: '½ comp.', desmame: [{ qtd: 2, dias: 3 }, { qtd: 0.5, dias: 2 }], estoque: 20.5, horarios: ['08:00'], vazio: null, lista: [], z: 1, a: 2 } }),
      ev('e2', 'addDespesa', { despesa: { valor: 89.9, reembolso: 180, prestador: 'Dr. Paulo — “Mendes” \ / ção 😀   fim', nota: 'linha\nnova\ttab' } }),
      ev('e3', 'numeros', { numeros, aleatorios }),
      ev('e4', 'responderPapel', { de: 'roberto', para: 'helena', aceitar: true, por: 'x' }),
    ];
    writeFileSync(ida, JSON.stringify(evs));
    execSync('cargo test --lib ida_e_volta_pelo_banco -- --ignored', { cwd: join(process.cwd(), 'src-tauri'), env: { ...process.env, ASSINATURA_IDA: ida, ASSINATURA_VOLTA: volta }, stdio: 'pipe' });
    const lidos = JSON.parse(readFileSync(volta, 'utf8')) as Evento[];
    expect(lidos.map((e) => e.id)).toEqual(evs.map((e) => e.id));
    lidos.forEach((l, i) => expect(textoAssinado(l)).toBe(textoAssinado(evs[i])));
  }, 300_000);
});
