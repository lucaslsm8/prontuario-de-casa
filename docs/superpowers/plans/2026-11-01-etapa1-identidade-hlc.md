# Etapa 1: identidade local e HLC — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o log de eventos para a sincronização: cada aparelho passa a ter identidade própria (`aparelhoId` + "quem sou eu"), e cada evento passa a ter `aparelho` e um relógio lógico híbrido (`hlc`), com o estado projetado na ordem do HLC. Nada muda na tela.

**Architecture:**
- **Funções puras** em `src/data/hlc.ts` (relógio) e `src/data/log.ts` (migração do log antigo, ordem, identidade).
- **"Quem sou eu"** fica no `kv` cifrado do Rust (chave `identidade`) e vem no `iniciar`.
- **No store:** o `souEu` de cada pessoa é recalculado a partir da identidade depois da projeção. Os componentes continuam lendo `p.souEu` sem mudança.
- **Eventos antigos** recebem HLC de forma determinística a cada carga, sem reescrever o banco.

**Tech Stack:** TypeScript (React 18, vitest), Rust (Tauri 2, rusqlite).

Spec: [`docs/superpowers/specs/2026-10-31-android-sincronizacao-design.md`](../specs/2026-10-31-android-sincronizacao-design.md), seção 1 ("Quem sou eu" é do aparelho) e seção 2 (Evento).

## Global Constraints

- O log é só de adição: nenhum evento é alterado ou apagado no banco.
- Nunca gravar dados de saúde em claro. A identidade vai no `kv` cifrado (`Banco::kv_set`).
- Comandos Tauri `async`, argumentos em uma palavra, respostas em camelCase.
- Formato do HLC: `"<ms com 13 dígitos>-<contador com 4 dígitos>-<aparelhoId>"`. Por exemplo, `"1793480000000-0000-pc-3f9a1c"`. Ordenar a string ordena os eventos.
- `aparelhoId`: `"<pc|cel|web>-<6 hex>"`.
- Textos de interface: nenhum texto novo nesta etapa.
- Rodar `npm run build` depois de mudar TypeScript, e `cd src-tauri && cargo test` depois de mudar Rust.
- **Dados reais:** `npm run app:dev` usa o banco de verdade do usuário, em `%APPDATA%\br.familia.arquivosaude`. Antes da verificação manual, faça um backup em Privacidade e backup.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/data/hlc.ts` | **novo**: tipo `Hlc`, `fmtHlc`, `lerHlc`, `proximoHlc` |
| `src/data/hlc.test.ts` | **novo** |
| `src/data/log.ts` | **novo**: `Identidade`, `novoAparelhoId`, `migrarLog`, `ordenarLog`, `ultimoHlc`, `resolverEu` |
| `src/data/log.test.ts` | **novo** |
| `src/data/persistencia.ts` | `Evento` ganha `aparelho?`/`hlc?`; `Inicio.identidade`; `definirIdentidade()` (Tauri e memória) |
| `src-tauri/src/lib.rs` | `Inicio.identidade`; comando `definir_identidade` |
| `src/data/store.tsx` | `projetar` ordena por HLC e aceita `euId`; `marcarEu`; `abrirLog`; `emitir` carimba `aparelho` + `hlc`; `addPessoa` grava a identidade |
| `docs/ARQUITETURA.md` | marca a pendência do `souEu` como resolvida |

---

### Task 1: Relógio lógico híbrido (puro)

**Files:**
- Create: `src/data/hlc.ts`
- Test: `src/data/hlc.test.ts`

**Interfaces:**
- Produces:
  - `interface Hlc { ms: number; c: number; aparelho: string }`
  - `fmtHlc(h: Hlc): string`
  - `lerHlc(s: string): Hlc`
  - `proximoHlc(ultimo: Hlc | null, agora: number, aparelho: string): Hlc`

- [ ] **Step 1: Write the failing test**

`src/data/hlc.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fmtHlc, lerHlc, proximoHlc } from './hlc';

describe('HLC', () => {
  it('formata com zeros à esquerda e lê de volta (aparelho com hífen)', () => {
    const h = { ms: 1793480000000, c: 7, aparelho: 'pc-3f9a1c' };
    expect(fmtHlc(h)).toBe('1793480000000-0007-pc-3f9a1c');
    expect(lerHlc('1793480000000-0007-pc-3f9a1c')).toEqual(h);
  });
  it('avança com o relógio e conta dentro do mesmo milissegundo', () => {
    const a = proximoHlc(null, 1000, 'pc-a');
    expect(a).toEqual({ ms: 1000, c: 0, aparelho: 'pc-a' });
    expect(proximoHlc(a, 1000, 'pc-a')).toEqual({ ms: 1000, c: 1, aparelho: 'pc-a' });
    expect(proximoHlc(a, 2000, 'pc-a')).toEqual({ ms: 2000, c: 0, aparelho: 'pc-a' });
  });
  it('nunca volta quando o relógio do aparelho atrasa', () => {
    const a = { ms: 5000, c: 3, aparelho: 'pc-a' };
    expect(proximoHlc(a, 4000, 'pc-a')).toEqual({ ms: 5000, c: 4, aparelho: 'pc-a' });
  });
  it('a ordem das strings é a ordem dos eventos', () => {
    const s = [fmtHlc({ ms: 20, c: 0, aparelho: 'b' }), fmtHlc({ ms: 3, c: 9, aparelho: 'a' }), fmtHlc({ ms: 20, c: 0, aparelho: 'a' })];
    expect([...s].sort()).toEqual(['0000000000003-0009-a', '0000000000020-0000-a', '0000000000020-0000-b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/hlc.test.ts`
Expected: FAIL with "Failed to resolve import "./hlc"".

- [ ] **Step 3: Write minimal implementation**

`src/data/hlc.ts`:
```ts
// Relógio lógico híbrido (HLC): hora do aparelho + contador, para ordenar eventos de vários aparelhos.
// Formato em texto "<ms 13 dígitos>-<contador 4 dígitos>-<aparelhoId>": ordenar a string ordena os eventos.

export interface Hlc { ms: number; c: number; aparelho: string }

export const fmtHlc = (h: Hlc) => `${String(h.ms).padStart(13, '0')}-${String(h.c).padStart(4, '0')}-${h.aparelho}`;

export function lerHlc(s: string): Hlc {
  const [ms, c, ...aparelho] = s.split('-');
  return { ms: Number(ms), c: Number(c), aparelho: aparelho.join('-') };
}

/** Próximo carimbo local: nunca volta, mesmo se o relógio do aparelho atrasar. */
export function proximoHlc(ultimo: Hlc | null, agora: number, aparelho: string): Hlc {
  if (!ultimo || agora > ultimo.ms) return { ms: agora, c: 0, aparelho };
  return { ms: ultimo.ms, c: ultimo.c + 1, aparelho };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/hlc.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/hlc.ts src/data/hlc.test.ts
git commit -m "Sincronização: relógio lógico híbrido (HLC)"
```

---

### Task 2: Log migrado, ordem e identidade (puro)

**Files:**
- Create: `src/data/log.ts`
- Modify: `src/data/persistencia.ts:8-14` (interface `Evento`)
- Test: `src/data/log.test.ts`

**Interfaces:**
- Consumes: `Hlc`, `fmtHlc`, `lerHlc`, `proximoHlc` (Task 1).
- Produces:
  - `interface Identidade { aparelhoId: string; pessoaId: string | null }`
  - `novoAparelhoId(plataforma: 'pc' | 'cel' | 'web', aleatorio?: () => number): string`
  - `migrarLog(eventos: Evento[], aparelhoId: string): Evento[]`
  - `ordenarLog(eventos: Evento[]): Evento[]`
  - `ultimoHlc(eventos: Evento[]): Hlc | null`
  - `resolverEu(pessoas: Pessoa[], identidade: Identidade | null): string | null`
  - `Evento` com `aparelho?: string` e `hlc?: string`

- [ ] **Step 1: Add the fields to `Evento`**

Em `src/data/persistencia.ts`, troque a interface `Evento` por:
```ts
export interface Evento {
  id: string;
  em: string;              // ISO, hora em que aconteceu
  autor?: string;          // pessoa que fez a mudança
  aparelho?: string;       // aparelhoId de quem criou o evento
  hlc?: string;            // relógio lógico híbrido (src/data/hlc.ts); ordena o log
  tipo: string;
  dados: Record<string, unknown>;
}
```

- [ ] **Step 2: Write the failing test**

`src/data/log.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { migrarLog, novoAparelhoId, ordenarLog, resolverEu, ultimoHlc } from './log';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

const ev = (id: string, em: string, extra: Partial<Evento> = {}): Evento => ({ id, em, tipo: 'x', dados: {}, ...extra });
const pessoa = (id: string, souEu?: boolean): Pessoa => ({ id, nome: id, curto: id, cor: '#ccc', alergias: [], condicoes: [], souEu });

describe('log', () => {
  it('novoAparelhoId: plataforma + 6 hex', () => {
    expect(novoAparelhoId('pc', () => 0)).toBe('pc-000000');
    expect(novoAparelhoId('cel', () => 0.999999)).toMatch(/^cel-[0-9a-f]{6}$/);
  });

  it('migrarLog dá HLC na ordem original, mesmo com hora fora de ordem, e é determinístico', () => {
    const antigos = [ev('a', '2026-10-30T10:00:00.000Z'), ev('b', '2026-10-30T09:00:00.000Z'), ev('c', '2026-10-30T10:00:00.000Z')];
    const m = migrarLog(antigos, 'pc-aaaaaa');
    expect(m.map((e) => e.aparelho)).toEqual(['pc-aaaaaa', 'pc-aaaaaa', 'pc-aaaaaa']);
    const ms = Date.parse('2026-10-30T10:00:00.000Z');
    expect(m.map((e) => e.hlc)).toEqual([`${ms}-0000-pc-aaaaaa`, `${ms}-0001-pc-aaaaaa`, `${ms}-0002-pc-aaaaaa`]);
    expect(migrarLog(antigos, 'pc-aaaaaa')).toEqual(m);
    expect(antigos[0].hlc).toBeUndefined(); // não altera o original
  });

  it('migrarLog mantém o HLC de quem já tem e continua depois dele', () => {
    const m = migrarLog([ev('a', '2026-10-30T10:00:00.000Z', { hlc: '9999999999999-0000-cel-bbbbbb', aparelho: 'cel-bbbbbb' }), ev('b', '2026-10-30T11:00:00.000Z')], 'pc-aaaaaa');
    expect(m[0].hlc).toBe('9999999999999-0000-cel-bbbbbb');
    expect(m[1].hlc).toBe('9999999999999-0001-pc-aaaaaa');
  });

  it('ordenarLog ordena por HLC, sem HLC fica na ordem em que veio', () => {
    expect(ordenarLog([ev('b', '', { hlc: '0000000000002-0000-x' }), ev('a', '', { hlc: '0000000000001-0000-x' })]).map((e) => e.id)).toEqual(['a', 'b']);
    expect(ordenarLog([ev('b', ''), ev('a', '')]).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('ultimoHlc é o maior carimbo do log', () => {
    expect(ultimoHlc([])).toBeNull();
    expect(ultimoHlc([ev('a', '', { hlc: '0000000000005-0001-pc-a' }), ev('b', '', { hlc: '0000000000005-0000-pc-a' })])).toEqual({ ms: 5, c: 1, aparelho: 'pc-a' });
  });

  it('resolverEu: identidade salva se a pessoa existe; senão, o souEu antigo do log', () => {
    const ps = [pessoa('ana', true), pessoa('bia')];
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'bia' })).toBe('bia');
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'sumiu' })).toBe('ana');
    expect(resolverEu(ps, null)).toBe('ana');
    expect(resolverEu([pessoa('bia')], null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/data/log.test.ts`
Expected: FAIL with "Failed to resolve import "./log"".

- [ ] **Step 4: Write minimal implementation**

`src/data/log.ts`:
```ts
// Log de eventos para a sincronização: HLC nos eventos antigos, ordem e "quem sou eu" deste aparelho.
// Tudo puro (testado em log.test.ts). O banco nunca é reescrito: a migração é refeita a cada carga, sempre igual.

import { fmtHlc, lerHlc, proximoHlc, type Hlc } from './hlc';
import type { Evento } from './persistencia';
import type { Pessoa } from './types';

/** Fica no kv cifrado do aparelho (chave "identidade"); não vai para o log. */
export interface Identidade { aparelhoId: string; pessoaId: string | null }

export function novoAparelhoId(plataforma: 'pc' | 'cel' | 'web', aleatorio: () => number = Math.random) {
  return `${plataforma}-${Math.floor(aleatorio() * 0x1000000).toString(16).padStart(6, '0').slice(0, 6)}`;
}

const maior = (a: Hlc | null, b: Hlc) => (!a || fmtHlc(b) > fmtHlc(a) ? b : a);

/** Dá `aparelho` e `hlc` a quem não tem, na ordem em que está, a partir de `em`. Não altera os originais. */
export function migrarLog(eventos: Evento[], aparelhoId: string): Evento[] {
  let ultimo: Hlc | null = null;
  return eventos.map((ev) => {
    if (ev.hlc) {
      ultimo = maior(ultimo, lerHlc(ev.hlc));
      return ev;
    }
    const ms = Date.parse(ev.em);
    const h = proximoHlc(ultimo, Number.isNaN(ms) ? 0 : ms, aparelhoId);
    ultimo = h;
    return { ...ev, aparelho: ev.aparelho ?? aparelhoId, hlc: fmtHlc(h) };
  });
}

/** Ordem de aplicação: por HLC. Eventos sem HLC (testes, navegador) mantêm a ordem em que vieram. */
export const ordenarLog = (eventos: Evento[]) => [...eventos].sort((a, b) => ((a.hlc ?? '') < (b.hlc ?? '') ? -1 : (a.hlc ?? '') > (b.hlc ?? '') ? 1 : 0));

export const ultimoHlc = (eventos: Evento[]): Hlc | null => eventos.reduce<Hlc | null>((u, e) => (e.hlc ? maior(u, lerHlc(e.hlc)) : u), null);

/** "Eu" neste aparelho: a identidade salva, se a pessoa existe; senão, quem o log antigo marcou como souEu. */
export function resolverEu(pessoas: Pessoa[], identidade: Identidade | null): string | null {
  if (identidade?.pessoaId && pessoas.some((p) => p.id === identidade.pessoaId)) return identidade.pessoaId;
  return pessoas.find((p) => p.souEu)?.id ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/log.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/log.ts src/data/log.test.ts src/data/persistencia.ts
git commit -m "Sincronização: migração do log, ordem por HLC e identidade"
```

---

### Task 3: Identidade guardada no aparelho (Rust + persistência)

**Files:**
- Modify: `src-tauri/src/lib.rs` (struct `Inicio`, comando `iniciar`, novo comando, `generate_handler!`)
- Modify: `src/data/persistencia.ts` (interfaces `Inicio` e `Persistencia`, `tauri()` e `memoria()`)

**Interfaces:**
- Consumes: `Identidade` (Task 2).
- Produces:
  - `Inicio.identidade?: Identidade | null`
  - `persistencia.definirIdentidade(identidade: Identidade): Promise<void>`
  - comando Tauri `definir_identidade { identidade }`

- [ ] **Step 1: Rust — devolver e gravar a identidade**

Em `src-tauri/src/lib.rs`, na struct `Inicio`, depois de `versao: String,`:
```rust
    /// "Quem sou eu" neste aparelho ({ aparelhoId, pessoaId }), no kv cifrado. Fora do log.
    identidade: Option<Value>,
```
No comando `iniciar`, no retorno de erro, acrescente `identidade: None`:
```rust
        return Ok(Inicio { eventos: vec![], tem_senha: false, backup: InfoBackup::vazio(&st), erro: Some(erro), versao, identidade: None });
```
E no retorno normal, depois de `versao,`:
```rust
            identidade: b.kv_get("identidade")?,
```
Logo depois do comando `gravar_evento`, acrescente:
```rust
#[tauri::command]
async fn definir_identidade(st: State<'_, Estado>, identidade: Value) -> R<()> {
    com_banco(&st, |b| b.kv_set("identidade", &identidade))
}
```
No `generate_handler!`, depois de `gravar_evento,`, acrescente `definir_identidade,`.

- [ ] **Step 2: Run the Rust tests**

Run: `cd src-tauri && cargo test`
Expected: `test result: ok. 14 passed`. O `kv_get`/`kv_set` cifrado já é coberto por `grava_le_e_nada_fica_em_claro`.

- [ ] **Step 3: Front — interface e as duas implementações**

Em `src/data/persistencia.ts`:

1. Import no topo:
```ts
import type { Identidade } from './log';
```
2. Em `interface Inicio`, depois de `versao: string;`:
```ts
  /** null/ausente: aparelho que nunca guardou identidade (instalação nova ou versão antiga). */
  identidade?: Identidade | null;
```
3. Em `interface Persistencia`, depois de `gravar(ev: Evento): Promise<void>;`:
```ts
  /** Guarda "quem sou eu" deste aparelho (kv cifrado, fora do log). */
  definirIdentidade(identidade: Identidade): Promise<void>;
```
4. Em `tauri()`, depois de `gravar: ...`:
```ts
    definirIdentidade: (identidade) => call('definir_identidade', { identidade }),
```
5. Em `memoria()`:
   - o tipo passa a ser `type Dev = { eventos: Evento[]; senha?: string; identidade?: Identidade; backup: InfoBackup; copia?: { eventos: Evento[]; senha: string } };`;
   - o `iniciar` passa a devolver também `identidade: d.identidade ?? null`:
```ts
    iniciar: async () => ({ eventos: d.eventos, temSenha: !!d.senha, backup: d.backup, versao: '0.3.0-dev', identidade: d.identidade ?? null }),
```
   - e, depois de `gravar`:
```ts
    definirIdentidade: async (i) => { d.identidade = i; salvar(); },
```
   - `apagarTudo` já recria `d` com `vazio()`, que não tem identidade, como no app instalado, onde o banco é apagado.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: sem saída (nenhum erro).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src/data/persistencia.ts
git commit -m "Sincronização: identidade do aparelho no kv cifrado"
```

---

### Task 4: Store projeta pelo HLC e carimba os eventos novos

**Files:**
- Modify: `src/data/store.tsx` (imports, `projetar`, novo `marcarEu`, novo `abrirLog`, `emitir`, `addPessoa`, `recarregar`, efeito de abertura)
- Test: `src/data/log.test.ts` (acrescenta casos de projeção)

**Interfaces:**
- Consumes:
  - de Task 1: `fmtHlc`, `proximoHlc`, `Hlc`;
  - de Task 2: `Identidade`, `migrarLog`, `ordenarLog`, `ultimoHlc`, `resolverEu`, `novoAparelhoId`;
  - de Task 3: `persistencia.definirIdentidade`, `Inicio.identidade`.
- Produces:
  - `projetar(eventos: Evento[], euId?: string | null): State`, que ordena por HLC e, com `euId`, marca `souEu` só nessa pessoa;
  - `marcarEu(s: State, euId: string | null): State`;
  - `abrirLog(ini: Inicio): Promise<State>`, usado pela abertura e pelo `recarregar`.

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `src/data/log.test.ts`:
```ts
import { projetar } from './store';

describe('projeção pelo HLC', () => {
  const add = (id: string, hlc: string, souEu?: boolean): Evento => ({ id: `e-${id}`, em: '', hlc, tipo: 'addPessoa', dados: { pessoa: pessoa(id, souEu) } });
  const editar = (id: string, curto: string, hlc: string): Evento => ({ id: `ed-${curto}`, em: '', hlc, tipo: 'editarPessoa', dados: { pessoaId: id, patch: { curto } } });

  it('aplica na ordem do HLC, não na ordem em que os eventos chegaram', () => {
    const s = projetar([editar('ana', 'Depois', '0000000000003-0000-cel-b'), add('ana', '0000000000001-0000-pc-a'), editar('ana', 'Antes', '0000000000002-0000-pc-a')]);
    expect(s.pessoas[0].curto).toBe('Depois');
  });

  it('com euId, "souEu" vem da identidade do aparelho, não do evento', () => {
    const log = [add('ana', '0000000000001-0000-pc-a', true), add('bia', '0000000000002-0000-cel-b', true)];
    expect(projetar(log, 'bia').pessoas.map((p) => [p.id, !!p.souEu])).toEqual([['ana', false], ['bia', true]]);
    expect(projetar(log, null).pessoas.some((p) => p.souEu)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/log.test.ts`
Expected: FAIL. O primeiro caso dá `"Antes"`, porque hoje a projeção segue a ordem de chegada. O segundo dá `[['ana', true], ['bia', true]]`.

- [ ] **Step 3: Implement in `src/data/store.tsx`**

1. **Imports**, junto dos outros de `./`:
```ts
import { fmtHlc, proximoHlc, type Hlc } from './hlc';
import { migrarLog, novoAparelhoId, ordenarLog, resolverEu, ultimoHlc, type Identidade } from './log';
```
   No import de `./tempo`, acrescente `EM_TAURI`:
```ts
import { EM_TAURI, HOJE, MODO_EXEMPLO, MODO_REAL, horaAgora } from './tempo';
```
   Troque o import de tipos de `./persistencia` para incluir `Inicio`, se ainda não incluir:
```ts
import { novoId, persistencia, type Evento, type InfoBackup, type Inicio } from './persistencia';
```
   Para conferir a linha atual: `grep -n "from './persistencia'" src/data/store.tsx`.

2. **Substitua `projetar`** e acrescente `marcarEu`, `sessao`, `plataforma` e `abrirLog` logo abaixo:
```ts
/** Reconstrói o estado aplicando o log na ordem do HLC. Com `euId`, "souEu" passa a ser só essa pessoa. */
export function projetar(eventos: Evento[], euId?: string | null): State {
  const s = ordenarLog(eventos).reduce((acc, ev) => {
    try { return reducer(acc, paraAcao(ev)); } catch { return acc; }
  }, estadoBase());
  return euId === undefined ? s : marcarEu(s, euId);
}

/** "souEu" é deste aparelho (identidade local), não do evento que criou a pessoa. */
export function marcarEu(s: State, euId: string | null): State {
  return { ...s, pessoas: s.pessoas.map((p) => ({ ...p, souEu: p.id === euId || undefined })) };
}

/** Identidade e último carimbo deste aparelho na sessão (só no modo real). */
const sessao: { identidade: Identidade | null; ultimo: Hlc | null } = { identidade: null, ultimo: null };

const plataforma = (): 'pc' | 'cel' | 'web' => (!EM_TAURI ? 'web' : /Android/i.test(navigator.userAgent) ? 'cel' : 'pc');

/** Abre o log lido do banco: dá HLC aos eventos antigos, resolve "eu" e guarda a identidade se mudou. */
async function abrirLog(ini: Inicio): Promise<State> {
  const aparelhoId = ini.identidade?.aparelhoId ?? novoAparelhoId(plataforma());
  const eventos = migrarLog(ini.eventos, aparelhoId);
  const bruto = projetar(eventos);
  const pessoaId = resolverEu(bruto.pessoas, ini.identidade ?? null);
  const identidade: Identidade = { aparelhoId, pessoaId };
  if (ini.identidade?.aparelhoId !== aparelhoId || ini.identidade?.pessoaId !== pessoaId) await persistencia.definirIdentidade(identidade);
  sessao.identidade = identidade;
  sessao.ultimo = ultimoHlc(eventos);
  return marcarEu(bruto, pessoaId);
}
```

3. **`emitir`**: carimbe aparelho e HLC. Troque a linha que cria `ev` por:
```ts
      const h = proximoHlc(sessao.ultimo, Date.now(), sessao.identidade?.aparelhoId ?? 'web-000000');
      sessao.ultimo = h;
      const ev: Evento = { id: novoId(), em: new Date().toISOString(), autor: autor(), aparelho: h.aparelho, hlc: fmtHlc(h), tipo: type, dados };
```

4. **`recarregar`**: troque `const s = projetar(ini.eventos);` por `const s = await abrirLog(ini);`. O resto continua igual.

5. **`addPessoa`**: quem cria o próprio perfil no primeiro uso vira o "eu" deste aparelho. Troque a linha `addPessoa:` por:
```ts
      addPessoa: (pessoa: Pessoa) => {
        emitir({ type: 'addPessoa', pessoa });
        if (!pessoa.souEu || !MODO_REAL || !sessao.identidade) return;
        sessao.identidade = { ...sessao.identidade, pessoaId: pessoa.id };
        persistencia.definirIdentidade(sessao.identidade).catch((e) => mostrarToast({ texto: `Não foi possível salvar: ${String(e)}` }));
      },
```

6. **Efeito de abertura** (`useEffect` com `persistencia.iniciar()`): troque `const s = projetar(ini.eventos);` por `const s = await abrirLog(ini);`. Logo depois, confira `if (!vivo) return;`, porque `abrirLog` é assíncrono:
```ts
        const s = await abrirLog(ini);
        if (!vivo) return;
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: todos passam: os 196 de antes, mais 4 de HLC e 8 de log.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ built in …`, sem erros de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/data/store.tsx src/data/log.test.ts
git commit -m "Sincronização: estado projetado pelo HLC e eventos carimbados"
```

---

### Task 5: Verificação no navegador e no app, documentação

**Files:**
- Modify: `docs/ARQUITETURA.md` (linha "Pendência para a sincronização")

- [ ] **Step 1: Navegador em modo real**

1. Run: `npm run dev` e abra `http://localhost:1420/?persistir=1`.
2. Faça o primeiro uso: crie você, pule a pessoa e defina a senha. Depois cadastre um remédio.
3. No console do navegador:
```js
const d = JSON.parse(localStorage.getItem('arquivo-dev')); [d.identidade, d.eventos.map(e => [e.tipo, e.aparelho, e.hlc])]
```
Expected:
- `identidade` com `aparelhoId` `web-…` e `pessoaId` igual ao id da pessoa criada;
- todo evento com `aparelho` e `hlc` crescentes.

Recarregue a página: "você" continua sendo a mesma pessoa.

- [ ] **Step 2: App nativo com o banco real**

1. Faça backup em Privacidade e backup.
2. Run: `npm run app:dev`, desbloqueie e confira o Início, as pessoas (com "(você)" na sua) e os remédios, que devem estar iguais a antes.
3. Marque uma dose e desfaça.
4. Feche e abra de novo: os dados continuam lá e o "(você)" na mesma pessoa.

- [ ] **Step 3: Documentação**

Em `docs/ARQUITETURA.md`, troque a linha que começa com `- **Pendência para a sincronização**` por:
```markdown
- **Identidade do aparelho** (feito em 01/11/2026): "quem sou eu" fica no `kv` cifrado (`identidade = { aparelhoId, pessoaId }`), fora do log; o `souEu` dos eventos só vale para logs antigos (`resolverEu`). Cada evento novo leva `aparelho` e `hlc` (relógio lógico híbrido, `src/data/hlc.ts`); eventos antigos recebem HLC na carga, sempre igual (`migrarLog`), sem reescrever o banco. O estado é projetado na ordem do HLC.
```

- [ ] **Step 4: Commit**

```bash
git add docs/ARQUITETURA.md
git commit -m "Etapa 1 da sincronização: identidade e HLC documentados"
```

---

## Próximas etapas

Cada uma vai ter o próprio plano, escrito quando a anterior estiver pronta:

2. Sincronização pelo GitHub.
3. Android básico.
4. Convite por QR.
5. Wi-Fi local e rede de casa sem senha.
6. Lembretes nativos e atualização do APK.
