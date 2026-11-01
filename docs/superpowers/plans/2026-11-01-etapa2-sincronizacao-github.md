# Etapa 2: sincronização pelo GitHub — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aparelhos da mesma família trocam eventos por um repositório **privado** no GitHub, em pacotes cifrados com a chave da família. O desktop ganha:
- o card "Família e aparelhos" em Privacidade e backup: criar família, convite em texto, sincronizar agora e status;
- a entrada "Entrar na família" no primeiro uso, seguida de "Quem é você?".

**Architecture:**
- **Rust**
  - `pacote.rs`: cifra e decifra pacotes com a chave da família.
  - `remoto.rs`: trait `Remoto` com o cliente do GitHub (`ureq`) e um remoto em memória para testes.
  - `familia.rs`: dados da família no `kv` cifrado e convite.
  - `sincronia.rs`: envio e recebimento.
  - Os comandos em `lib.rs` fazem a rede fora do lock do banco.
- **Front**
  - `src/data/sincronizacao.ts`: estado do módulo; dispara ao abrir, a cada 5 min, 5 s depois de cada mudança e pelo botão.
  - Depois de receber, recarrega a projeção (`recarregar` → `abrirLog`), que já ordena por HLC.
  - O token e a chave nunca passam pelo JS, exceto o texto do convite, mostrado a pedido.

**Tech Stack:** Rust (Tauri 2, rusqlite, ureq 2, base64 0.22, chacha20poly1305 via `cripto::Cofre`), TypeScript (React 18, vitest).

Spec: [`docs/superpowers/specs/2026-10-31-android-sincronizacao-design.md`](../specs/2026-10-31-android-sincronizacao-design.md), seções 1 e 2.
Etapa 1: [`2026-11-01-etapa1-identidade-hlc.md`](2026-11-01-etapa1-identidade-hlc.md).

## Global Constraints

- O log é só de adição. Receber eventos é `INSERT OR IGNORE` por id; nada é apagado nem alterado no banco.
- Nunca gravar dados de saúde em claro, nem no disco nem na rede. Família, token e chave ficam no `kv` cifrado. Os pacotes vão cifrados com XChaCha20-Poly1305 e AAD = `"<familiaId>|<aparelhoId>|<n>"`.
- O repositório da família **precisa ser privado**: `familia_criar` e `familia_entrar` recusam um repositório público.
- Toda chamada de rede fica no Rust, com `ureq`, https e timeout de 30 s. Do GitHub, só `https://api.github.com/repos/<dono>/<nome>/…`.
- Layout no repositório:
  - `familia.json`: `{"familiaId": "<16 hex>", "versao": 1}`, em claro, sem dado pessoal;
  - `eventos/<aparelhoId>/<n com 6 dígitos>.bin`, com n a partir de `000001`.
- Pacote: até 200 eventos ou ~1 MB de JSON. Um evento maior que isso vai sozinho.
- Convite: `"PCASA1:" + base64url(JSON {"v":1,"f":familiaId,"r":"dono/nome","t":token,"k":<chave 64 hex>})`.
- Preferências que sincronizam entre aparelhos: só `agenda`. O resto do `config` vindo de outro aparelho é ignorado na projeção.
- Comandos Tauri `async`, argumentos em uma palavra, respostas em camelCase.
- Textos de interface em pt-BR, exatamente como escritos nas tarefas.
- Rodar `npm run build` depois de mudar TypeScript, e `cd src-tauri && cargo test` depois de mudar Rust.
- **Nunca rodar `npm run app:dev` nem o `.exe` com o identificador real** (`br.familia.arquivosaude`) nos testes. A verificação manual usa os aparelhos de teste da Task 3.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/data/hlc.ts`, `hlc.test.ts` | contador não estoura; `hlcValido` |
| `src/data/log.ts`, `log.test.ts` | HLC dos eventos antigos independe do aparelho (`legado`); desempate por id; legado só sem identidade |
| `src/data/store.tsx` | reducer sem a guarda do "eu"; `addPessoa` não grava `souEu`; ação local `eu`; `api.definirEu`; filtro de `config` de outro aparelho; `abrirLog` passa o aparelho |
| `src/data/registros.test.ts` | a guarda de `removerPessoa` sai do reducer |
| `src-tauri/src/cripto.rs`, `lib.rs` | serviço do cofre = identificador do app |
| `scripts/app-teste.mjs`, `package.json` | aparelhos de teste A e B |
| `src-tauri/src/pacote.rs` | **novo** |
| `src-tauri/src/remoto.rs` | **novo** |
| `src-tauri/src/familia.rs` | **novo** |
| `src-tauri/src/sincronia.rs` | **novo** |
| `src-tauri/src/banco.rs` | `gravar_novo`, `mesclar` |
| `src-tauri/src/lib.rs` | comandos `familia_*`, `sync_*`; restaurar mescla quando há família |
| `src/data/persistencia.ts` | métodos de família e sincronização |
| `src/data/sincronizacao.ts` | **novo**: estado, `sincronizar`, `useSincronizacao`, `avisarMudanca` |
| `src/ui/Familia.tsx` | **novo**: `CardFamilia`, `EntrarNaFamilia`, `QuemEVoce` |
| `src/desktop/Paginas.tsx`, `src/desktop/PrimeiroUso.tsx`, `src/App.tsx` | ligações |
| `CLAUDE.md`, `docs/ARQUITETURA.md`, `README.md` | exceção de privacidade e uso |

---

### Task 1: HLC robusto

**Files:**
- Modify: `src/data/hlc.ts`
- Test: `src/data/hlc.test.ts`

**Interfaces:**
- Produces: `proximoHlc` (mesma assinatura) e `hlcValido(s: unknown): s is string`.

- [ ] **Step 1: Write the failing test.** Acrescente ao `describe('HLC', …)` de `src/data/hlc.test.ts`, e `hlcValido` ao import:
```ts
  it('contador no limite passa para o próximo milissegundo (a ordem da string continua certa)', () => {
    const cheio = { ms: 5000, c: 9999, aparelho: 'pc-a' };
    const prox = proximoHlc(cheio, 5000, 'pc-a');
    expect(prox).toEqual({ ms: 5001, c: 0, aparelho: 'pc-a' });
    expect(fmtHlc(prox) > fmtHlc(cheio)).toBe(true);
    expect(proximoHlc({ ms: 5000, c: 10, aparelho: 'pc-a' }, 1, 'pc-a').c).toBe(11);
  });
  it('hlcValido aceita só o formato do app', () => {
    expect(hlcValido('1793480000000-0007-pc-3f9a1c')).toBe(true);
    expect(hlcValido('0000000000003-0000-legado')).toBe(true);
    for (const ruim of ['', 'abc', '179348-0007-pc', '1793480000000-7-pc-a', '1793480000000-0007-', 42, undefined]) expect(hlcValido(ruim)).toBe(false);
  });
```

- [ ] **Step 2: Run** `npx vitest run src/data/hlc.test.ts`. Expected: FAIL (`hlcValido` não existe; o contador vai a 10000).

- [ ] **Step 3: Implement.** Em `src/data/hlc.ts`, troque `proximoHlc` e acrescente `hlcValido`:
```ts
/** Maior contador que cabe nos 4 dígitos; passou disso, avança o milissegundo para a ordem da string não quebrar. */
const MAX_C = 9999;

/** Próximo carimbo local: nunca volta, mesmo se o relógio do aparelho atrasar. */
export function proximoHlc(ultimo: Hlc | null, agora: number, aparelho: string): Hlc {
  if (!ultimo || agora > ultimo.ms) return { ms: agora, c: 0, aparelho };
  if (ultimo.c >= MAX_C) return { ms: ultimo.ms + 1, c: 0, aparelho };
  return { ms: ultimo.ms, c: ultimo.c + 1, aparelho };
}

/** Confere o formato antes de confiar num HLC vindo de outro aparelho. */
export const hlcValido = (s: unknown): s is string => typeof s === 'string' && /^\d{13}-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
```

- [ ] **Step 4: Run** `npx vitest run src/data/hlc.test.ts`. Expected: PASS (6 tests).

- [ ] **Step 5: Commit** `git add src/data/hlc.ts src/data/hlc.test.ts && git commit -m "Sincronização: HLC sem estouro do contador e com validação"`

---

### Task 2: Log e store prontos para eventos de outros aparelhos

**Files:**
- Modify: `src/data/log.ts`, `src/data/store.tsx`
- Test: `src/data/log.test.ts`, `src/data/registros.test.ts`

**Interfaces:**
- Consumes: `hlcValido` (Task 1).
- Produces:
  - `APARELHO_LEGADO = 'legado'`;
  - `migrarLog`, com o HLC dos eventos antigos terminando em `legado`;
  - `ordenarLog`, que desempata por `id`;
  - `resolverEu(pessoas, identidade)`, que só usa o `souEu` antigo quando `identidade` é `null`;
  - `projetar(eventos, euId?, aparelhoId?)`;
  - ação local `{ type: 'eu'; pessoaId: string | null }`;
  - `api.definirEu(pessoaId: string): void`;
  - `api.removerPessoa`, que ignora a pessoa "eu".

- [ ] **Step 1: Update the tests** in `src/data/log.test.ts`:
  - No teste `migrarLog dá HLC na ordem original…`, troque as três strings esperadas de HLC para terminar em `-legado` em vez de `-pc-aaaaaa`. O `aparelho` continua `'pc-aaaaaa'`:
```ts
    expect(m.map((e) => e.hlc)).toEqual([`${ms}-0000-legado`, `${ms}-0001-legado`, `${ms}-0002-legado`]);
```
  - No teste `migrarLog mantém o HLC…`, espere `'9999999999999-0001-legado'`.
  - Troque o teste de `resolverEu` por:
```ts
  it('resolverEu: identidade salva se a pessoa existe; o souEu antigo só quando nunca houve identidade', () => {
    const ps = [pessoa('ana', true), pessoa('bia')];
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'bia' })).toBe('bia');
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: 'sumiu' })).toBeNull();
    expect(resolverEu(ps, { aparelhoId: 'pc-a', pessoaId: null })).toBeNull();
    expect(resolverEu(ps, null)).toBe('ana');
    expect(resolverEu([pessoa('bia')], null)).toBeNull();
  });
```
  - Acrescente ao `describe('log', …)`:
```ts
  it('ordenarLog desempata HLC igual pelo id', () => {
    const h = '0000000000001-0000-legado';
    expect(ordenarLog([ev('b', '', { hlc: h }), ev('a', '', { hlc: h })]).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('migrarLog trata HLC inválido como evento antigo', () => {
    expect(migrarLog([ev('a', '2026-10-30T10:00:00.000Z', { hlc: 'lixo' })], 'pc-a')[0].hlc).toBe(`${Date.parse('2026-10-30T10:00:00.000Z')}-0000-legado`);
  });
```
  - Acrescente ao `describe('projeção pelo HLC', …)`:
```ts
  it('config de outro aparelho só traz as preferências da família (agenda)', () => {
    const cfg = (id: string, aparelho: string, patch: Record<string, unknown>, hlc: string): Evento => ({ id, em: '', aparelho, hlc, tipo: 'config', dados: { patch } });
    const s = projetar([
      cfg('c1', 'cel-b', { esconderNomeNotif: false, agenda: { url: 'https://x/a.ics', pessoaId: 'ana' } }, '0000000000001-0000-cel-b'),
      cfg('c2', 'pc-a', { bloqueioDesktop: '15 minutos' }, '0000000000002-0000-pc-a'),
    ], null, 'pc-a');
    expect(s.config.esconderNomeNotif).toBe(true);
    expect(s.config.agenda?.url).toBe('https://x/a.ics');
    expect(s.config.bloqueioDesktop).toBe('15 minutos');
  });
```

  Em `src/data/registros.test.ts`, no teste `removerPessoa leva tudo dela, mas não remove quem usa o app`, troque o nome do teste para `'removerPessoa leva tudo dela (a proteção de quem usa o app fica na api)'` e a última linha por:
```ts
    expect(projetar([...base, ev('removerPessoa', { id: 'ana' }, 3)]).pessoas.map((p) => p.id)).toEqual(['bia']);
```

- [ ] **Step 2: Run** `npx vitest run src/data/log.test.ts src/data/registros.test.ts`. Expected: FAIL in the tests changed above.

- [ ] **Step 3: Implement `src/data/log.ts`.**
  - O import de `./hlc` passa a incluir `hlcValido`.
  - Acrescente, abaixo de `Identidade`:
```ts
/** Sufixo do HLC dado a eventos anteriores à sincronização: igual em qualquer aparelho que tenha o mesmo log. */
export const APARELHO_LEGADO = 'legado';
```
  - Em `migrarLog`:
    - troque `if (ev.hlc) {` por `if (hlcValido(ev.hlc)) {`, e no `return` desse ramo use `return ev;`;
    - no ramo antigo, use `proximoHlc(ultimo, Number.isNaN(ms) ? 0 : ms, APARELHO_LEGADO)`;
    - o objeto retornado continua com `aparelho: ev.aparelho ?? aparelhoId`.

    Atualize o comentário: "eventos antigos (ou com HLC inválido) recebem HLC terminado em `legado`, igual em qualquer aparelho".
  - `ordenarLog`:
```ts
/** Ordem de aplicação: por HLC e, no empate, por id. Sem nenhum HLC (testes, navegador), a ordem em que vieram. */
export const ordenarLog = (eventos: Evento[]) =>
  [...eventos].sort((a, b) => {
    const ha = a.hlc ?? '', hb = b.hlc ?? '';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return !ha ? 0 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
```
  - `resolverEu`:
```ts
/** "Eu" neste aparelho: a pessoa da identidade, se existe. O souEu do log antigo só vale na primeira vez (sem identidade). */
export function resolverEu(pessoas: Pessoa[], identidade: Identidade | null): string | null {
  if (identidade) return identidade.pessoaId && pessoas.some((p) => p.id === identidade.pessoaId) ? identidade.pessoaId : null;
  return pessoas.find((p) => p.souEu)?.id ?? null;
}
```

- [ ] **Step 4: Implement `src/data/store.tsx`.**
  1. **Ação local:** no tipo `Local`, acrescente `| { type: 'eu'; pessoaId: string | null }`. No `reducer`, antes do `default:`:
```ts
    case 'eu':
      return marcarEu(s, a.pessoaId);
```
  2. **Guarda do "eu" no reducer:** no `case 'removerPessoa':`, apague a linha `if (s.pessoas.find((p) => p.id === a.id)?.souEu) return s;` e o comentário da guarda. Outro aparelho pode remover qualquer pessoa, e a proteção fica na api.
  3. **Filtro de config de outro aparelho:** acima de `projetar`, acrescente:
```ts
/** Preferências que valem para a família inteira; o resto do `config` é de cada aparelho. */
const CONFIG_DA_FAMILIA: readonly string[] = ['agenda'];

/** Evento → ação; `config` de outro aparelho só traz as preferências da família. */
function acaoDoEvento(ev: Evento, aparelhoId?: string): Mudanca {
  const a = paraAcao(ev);
  if (a.type !== 'config' || !aparelhoId || !ev.aparelho || ev.aparelho === aparelhoId) return a;
  return { ...a, patch: Object.fromEntries(Object.entries(a.patch).filter(([k]) => CONFIG_DA_FAMILIA.includes(k))) as Partial<Config> };
}
```
     E `projetar` passa a ser:
```ts
export function projetar(eventos: Evento[], euId?: string | null, aparelhoId?: string): State {
  const s = ordenarLog(eventos).reduce((acc, ev) => {
    try { return reducer(acc, acaoDoEvento(ev, aparelhoId)); } catch { return acc; }
  }, estadoBase());
  return euId === undefined ? s : marcarEu(s, euId);
}
```
     Atualize o comentário de `projetar` para mencionar o filtro.
  4. **`abrirLog`:** troque `const bruto = projetar(eventos);` por `const bruto = projetar(eventos, undefined, aparelhoId);`.
  5. **api:** troque a implementação de `addPessoa` e de `removerPessoa`, e acrescente `definirEu` logo depois de `addPessoa`:
```ts
      /** Quem cria o próprio perfil (primeiro uso) vira o "eu" deste aparelho; o log não guarda souEu. */
      addPessoa: (pessoa: Pessoa) => {
        const { souEu, ...semEu } = pessoa;
        emitir({ type: 'addPessoa', pessoa: semEu as Pessoa });
        if (souEu) definirEu(pessoa.id);
      },
      definirEu: (pessoaId: string) => definirEu(pessoaId),
```
```ts
      removerPessoa: (id: string) => {
        if (ref.current.pessoas.find((p) => p.id === id)?.souEu) return; // quem usa o app não se remove
        emitir({ type: 'removerPessoa', id });
      },
```
     Dentro do `useMemo` de `useApi`, antes do `return {`, ao lado de `emitir`, defina:
```ts
    /** "Eu" deste aparelho: marca na tela e guarda na identidade local (kv cifrado). */
    const definirEu = (pessoaId: string) => {
      dispatch({ type: 'eu', pessoaId });
      if (!MODO_REAL || !sessao.identidade) return;
      sessao.identidade = { ...sessao.identidade, pessoaId };
      persistencia.definirIdentidade(sessao.identidade).catch((e) => mostrarToast({ texto: `Não foi possível salvar: ${String(e)}` }));
    };
```

- [ ] **Step 5: Run** `npx vitest run`. Expected: todos os testes passam, inclusive os novos. **Run** `npm run build`. Expected: sem erros.

- [ ] **Step 6: Commit** `git add src/data/log.ts src/data/log.test.ts src/data/store.tsx src/data/registros.test.ts && git commit -m "Sincronização: log e store aceitam eventos de outros aparelhos"`

---

### Task 3: Cofre por identificador e aparelhos de teste

Sem isto, um app de teste com outro identificador gravaria a chave do banco **na mesma entrada** do Gerenciador de Credenciais do app real. Isso estragaria o acesso aos dados reais.

**Files:**
- Modify: `src-tauri/src/cripto.rs`, `src-tauri/src/lib.rs`
- Create: `scripts/app-teste.mjs`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces:
  - `cripto::chave_do_aparelho(servico: &str, dir: &Path, criar: bool)`;
  - `cripto::apagar_chave(servico: &str, dir: &Path)`;
  - `npm run app:teste -- a|b` gera `src-tauri/target/teste-a/arquivo-saude.exe` e o equivalente `-b`.

- [ ] **Step 1: `cripto.rs`.**
  - Apague `const SERVICO: &str = "br.familia.arquivosaude";`.
  - Acrescente o parâmetro `servico: &str` como **primeiro** argumento de `chave_do_aparelho` e de `apagar_chave`, e use `servico` onde estava `SERVICO`.
  - No ramo sem keyring, troque `let _ = (SERVICO, CONTA);` por `let _ = (servico, CONTA);`.
  - O doc comment ganha a linha: "`servico` é o identificador do app (`br.familia.arquivosaude` no app real), para um app de teste não tocar na chave do app real."

- [ ] **Step 2: `lib.rs`.**
  - A struct `Estado` ganha `servico: String`.
  - `fn abrir_banco(dir: &Path)` vira `fn abrir_banco(servico: &str, dir: &Path)` e passa `servico` a `chave_do_aparelho`.
  - No `setup`, antes de `abrir_banco`, faça `let servico = app.config().identifier.clone();`. Chame `abrir_banco(&servico, &dir)` e guarde `servico` no `Estado`.
  - Em `apagar_tudo`, use `cripto::apagar_chave(&st.servico, &st.dir)` e `abrir_banco(&st.servico, &st.dir)`.
  - Para achar todas as chamadas: `grep -n "abrir_banco\|apagar_chave\|chave_do_aparelho" src-tauri/src/*.rs`. Os testes de `cripto.rs`/`banco.rs` não chamam essas funções; se algum chamar, passe `"teste"`.

- [ ] **Step 3: Run** `cd src-tauri && cargo test`. Expected: `test result: ok. 14 passed`.

- [ ] **Step 4: `scripts/app-teste.mjs`:**
```js
// `npm run app:teste -- a` (ou b): gera um app de TESTE com outro identificador (dados, chave e janela separados do app real)
// e copia o .exe para src-tauri/target/teste-<letra>/. Serve para testar a sincronização entre dois "aparelhos" no mesmo PC.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

const letra = (process.argv[2] ?? '').toLowerCase();
if (!/^[a-z]$/.test(letra)) {
  console.error('Use: npm run app:teste -- a   (uma letra: a, b, …)');
  process.exit(1);
}
const config = { identifier: `br.familia.arquivosaude.teste${letra}`, productName: `Prontuário teste ${letra.toUpperCase()}`, bundle: { createUpdaterArtifacts: false }, app: { windows: [{ label: 'main', title: `Prontuário teste ${letra.toUpperCase()}`, width: 1280, height: 800, minWidth: 1024, minHeight: 680, center: true, backgroundColor: '#F4F7F7' }] } };
const r = spawnSync('npx', ['tauri', 'build', '--no-bundle', '--config', JSON.stringify(config)], { stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) process.exit(r.status ?? 1);
const destino = `src-tauri/target/teste-${letra}`;
mkdirSync(destino, { recursive: true });
copyFileSync('src-tauri/target/release/arquivo-saude.exe', `${destino}/arquivo-saude.exe`);
console.log(`Pronto: ${destino}/arquivo-saude.exe (identificador br.familia.arquivosaude.teste${letra})`);
```
  - Em `package.json`, ao lado de `app:build`: `"app:teste": "node scripts/app-teste.mjs"`.
  - O build de teste sobrescreve `src-tauri/target/release/arquivo-saude.exe` (o executável portátil); o app **instalado** não é afetado. Depois dos testes, `npm run app:build` gera de novo o executável real.
  - `.gitignore` já ignora `src-tauri/target`.

- [ ] **Step 5: Commit** `git add src-tauri/src/cripto.rs src-tauri/src/lib.rs scripts/app-teste.mjs package.json && git commit -m "Cofre por identificador do app e aparelhos de teste"`

---

### Task 4: Pacotes cifrados (Rust)

**Files:**
- Create: `src-tauri/src/pacote.rs`
- Modify: `src-tauri/src/lib.rs` (`mod pacote;`)

**Interfaces:**
- Consumes: `cripto::Cofre::{new, cifrar, decifrar}`, `cripto::aleatorio`.
- Produces:
  - `pacote::fatiar(eventos: &[Value]) -> Vec<Vec<Value>>`: até 200 por pacote ou ~1 MB; um evento grande vai sozinho;
  - `pacote::empacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, eventos: &[Value]) -> Result<Vec<u8>, String>`;
  - `pacote::desempacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, bytes: &[u8]) -> Result<Vec<Value>, String>`;
  - `pacote::nome(aparelho: &str, n: u32) -> String`, que devolve `"eventos/<aparelho>/<n com 6 dígitos>.bin"`.

- [ ] **Step 1: Write the module with its tests** (`src-tauri/src/pacote.rs`):
```rust
//! Pacotes de sincronização: eventos em JSON, cifrados com a chave da família.
//! AAD = "<familiaId>|<aparelhoId>|<n>": um pacote não pode ser trocado de lugar nem de aparelho.

use crate::cripto::Cofre;
use serde_json::Value;

type R<T> = Result<T, String>;

const MAX_EVENTOS: usize = 200;
const MAX_BYTES: usize = 1024 * 1024;

pub fn nome(aparelho: &str, n: u32) -> String {
    format!("eventos/{aparelho}/{n:06}.bin")
}

fn aad(familia: &str, aparelho: &str, n: u32) -> Vec<u8> {
    format!("{familia}|{aparelho}|{n}").into_bytes()
}

/// Divide em pacotes de até 200 eventos ou ~1 MB de JSON; um evento maior que isso vai sozinho.
pub fn fatiar(eventos: &[Value]) -> Vec<Vec<Value>> {
    let mut out: Vec<Vec<Value>> = Vec::new();
    let mut atual: Vec<Value> = Vec::new();
    let mut bytes = 0usize;
    for ev in eventos {
        let tam = serde_json::to_vec(ev).map(|v| v.len()).unwrap_or(0);
        if !atual.is_empty() && (atual.len() >= MAX_EVENTOS || bytes + tam > MAX_BYTES) {
            out.push(std::mem::take(&mut atual));
            bytes = 0;
        }
        atual.push(ev.clone());
        bytes += tam;
    }
    if !atual.is_empty() {
        out.push(atual);
    }
    out
}

pub fn empacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, eventos: &[Value]) -> R<Vec<u8>> {
    let claro = serde_json::to_vec(&serde_json::json!({ "eventos": eventos })).map_err(|e| e.to_string())?;
    Cofre::new(chave).cifrar(&claro, &aad(familia, aparelho, n)).map_err(|e| e.to_string())
}

pub fn desempacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, bytes: &[u8]) -> R<Vec<Value>> {
    let claro = Cofre::new(chave).decifrar(bytes, &aad(familia, aparelho, n)).map_err(|_| format!("pacote {} não decifra", nome(aparelho, n)))?;
    let v: Value = serde_json::from_slice(&claro).map_err(|e| e.to_string())?;
    Ok(v.get("eventos").and_then(Value::as_array).cloned().unwrap_or_default())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cripto::aleatorio;
    use serde_json::json;

    #[test]
    fn ida_e_volta_e_nada_em_claro() {
        let k = aleatorio::<32>();
        let evs = vec![json!({"id": "a", "dados": {"nome": "Roberto Carlos Almeida"}})];
        let b = empacotar(&k, "f1", "pc-aaaaaa", 1, &evs).unwrap();
        assert!(!b.windows(7).any(|w| w == b"Roberto"));
        assert_eq!(desempacotar(&k, "f1", "pc-aaaaaa", 1, &b).unwrap(), evs);
    }

    #[test]
    fn chave_ou_lugar_errado_nao_abre() {
        let k = aleatorio::<32>();
        let b = empacotar(&k, "f1", "pc-aaaaaa", 1, &[json!({"id": "a"})]).unwrap();
        assert!(desempacotar(&aleatorio::<32>(), "f1", "pc-aaaaaa", 1, &b).is_err());
        assert!(desempacotar(&k, "f1", "pc-aaaaaa", 2, &b).is_err());
        assert!(desempacotar(&k, "f1", "cel-bbbbbb", 1, &b).is_err());
        assert!(desempacotar(&k, "f2", "pc-aaaaaa", 1, &b).is_err());
    }

    #[test]
    fn fatia_por_quantidade_e_tamanho() {
        let muitos: Vec<Value> = (0..450).map(|i| json!({"id": i.to_string()})).collect();
        assert_eq!(fatiar(&muitos).iter().map(Vec::len).collect::<Vec<_>>(), [200, 200, 50]);
        let grande = json!({"id": "g", "dados": "x".repeat(1_200_000)});
        let f = fatiar(&[json!({"id": "a"}), grande, json!({"id": "b"})]);
        assert_eq!(f.iter().map(Vec::len).collect::<Vec<_>>(), [1, 1, 1]);
        assert!(fatiar(&[]).is_empty());
    }

    #[test]
    fn nome_com_seis_digitos() {
        assert_eq!(nome("pc-aaaaaa", 7), "eventos/pc-aaaaaa/000007.bin");
    }
}
```
  Em `src-tauri/src/lib.rs`, acrescente `mod pacote;` junto dos outros `mod`.

- [ ] **Step 2: Run** `cd src-tauri && cargo test pacote`. Expected: 4 passed. Rode `cargo test` inteiro: tudo ok. Avisos de `dead_code` em `pacote` são esperados até a Task 6; não os silencie.

- [ ] **Step 3: Commit** `git add src-tauri/src/pacote.rs src-tauri/src/lib.rs && git commit -m "Sincronização: pacotes cifrados com a chave da família"`

---

### Task 5: Remoto (GitHub e memória) e dados da família

**Files:**
- Create: `src-tauri/src/remoto.rs`, `src-tauri/src/familia.rs`
- Modify: `src-tauri/src/lib.rs` (`mod remoto; mod familia;`)

**Interfaces:**
- Produces:
  - **`trait Remoto`:**
    - `listar(&self, pasta: &str) -> R<Vec<String>>`: nomes dentro da pasta, `[]` se não existe;
    - `baixar(&self, caminho: &str) -> R<Option<Vec<u8>>>`;
    - `gravar(&self, caminho: &str, bytes: &[u8]) -> R<()>`: cria; erro se já existe;
    - `conferir(&self) -> R<()>`: o repositório existe, é **privado** e o token pode gravar.
  - **Implementações:** `GitHub::new(repo, token)` e `Memoria::default()` (com `#[cfg(test)]` e uso em `sincronia`).
  - **Erros:** os de autorização começam com `"TOKEN:"`; o front usa isso para o aviso.
  - **`familia::Familia`**, serde camelCase: `{ familia_id, repo, token, chave: String /* 64 hex */ }`.
  - **Funções de `familia`:**
    - `Familia::nova(repo, token) -> Familia`: `familia_id` com 16 hex aleatórios e chave aleatória;
    - `Familia::chave_bytes(&self) -> R<[u8; 32]>`;
    - `familia::convite(&Familia) -> String`;
    - `familia::ler_convite(&str) -> R<Familia>`;
    - `familia::repo_valido(&str) -> bool`, para o formato `dono/nome`;
    - `familia::conferir_familia_json(remoto, familia_id, criar: bool) -> R<()>`.

- [ ] **Step 1: `src-tauri/src/remoto.rs`:**
```rust
//! Onde os pacotes ficam: um repositório privado no GitHub (Contents API).
//! Só bytes cifrados e o familia.json (sem dado pessoal) passam por aqui.

use base64::Engine;
use std::io::Read;
use std::time::Duration;

type R<T> = Result<T, String>;

pub trait Remoto {
    fn listar(&self, pasta: &str) -> R<Vec<String>>;
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>>;
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()>;
    fn conferir(&self) -> R<()>;
}

pub struct GitHub {
    repo: String,
    token: String,
    agente: ureq::Agent,
}

impl GitHub {
    pub fn new(repo: &str, token: &str) -> Self {
        let agente = ureq::AgentBuilder::new().timeout(Duration::from_secs(30)).build();
        Self { repo: repo.to_string(), token: token.to_string(), agente }
    }
    fn url(&self, resto: &str) -> String {
        format!("https://api.github.com/repos/{}{}", self.repo, resto)
    }
    fn req(&self, metodo: &str, url: &str) -> ureq::Request {
        self.agente
            .request(metodo, url)
            .set("Authorization", &format!("Bearer {}", self.token))
            .set("User-Agent", "prontuario-de-casa")
            .set("X-GitHub-Api-Version", "2022-11-28")
    }
}

/// Erro HTTP → texto. 401/403 viram "TOKEN: …" (o app mostra o aviso de token).
fn erro(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(401, _) | ureq::Error::Status(403, _) => "TOKEN: o token do GitHub não tem acesso ou venceu".into(),
        ureq::Error::Status(c, _) => format!("o GitHub respondeu {c}"),
        _ => "sem conexão com o GitHub".into(),
    }
}

impl Remoto for GitHub {
    fn listar(&self, pasta: &str) -> R<Vec<String>> {
        match self.req("GET", &self.url(&format!("/contents/{pasta}"))).set("Accept", "application/vnd.github+json").call() {
            Ok(r) => {
                let v: serde_json::Value = r.into_json().map_err(|_| "resposta inválida do GitHub".to_string())?;
                Ok(v.as_array().map(|a| a.iter().filter_map(|x| x.get("name").and_then(|n| n.as_str()).map(String::from)).collect()).unwrap_or_default())
            }
            Err(ureq::Error::Status(404, _)) => Ok(vec![]),
            Err(e) => Err(erro(e)),
        }
    }
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>> {
        match self.req("GET", &self.url(&format!("/contents/{caminho}"))).set("Accept", "application/vnd.github.raw+json").call() {
            Ok(r) => {
                let mut b = Vec::new();
                r.into_reader().take(110 * 1024 * 1024).read_to_end(&mut b).map_err(|_| "download interrompido".to_string())?;
                Ok(Some(b))
            }
            Err(ureq::Error::Status(404, _)) => Ok(None),
            Err(e) => Err(erro(e)),
        }
    }
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()> {
        let corpo = serde_json::json!({
            "message": format!("sync {caminho}"),
            "content": base64::engine::general_purpose::STANDARD.encode(bytes),
        });
        self.req("PUT", &self.url(&format!("/contents/{caminho}"))).set("Accept", "application/vnd.github+json").send_json(corpo).map(|_| ()).map_err(erro)
    }
    fn conferir(&self) -> R<()> {
        let v: serde_json::Value = self.req("GET", &self.url("")).set("Accept", "application/vnd.github+json").call().map_err(|e| match e {
            ureq::Error::Status(404, _) => "repositório não encontrado (confira o nome e o acesso do token)".to_string(),
            e => erro(e),
        })?.into_json().map_err(|_| "resposta inválida do GitHub".to_string())?;
        if v.get("private").and_then(|p| p.as_bool()) != Some(true) {
            return Err("o repositório precisa ser privado".into());
        }
        if v.pointer("/permissions/push").and_then(|p| p.as_bool()) == Some(false) {
            return Err("TOKEN: o token não tem permissão para gravar no repositório".into());
        }
        Ok(())
    }
}

/// Remoto em memória, para testes.
#[derive(Default)]
pub struct Memoria {
    pub arquivos: std::sync::Mutex<std::collections::BTreeMap<String, Vec<u8>>>,
}

impl Remoto for Memoria {
    fn listar(&self, pasta: &str) -> R<Vec<String>> {
        let prefixo = format!("{pasta}/");
        let mut nomes: Vec<String> = self.arquivos.lock().unwrap().keys().filter_map(|k| k.strip_prefix(&prefixo).map(|r| r.split('/').next().unwrap_or(r).to_string())).collect();
        nomes.dedup();
        Ok(nomes)
    }
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>> {
        Ok(self.arquivos.lock().unwrap().get(caminho).cloned())
    }
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()> {
        let mut a = self.arquivos.lock().unwrap();
        if a.contains_key(caminho) {
            return Err(format!("o GitHub respondeu 422 ({caminho} já existe)"));
        }
        a.insert(caminho.to_string(), bytes.to_vec());
        Ok(())
    }
    fn conferir(&self) -> R<()> {
        Ok(())
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn memoria_lista_pastas_e_arquivos() {
        let m = Memoria::default();
        m.gravar("eventos/pc-a/000001.bin", b"x").unwrap();
        m.gravar("eventos/pc-a/000002.bin", b"y").unwrap();
        m.gravar("eventos/cel-b/000001.bin", b"z").unwrap();
        let mut pastas = m.listar("eventos").unwrap();
        pastas.sort();
        assert_eq!(pastas, ["cel-b", "pc-a"]);
        assert_eq!(m.listar("eventos/pc-a").unwrap(), ["000001.bin", "000002.bin"]);
        assert_eq!(m.listar("nada").unwrap(), Vec::<String>::new());
        assert!(m.gravar("eventos/pc-a/000001.bin", b"de novo").is_err());
        assert_eq!(m.baixar("eventos/cel-b/000001.bin").unwrap(), Some(b"z".to_vec()));
    }
}
```

- [ ] **Step 2: `src-tauri/src/familia.rs`:**
```rust
//! A família: repositório, token e chave (tudo no kv cifrado do aparelho) e o convite em texto.

use crate::cripto::aleatorio;
use crate::remoto::Remoto;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

type R<T> = Result<T, String>;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Familia {
    pub familia_id: String,
    pub repo: String,
    pub token: String,
    /// 32 bytes em hex.
    pub chave: String,
}

const PREFIXO: &str = "PCASA1:";

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn repo_valido(repo: &str) -> bool {
    let partes: Vec<&str> = repo.split('/').collect();
    partes.len() == 2 && partes.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c)))
}

impl Familia {
    pub fn nova(repo: &str, token: &str) -> Self {
        Self { familia_id: hex(&aleatorio::<8>()), repo: repo.trim().to_string(), token: token.trim().to_string(), chave: hex(&aleatorio::<32>()) }
    }
    pub fn chave_bytes(&self) -> R<[u8; 32]> {
        let mut out = [0u8; 32];
        if self.chave.len() != 64 {
            return Err("chave da família inválida".into());
        }
        for i in 0..32 {
            out[i] = u8::from_str_radix(&self.chave[i * 2..i * 2 + 2], 16).map_err(|_| "chave da família inválida".to_string())?;
        }
        Ok(out)
    }
}

pub fn convite(f: &Familia) -> String {
    let j = json!({ "v": 1, "f": f.familia_id, "r": f.repo, "t": f.token, "k": f.chave });
    format!("{PREFIXO}{}", base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(j.to_string()))
}

pub fn ler_convite(texto: &str) -> R<Familia> {
    let invalido = || "convite inválido: copie o texto inteiro, começando por PCASA1:".to_string();
    let corpo = texto.trim().strip_prefix(PREFIXO).ok_or_else(invalido)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(corpo).map_err(|_| invalido())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|_| invalido())?;
    let s = |k: &str| v.get(k).and_then(Value::as_str).map(String::from).ok_or_else(invalido);
    let f = Familia { familia_id: s("f")?, repo: s("r")?, token: s("t")?, chave: s("k")? };
    if !repo_valido(&f.repo) {
        return Err(invalido());
    }
    f.chave_bytes().map_err(|_| invalido())?;
    Ok(f)
}

/// Confere (ou cria, se `criar`) o familia.json do repositório.
pub fn conferir_familia_json(remoto: &dyn Remoto, familia_id: &str, criar: bool) -> R<()> {
    match remoto.baixar("familia.json")? {
        Some(b) => {
            let v: Value = serde_json::from_slice(&b).map_err(|_| "familia.json inválido no repositório".to_string())?;
            if v.get("familiaId").and_then(Value::as_str) == Some(familia_id) {
                Ok(())
            } else if criar {
                Err("esse repositório já é de outra família; use \"Entrar com convite\"".into())
            } else {
                Err("o convite não é da família desse repositório".into())
            }
        }
        None if criar => remoto.gravar("familia.json", json!({ "familiaId": familia_id, "versao": 1 }).to_string().as_bytes()),
        None => Err("o repositório ainda não tem uma família; peça um convite novo".into()),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;

    #[test]
    fn convite_ida_e_volta() {
        let f = Familia::nova("lucas/prontuario-sync", "github_pat_x");
        assert_eq!(ler_convite(&convite(&f)).unwrap(), f);
        assert!(ler_convite("PCASA1:@@@").is_err());
        assert!(ler_convite("qualquer coisa").is_err());
    }

    #[test]
    fn repo_no_formato_dono_nome() {
        assert!(repo_valido("lucas/prontuario-sync"));
        for ruim in ["lucas", "lucas/", "/x", "a/b/c", "a b/c", "https://github.com/a/b"] {
            assert!(!repo_valido(ruim), "{ruim}");
        }
    }

    #[test]
    fn familia_json_cria_confere_e_recusa_outra() {
        let m = Memoria::default();
        assert!(conferir_familia_json(&m, "f1", false).is_err());
        conferir_familia_json(&m, "f1", true).unwrap();
        conferir_familia_json(&m, "f1", false).unwrap();
        assert!(conferir_familia_json(&m, "f2", true).is_err());
        assert!(conferir_familia_json(&m, "f2", false).is_err());
    }
}
```
  Em `lib.rs`, acrescente `mod familia;` e `mod remoto;`.

- [ ] **Step 3: Run** `cd src-tauri && cargo test`. Expected: tudo ok (14 + 4 + 1 + 3). Avisos de `dead_code` em `GitHub` são esperados até a Task 7.

- [ ] **Step 4: Commit** `git add src-tauri/src/remoto.rs src-tauri/src/familia.rs src-tauri/src/lib.rs && git commit -m "Sincronização: remoto do GitHub, família e convite"`

---

### Task 6: Enviar e receber (Rust, testado com remoto em memória)

**Files:**
- Create: `src-tauri/src/sincronia.rs`
- Modify: `src-tauri/src/banco.rs` (`gravar_novo`, `mesclar`), `src-tauri/src/lib.rs` (`mod sincronia;`)

**Interfaces:**
- Consumes: `pacote::*`, `Remoto`, `Familia`.
- Produces:
  - `Banco::gravar_novo(&self, ev: &Value) -> R<bool>`: `true` se inseriu;
  - `Banco::mesclar(&mut self, evs: &[Value]) -> R<usize>`;
  - `sincronia::Pendencia { n: u32, enviados: usize }`, guardada no kv `sync_envio`;
  - `sincronia::preparar_envio(proprios: &[Value], ja: usize, prox_n: u32) -> Vec<(u32, Vec<Value>)>`;
  - `sincronia::enviar(remoto, familia, aparelho, pacotes) -> R<(u32, usize)>`: grava em ordem e para no primeiro erro; devolve o último n gravado e quantos eventos foram enviados;
  - `sincronia::novos_pacotes(remoto, aparelho, lidos: &BTreeMap<String,u32>) -> R<Vec<(String, u32)>>`;
  - `sincronia::baixar_pacote(remoto, familia, dono, n) -> R<Vec<Value>>`.

- [ ] **Step 1: `banco.rs`:** acrescente a `impl Banco`, depois de `gravar`:
```rust
    /// Como `gravar`, mas diz se o evento era novo (sincronização).
    pub fn gravar_novo(&self, ev: &Value) -> R<bool> {
        let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?;
        let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
        let n = self.conn.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        Ok(n > 0)
    }

    /// Junta eventos ao log sem apagar nada (restaurar backup num aparelho da família). Devolve quantos eram novos.
    pub fn mesclar(&mut self, evs: &[Value]) -> R<usize> {
        let tx = self.conn.transaction().map_err(e)?;
        let mut novos = 0;
        for ev in evs {
            let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?;
            let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
            novos += tx.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        }
        tx.commit().map_err(e)?;
        Ok(novos)
    }
```
  E, no `mod testes` de `banco.rs`:
```rust
    #[test]
    fn mesclar_so_acrescenta() {
        let dir = tempfile::tempdir().unwrap();
        let mut b = Banco::abrir(&dir.path().join("t.db"), &aleatorio::<32>()).unwrap();
        b.gravar(&json!({"id": "x"})).unwrap();
        assert!(!b.gravar_novo(&json!({"id": "x"})).unwrap());
        assert!(b.gravar_novo(&json!({"id": "y"})).unwrap());
        assert_eq!(b.mesclar(&[json!({"id": "y"}), json!({"id": "z"})]).unwrap(), 1);
        let ids: Vec<_> = b.eventos().unwrap().into_iter().map(|v| v["id"].as_str().unwrap().to_string()).collect();
        assert_eq!(ids, ["x", "y", "z"]);
    }
```

- [ ] **Step 2: `src-tauri/src/sincronia.rs`:**
```rust
//! Envio e recebimento de pacotes. Sem banco nem rede aqui dentro além do `Remoto`:
//! quem chama (lib.rs) lê e grava o kv e os eventos, e faz a rede fora do lock do banco.

use crate::familia::Familia;
use crate::pacote;
use crate::remoto::Remoto;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

type R<T> = Result<T, String>;

/// Kv "sync_envio": quantos eventos deste aparelho já subiram e o próximo número de pacote.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Pendencia {
    pub n: u32,
    pub enviados: usize,
}

/// Pacotes a enviar: os eventos próprios depois dos `ja` enviados, numerados a partir de `prox_n`.
pub fn preparar_envio(proprios: &[Value], ja: usize, prox_n: u32) -> Vec<(u32, Vec<Value>)> {
    let resto = proprios.get(ja..).unwrap_or(&[]);
    pacote::fatiar(resto).into_iter().enumerate().map(|(i, p)| (prox_n + i as u32, p)).collect()
}

/// Grava os pacotes em ordem; para no primeiro erro. Devolve (último n gravado, eventos enviados).
/// Se o primeiro já falhar, devolve o erro.
pub fn enviar(remoto: &dyn Remoto, f: &Familia, aparelho: &str, pacotes: &[(u32, Vec<Value>)]) -> R<(u32, usize)> {
    let chave = f.chave_bytes()?;
    let mut ultimo = 0;
    let mut enviados = 0;
    for (n, evs) in pacotes {
        let bytes = pacote::empacotar(&chave, &f.familia_id, aparelho, *n, evs)?;
        if let Err(e) = remoto.gravar(&pacote::nome(aparelho, *n), &bytes) {
            if enviados == 0 {
                return Err(e);
            }
            break;
        }
        ultimo = *n;
        enviados += evs.len();
    }
    Ok((ultimo, enviados))
}

/// Pacotes dos outros aparelhos que ainda não foram lidos, em ordem.
pub fn novos_pacotes(remoto: &dyn Remoto, aparelho: &str, lidos: &BTreeMap<String, u32>) -> R<Vec<(String, u32)>> {
    let mut out = Vec::new();
    for dono in remoto.listar("eventos")? {
        if dono == aparelho {
            continue;
        }
        let ja = lidos.get(&dono).copied().unwrap_or(0);
        let mut ns: Vec<u32> = remoto.listar(&format!("eventos/{dono}"))?.iter().filter_map(|a| a.strip_suffix(".bin")?.parse().ok()).filter(|n| *n > ja).collect();
        ns.sort_unstable();
        out.extend(ns.into_iter().map(|n| (dono.clone(), n)));
    }
    Ok(out)
}

pub fn baixar_pacote(remoto: &dyn Remoto, f: &Familia, dono: &str, n: u32) -> R<Vec<Value>> {
    let bytes = remoto.baixar(&pacote::nome(dono, n))?.ok_or_else(|| format!("{} sumiu do repositório", pacote::nome(dono, n)))?;
    pacote::desempacotar(&f.chave_bytes()?, &f.familia_id, dono, n, &bytes)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;
    use serde_json::json;

    fn evs(ids: &[&str]) -> Vec<Value> {
        ids.iter().map(|i| json!({"id": i, "aparelho": "pc-a"})).collect()
    }

    #[test]
    fn envia_so_o_que_falta_e_o_outro_aparelho_recebe() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let p1 = preparar_envio(&evs(&["1", "2"]), 0, 1);
        assert_eq!(enviar(&m, &f, "pc-a", &p1).unwrap(), (1, 2));
        let p2 = preparar_envio(&evs(&["1", "2", "3"]), 2, 2);
        assert_eq!(p2.len(), 1);
        assert_eq!(enviar(&m, &f, "pc-a", &p2).unwrap(), (2, 1));
        assert!(preparar_envio(&evs(&["1", "2", "3"]), 3, 3).is_empty());

        let mut lidos = BTreeMap::new();
        let novos = novos_pacotes(&m, "cel-b", &lidos).unwrap();
        assert_eq!(novos, [("pc-a".to_string(), 1), ("pc-a".to_string(), 2)]);
        let recebidos: Vec<Value> = novos.iter().flat_map(|(d, n)| baixar_pacote(&m, &f, d, *n).unwrap()).collect();
        assert_eq!(recebidos, evs(&["1", "2", "3"]));
        lidos.insert("pc-a".to_string(), 2);
        assert!(novos_pacotes(&m, "cel-b", &lidos).unwrap().is_empty());
        assert!(novos_pacotes(&m, "pc-a", &BTreeMap::new()).unwrap().is_empty(), "não lê a própria pasta");
    }

    #[test]
    fn pacote_de_outra_familia_nao_abre() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["1"]), 0, 1)).unwrap();
        assert!(baixar_pacote(&m, &Familia::nova("a/b", "t"), "pc-a", 1).is_err());
    }

    #[test]
    fn envio_repetido_do_mesmo_numero_falha_sem_perder_contagem() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["1"]), 0, 1)).unwrap();
        assert!(enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["9"]), 0, 1)).is_err());
    }
}
```
  Em `lib.rs`, acrescente `mod sincronia;`.

- [ ] **Step 3: Run** `cd src-tauri && cargo test`. Expected: tudo ok, incluindo `mesclar_so_acrescenta` e os 3 de `sincronia`.

- [ ] **Step 4: Commit** `git add src-tauri/src/sincronia.rs src-tauri/src/banco.rs src-tauri/src/lib.rs && git commit -m "Sincronização: enviar e receber pacotes"`

---

### Task 7: Comandos Tauri da família e da sincronização

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces os comandos, todos `async` e registrados no `generate_handler!`:
  - `familia_info() -> Option<InfoFamilia>`, com `InfoFamilia { familiaId, repo }` em camelCase. O token e a chave **não** vão para o front.
  - `familia_criar(repo, token) -> InfoFamilia`: valida o formato e recusa repositório público ou token sem gravação. Gera família e chave, cria o `familia.json` e salva no kv `familia`. Zera `sync_envio` e `sync_lidos`.
  - `familia_entrar(convite) -> InfoFamilia`: lê o convite, confere o repositório e o `familia.json`, e salva.
  - `familia_sair()`: apaga os kv `familia`, `sync_envio` e `sync_lidos`, gravando `null`.
  - `familia_convite() -> String`.
  - `sync_enviar(aparelho, eventos) -> usize`: `eventos` são os eventos **próprios**, já migrados, na ordem local. Devolve quantos subiram.
  - `sync_receber(aparelho) -> usize`: quantos eventos novos entraram no banco.
  - `backup_restaurar` passa a **mesclar** quando há família.

- [ ] **Step 1: Helpers e comandos.** Em `lib.rs`, depois de `com_banco`, acrescente:
```rust
// ── Família e sincronização ─────────────────────────────────────────────────
// A rede roda em spawn_blocking, fora do lock do banco: o app continua gravando enquanto sincroniza.

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InfoFamilia {
    familia_id: String,
    repo: String,
}

fn info_de(f: &familia::Familia) -> InfoFamilia {
    InfoFamilia { familia_id: f.familia_id.clone(), repo: f.repo.clone() }
}

fn ler_familia(b: &Banco) -> R<Option<familia::Familia>> {
    match b.kv_get("familia")? {
        Some(v) if !v.is_null() => serde_json::from_value(v).map(Some).map_err(|e| e.to_string()),
        _ => Ok(None),
    }
}

fn exigir_familia(st: &State<Estado>) -> R<familia::Familia> {
    com_banco(st, |b| ler_familia(b))?.ok_or_else(|| "este aparelho não está numa família".into())
}

async fn rede<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|_| "falha na sincronização".to_string())?
}

fn guardar_familia(st: &State<Estado>, f: &familia::Familia) -> R<()> {
    com_banco(st, |b| {
        b.kv_set("familia", &serde_json::to_value(f).map_err(|e| e.to_string())?)?;
        b.kv_set("sync_envio", &serde_json::to_value(sincronia::Pendencia::default()).map_err(|e| e.to_string())?)?;
        b.kv_set("sync_lidos", &json!({}))
    })
}

#[tauri::command]
async fn familia_info(st: State<'_, Estado>) -> R<Option<InfoFamilia>> {
    Ok(com_banco(&st, |b| ler_familia(b))?.as_ref().map(info_de))
}

#[tauri::command]
async fn familia_criar(st: State<'_, Estado>, repo: String, token: String) -> R<InfoFamilia> {
    let repo = repo.trim().trim_start_matches("https://github.com/").trim_end_matches('/').to_string();
    if !familia::repo_valido(&repo) {
        return Err("use o formato dono/nome do repositório (ex.: lucas/prontuario-sync)".into());
    }
    let f = familia::Familia::nova(&repo, &token);
    let g = f.clone();
    rede(move || {
        let r = remoto::GitHub::new(&g.repo, &g.token);
        r.conferir()?;
        familia::conferir_familia_json(&r, &g.familia_id, true)
    })
    .await?;
    guardar_familia(&st, &f)?;
    Ok(info_de(&f))
}

#[tauri::command]
async fn familia_entrar(st: State<'_, Estado>, convite: String) -> R<InfoFamilia> {
    let f = familia::ler_convite(&convite)?;
    let g = f.clone();
    rede(move || {
        let r = remoto::GitHub::new(&g.repo, &g.token);
        r.conferir()?;
        familia::conferir_familia_json(&r, &g.familia_id, false)
    })
    .await?;
    guardar_familia(&st, &f)?;
    Ok(info_de(&f))
}

#[tauri::command]
async fn familia_sair(st: State<'_, Estado>) -> R<()> {
    com_banco(&st, |b| {
        for k in ["familia", "sync_envio", "sync_lidos"] {
            b.kv_set(k, &Value::Null)?;
        }
        Ok(())
    })
}

#[tauri::command]
async fn familia_convite(st: State<'_, Estado>) -> R<String> {
    Ok(familia::convite(&exigir_familia(&st)?))
}

#[tauri::command]
async fn sync_enviar(st: State<'_, Estado>, aparelho: String, eventos: Vec<Value>) -> R<usize> {
    let f = exigir_familia(&st)?;
    let p: sincronia::Pendencia = com_banco(&st, |b| Ok(b.kv_get("sync_envio")?.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()))?;
    let pacotes = sincronia::preparar_envio(&eventos, p.enviados, p.n + 1);
    if pacotes.is_empty() {
        return Ok(0);
    }
    let (ultimo, enviados) = rede(move || {
        let r = remoto::GitHub::new(&f.repo, &f.token);
        sincronia::enviar(&r, &f, &aparelho, &pacotes)
    })
    .await?;
    let nova = sincronia::Pendencia { n: ultimo, enviados: p.enviados + enviados };
    com_banco(&st, |b| b.kv_set("sync_envio", &serde_json::to_value(nova).map_err(|e| e.to_string())?))?;
    Ok(enviados)
}

#[tauri::command]
async fn sync_receber(st: State<'_, Estado>, aparelho: String) -> R<usize> {
    let f = exigir_familia(&st)?;
    let mut lidos: std::collections::BTreeMap<String, u32> =
        com_banco(&st, |b| Ok(b.kv_get("sync_lidos")?.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()))?;
    let (f2, ap, l2) = (f.clone(), aparelho.clone(), lidos.clone());
    let novos = rede(move || sincronia::novos_pacotes(&remoto::GitHub::new(&f2.repo, &f2.token), &ap, &l2)).await?;
    let mut entraram = 0;
    for (dono, n) in novos {
        let g = f.clone();
        let d = dono.clone();
        // Pacote que não decifra (outra chave, corrompido): pula e segue; os outros continuam chegando.
        let evs = match rede(move || sincronia::baixar_pacote(&remoto::GitHub::new(&g.repo, &g.token), &g, &d, n)).await {
            Ok(evs) => evs,
            Err(e) if e.starts_with("TOKEN:") || e.starts_with("sem conexão") => return Err(e),
            Err(_) => vec![],
        };
        entraram += com_banco(&st, |b| {
            let mut c = 0;
            for ev in &evs {
                if b.gravar_novo(ev)? {
                    c += 1;
                }
            }
            Ok(c)
        })?;
        lidos.insert(dono, n);
        com_banco(&st, |b| b.kv_set("sync_lidos", &serde_json::to_value(&lidos).map_err(|e| e.to_string())?))?;
    }
    Ok(entraram)
}
```
  - **Mesclar no restore:** em `backup_restaurar`, troque o `com_banco(...)` por:
```rust
    com_banco(&st, |b| {
        // Num aparelho da família, o log é a união de todos: restaurar só acrescenta o que falta.
        if ler_familia(b)?.is_some() {
            b.mesclar(&evs)?;
            return b.eventos();
        }
        b.substituir(&evs)?;
        Ok(evs)
    })
```
  - **Registro:** registre no `generate_handler!`: `familia_info, familia_criar, familia_entrar, familia_sair, familia_convite, sync_enviar, sync_receber`.

- [ ] **Step 2: Run** `cd src-tauri && cargo test`, depois `cargo clippy --all-targets 2>&1 | tail -20`, se o clippy estiver instalado. Expected: testes ok, sem `dead_code` em `pacote`, `remoto`, `familia` ou `sincronia`, a não ser no `Memoria`, que só é usado em testes. Se aparecer, marque `Memoria` e sua `impl` com `#[cfg(test)]`.

- [ ] **Step 3: Commit** `git add src-tauri/src/lib.rs && git commit -m "Sincronização: comandos da família e do envio/recebimento"`

---

### Task 8: Motor de sincronização no front

**Files:**
- Modify: `src/data/persistencia.ts`, `src/data/store.tsx`, `src/App.tsx`
- Create: `src/data/sincronizacao.ts`, `src/data/sincronizacao.test.ts`

**Interfaces:**
- Consumes: os comandos da Task 7; `migrarLog` (Task 2); `sessao`/`abrirLog`/`recarregar` do store.
- Produces:
  - `persistencia.familiaInfo(): Promise<InfoFamilia | null>`;
  - `persistencia.familiaCriar(repo: string, token: string): Promise<InfoFamilia>`;
  - `persistencia.familiaEntrar(convite: string): Promise<InfoFamilia>`;
  - `persistencia.familiaSair(): Promise<void>`;
  - `persistencia.familiaConvite(): Promise<string>`;
  - `persistencia.syncEnviar(aparelho: string, eventos: Evento[]): Promise<number>`;
  - `persistencia.syncReceber(aparelho: string): Promise<number>`;
  - `interface InfoFamilia { familiaId: string; repo: string }`;
  - em `sincronizacao.ts`:
    - `useInfoSync()`, que devolve `{ familia: InfoFamilia | null; estado: 'parado' | 'sincronizando' | 'ok' | 'erro'; ultima?: string; via?: 'GitHub'; erro?: string; token?: boolean }`;
    - `carregarFamilia()`;
    - `sincronizar(store, { manual })`;
    - `avisarMudanca()`;
    - `useSincronizacao()`;
    - `mensagemErro(e: unknown): { texto: string; token: boolean }`;
  - `api.meusEventos(): Promise<Evento[]>` no store: os eventos do banco migrados e filtrados por `aparelho === aparelhoId`, na ordem local.

- [ ] **Step 1: persistência.** Em `src/data/persistencia.ts`:
  - acrescente `export interface InfoFamilia { familiaId: string; repo: string }`;
  - acrescente os 7 métodos à interface `Persistencia`, com doc de uma linha cada;
  - em `tauri()`:
```ts
    familiaInfo: () => call<InfoFamilia | null>('familia_info'),
    familiaCriar: (repo, token) => call<InfoFamilia>('familia_criar', { repo, token }),
    familiaEntrar: (convite) => call<InfoFamilia>('familia_entrar', { convite }),
    familiaSair: () => call('familia_sair'),
    familiaConvite: () => call<string>('familia_convite'),
    syncEnviar: (aparelho, eventos) => call<number>('sync_enviar', { aparelho, eventos }),
    syncReceber: (aparelho) => call<number>('sync_receber', { aparelho }),
```
  - em `memoria()`, onde não há GitHub:
```ts
    familiaInfo: async () => null,
    familiaCriar: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaEntrar: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaSair: async () => {},
    familiaConvite: async () => { throw new Error('A família só funciona no app instalado.'); },
    syncEnviar: async () => 0,
    syncReceber: async () => 0,
```

- [ ] **Step 2: store.** Em `src/data/store.tsx`, no objeto da api, depois de `recarregar,`:
```ts
      /** Eventos criados por este aparelho, já com HLC, na ordem local (o que a sincronização sobe). */
      async meusEventos(): Promise<Evento[]> {
        const id = sessao.identidade?.aparelhoId;
        if (!MODO_REAL || !id) return [];
        const ini = await persistencia.iniciar();
        return migrarLog(ini.eventos, id).filter((e) => e.aparelho === id);
      },
      aparelhoId: () => sessao.identidade?.aparelhoId ?? null,
```
  E em `emitir`, depois de `persistencia.gravar(ev)...`, acrescente a linha `avisarMudanca();`, com `import { avisarMudanca } from './sincronizacao';` no topo. O `sincronizacao.ts` importa só **tipos** do store; o `useStore` vem por import normal, porque é só uma referência a função e não dá ciclo de execução.

- [ ] **Step 3: Write the failing test** `src/data/sincronizacao.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mensagemErro } from './sincronizacao';

describe('sincronização', () => {
  it('erros de token viram aviso de token; o resto vira texto simples', () => {
    expect(mensagemErro('TOKEN: o token do GitHub não tem acesso ou venceu')).toEqual({ texto: 'o token do GitHub não tem acesso ou venceu', token: true });
    expect(mensagemErro(new Error('sem conexão com o GitHub'))).toEqual({ texto: 'sem conexão com o GitHub', token: false });
  });
});
```
  Run `npx vitest run src/data/sincronizacao.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 4: `src/data/sincronizacao.ts`:**
```ts
// Sincronização da família pelo GitHub (pacotes cifrados; a rede e a chave ficam no Rust).
// Sincroniza ao abrir, a cada 5 min com o app aberto, 5 s depois de uma mudança e no botão "Sincronizar agora".

import { useEffect, useSyncExternalStore } from 'react';
import { MODO_REAL } from './tempo';
import { persistencia, type InfoFamilia } from './persistencia';
import { useStore } from './store';

export interface InfoSync {
  familia: InfoFamilia | null;
  estado: 'parado' | 'sincronizando' | 'ok' | 'erro';
  /** ISO da última sincronização completa. */
  ultima?: string;
  via?: 'GitHub';
  erro?: string;
  /** O erro é de token (sem acesso ou vencido). */
  token?: boolean;
}

let info: InfoSync = { familia: null, estado: 'parado' };
const ouvintes = new Set<() => void>();
const mudar = (i: Partial<InfoSync>) => { info = { ...info, ...i }; ouvintes.forEach((f) => f()); };
export const useInfoSync = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => info);

export function mensagemErro(e: unknown): { texto: string; token: boolean } {
  const t = e instanceof Error ? e.message : String(e);
  return t.startsWith('TOKEN:') ? { texto: t.slice(6).trim(), token: true } : { texto: t, token: false };
}

export async function carregarFamilia() {
  if (!MODO_REAL) return;
  mudar({ familia: await persistencia.familiaInfo().catch(() => null) });
}
export const definirFamilia = (familia: InfoFamilia | null) => mudar({ familia, estado: 'parado', erro: undefined, token: undefined, ultima: undefined });

type Store = ReturnType<typeof useStore>;

/** Sobe o que este aparelho criou, baixa o que os outros criaram e, se chegou algo, reprojeta o estado. */
export async function sincronizar({ api }: Pick<Store, 'api'>, { manual = false } = {}) {
  const aparelho = api.aparelhoId();
  if (!info.familia || !aparelho || info.estado === 'sincronizando') return;
  mudar({ estado: 'sincronizando', erro: undefined, token: undefined });
  try {
    await persistencia.syncEnviar(aparelho, await api.meusEventos());
    const chegaram = await persistencia.syncReceber(aparelho);
    if (chegaram > 0) await api.recarregar();
    mudar({ estado: 'ok', ultima: new Date().toISOString(), via: 'GitHub' });
    if (manual) api.toast({ texto: chegaram ? `${chegaram === 1 ? '1 mudança chegou' : `${chegaram} mudanças chegaram`} da família` : 'Tudo sincronizado' });
  } catch (e) {
    const { texto, token } = mensagemErro(e);
    mudar({ estado: 'erro', erro: texto, token });
    if (manual) api.toast({ texto: `Não foi possível sincronizar: ${texto}` });
  }
}

let aposMudanca: (() => void) | null = null;
let espera: ReturnType<typeof setTimeout> | undefined;
/** Chamado a cada evento gravado: sincroniza 5 s depois da última mudança. */
export function avisarMudanca() {
  if (!aposMudanca) return;
  clearTimeout(espera);
  espera = setTimeout(() => aposMudanca?.(), 5000);
}

/** Montado uma vez no app: carrega a família e sincroniza ao abrir, a cada 5 min e depois de mudanças. */
export function useSincronizacao() {
  const store = useStore();
  const { familia } = useInfoSync();
  const pronto = store.status === 'pronto' && !store.state.bloqueado;
  useEffect(() => { void carregarFamilia(); }, []);
  useEffect(() => {
    if (!pronto || !familia) return;
    const rodar = () => void sincronizar(store);
    aposMudanca = rodar;
    rodar();
    const t = setInterval(rodar, 5 * 60 * 1000);
    return () => { clearInterval(t); aposMudanca = null; clearTimeout(espera); };
    // `store` muda a cada render; o efeito depende só de abrir/fechar e da família.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, familia]);
}
```
  Observação para o implementador: `sincronizar` chama `api.recarregar()`, que já existe e reprojeta via `abrirLog`.

- [ ] **Step 5: App.** Em `src/App.tsx`, acrescente `import { useSincronizacao } from './data/sincronizacao';` e chame `useSincronizacao();` logo abaixo de `useVerificarAtualizacaoAoAbrir();`.

- [ ] **Step 6: Run** `npx vitest run` (todos passam) e `npm run build` (sem erros).

- [ ] **Step 7: Commit** `git add src/data/persistencia.ts src/data/store.tsx src/data/sincronizacao.ts src/data/sincronizacao.test.ts src/App.tsx && git commit -m "Sincronização: motor no front (abrir, 5 min, depois de mudanças)"`

---

### Task 9: Telas: card da família, entrar com convite, "Quem é você?"

**Files:**
- Create: `src/ui/Familia.tsx`
- Modify: `src/desktop/Paginas.tsx` (card em `DPrivacidade`), `src/desktop/PrimeiroUso.tsx` (link "Entrar na família"), `src/App.tsx` ("Quem é você?")

**Interfaces:**
- Consumes:
  - de `sincronizacao.ts`: `useInfoSync`, `sincronizar`, `definirFamilia`;
  - de `persistencia`: `familiaCriar`, `familiaEntrar`, `familiaSair`, `familiaConvite`;
  - `api.definirEu`, `api.recarregar`;
  - os componentes `Label` (`src/ui/index.tsx`) e `Folha` (`src/ui/Backup.tsx`), além de `quando` (`src/data/format.ts`).
- Produces: `CardFamilia`, `EntrarNaFamilia({ desktop, onClose })` e `QuemEVoce()`.

Antes de escrever, leia como `Folha` é exportada e usada em `src/ui/Backup.tsx`: `grep -n "function Folha" -A25 src/ui/Backup.tsx`. Se `Folha` não for exportada, exporte-a (`export function Folha`). Use as mesmas classes de botão e de input do `RestaurarBackup`.

- [ ] **Step 1: `src/ui/Familia.tsx`:**
```tsx
// Família e aparelhos: criar a família (repositório privado no GitHub), convite em texto, entrar e "Quem é você?".
import { useState } from 'react';
import { useStore } from '../data/store';
import { persistencia } from '../data/persistencia';
import { definirFamilia, sincronizar, useInfoSync } from '../data/sincronizacao';
import { quando } from '../data/format';
import { ehPet } from '../data/pets';
import { Folha } from './Backup';
import { Label } from './index';

const texto = { fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' } as const;
const erroTxt = { fontSize: 13, color: 'var(--danger)' } as const;

/** Privacidade e backup › Família e aparelhos (desktop). */
export function CardFamilia() {
  const store = useStore();
  const s = useInfoSync();
  const [folha, setFolha] = useState<null | 'criar' | 'entrar' | 'convite' | 'sair'>(null);
  const status = !s.familia ? '' : s.estado === 'sincronizando' ? 'Sincronizando…' : s.estado === 'erro' ? (s.token ? 'Token do GitHub sem acesso ou vencido' : `Não sincronizou: ${s.erro}`) : s.ultima ? `Sincronizado ${quando(s.ultima)} · pelo GitHub` : 'Ainda não sincronizou';
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className="card-head card-head--20"><Label>Família e aparelhos</Label></div>
      {!s.familia ? (
        <div className="stack" style={{ padding: '16px 20px', gap: 12 }}>
          <span style={texto}>Sincronize seus aparelhos e os da família por um repositório privado no GitHub. Tudo vai cifrado: o GitHub só guarda arquivos ilegíveis.</span>
          <div className="hstack" style={{ gap: 8 }}>
            <button type="button" className="btn btn--ink btn--h38" onClick={() => setFolha('criar')}>Criar família</button>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} onClick={() => setFolha('entrar')}>Entrar com convite</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ padding: '14px 20px' }}>
            <span className="stack" style={{ gap: 2 }}>
              <span>Repositório <span className="mono">{s.familia.repo}</span></span>
              <span style={{ fontSize: 13, color: s.estado === 'erro' ? 'var(--danger)' : 'var(--text-2)' }}>{status}</span>
            </span>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent' }} disabled={s.estado === 'sincronizando'} onClick={() => void sincronizar(store, { manual: true })}>Sincronizar agora</button>
          </div>
          <div className="row" style={{ padding: '14px 20px' }}>
            <span className="muted">Este aparelho</span>
            <span className="mono">{store.api.aparelhoId()}</span>
          </div>
          <div className="hstack" style={{ padding: '14px 20px', gap: 8 }}>
            <button type="button" className="btn btn--ink btn--h38" onClick={() => setFolha('convite')}>Convidar aparelho</button>
            <button type="button" className="btn btn--outline btn--h38" style={{ background: 'transparent', color: 'var(--danger)' }} onClick={() => setFolha('sair')}>Sair da família</button>
          </div>
        </>
      )}
      {folha === 'criar' && <CriarFamilia onClose={() => setFolha(null)} />}
      {folha === 'entrar' && <EntrarNaFamilia desktop onClose={() => setFolha(null)} />}
      {folha === 'convite' && <Convite onClose={() => setFolha(null)} />}
      {folha === 'sair' && <SairDaFamilia onClose={() => setFolha(null)} />}
    </div>
  );
}

function CriarFamilia({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const criar = async () => {
    setOcupado(true); setErro('');
    try {
      definirFamilia(await persistencia.familiaCriar(repo, token));
      onClose();
      void sincronizar(store, { manual: true });
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop onClose={onClose} titulo="Criar família">
      <span style={texto}>1. No GitHub, crie um repositório <b>privado</b> vazio (ex.: prontuario-sync).<br />2. Em Settings › Developer settings › Fine-grained tokens, gere um token só para esse repositório, com <b>Contents: Read and write</b>.<br />3. Cole os dois aqui. O token fica cifrado neste aparelho.</span>
      <input className="input input--desk" placeholder="dono/nome (ex.: lucas/prontuario-sync)" value={repo} onChange={(e) => setRepo(e.target.value)} autoFocus aria-label="Repositório" />
      <input className="input input--desk input--mono" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token do GitHub" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className="btn btn--ink btn--h40d" disabled={!repo.trim() || !token.trim() || ocupado} onClick={criar}>{ocupado ? 'Conferindo o repositório…' : 'Criar família'}</button>
    </Folha>
  );
}

/** Colar o convite (desktop agora; o QR vem na Etapa 4). Usado no card e no primeiro uso. */
export function EntrarNaFamilia({ desktop, onClose }: { desktop?: boolean; onClose: () => void }) {
  const store = useStore();
  const [convite, setConvite] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrar = async () => {
    setOcupado(true); setErro('');
    try {
      definirFamilia(await persistencia.familiaEntrar(convite));
      await sincronizar(store, { manual: true });
      onClose();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Folha desktop={desktop} onClose={onClose} titulo="Entrar na família">
      <span style={texto}>Em um aparelho que já está na família, abra Privacidade e backup › Convidar aparelho e copie o convite. Cole aqui.</span>
      <textarea className="input input--desk input--area input--mono" placeholder="PCASA1:…" value={convite} onChange={(e) => setConvite(e.target.value)} autoFocus aria-label="Convite" />
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
      <button type="button" className={`btn btn--ink ${desktop ? 'btn--h40d' : 'btn--h50'}`} disabled={!convite.trim() || ocupado} onClick={entrar}>{ocupado ? 'Baixando os dados da família…' : 'Entrar'}</button>
    </Folha>
  );
}

function Convite({ onClose }: { onClose: () => void }) {
  const { api } = useStore();
  const [convite, setConvite] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const mostrar = async () => { try { setConvite(await persistencia.familiaConvite()); } catch (e) { setErro(String(e)); } };
  const copiar = async () => { if (convite) { await navigator.clipboard.writeText(convite); api.toast({ texto: 'Convite copiado' }); } };
  return (
    <Folha desktop onClose={onClose} titulo="Convidar aparelho" alerta>
      <span style={texto}>O convite leva a chave da família e o token do GitHub: quem tiver o texto entra na família. Passe só para os seus aparelhos e os da família, por um canal seu, e apague depois de usar.</span>
      {convite ? (
        <>
          <textarea className="input input--desk input--area input--mono" readOnly value={convite} aria-label="Convite" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn--ink btn--h40d" onClick={copiar}>Copiar convite</button>
        </>
      ) : (
        <button type="button" className="btn btn--ink btn--h40d" onClick={mostrar}>Mostrar convite</button>
      )}
      {erro && <span style={erroTxt} role="alert">{erro}</span>}
    </Folha>
  );
}

function SairDaFamilia({ onClose }: { onClose: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const sair = async () => {
    setOcupado(true);
    await persistencia.familiaSair();
    definirFamilia(null);
    onClose();
  };
  return (
    <Folha desktop onClose={onClose} titulo="Sair da família?" alerta>
      <span style={texto}>Este aparelho para de sincronizar. Os dados que já estão aqui continuam aqui; os outros aparelhos não perdem nada.</span>
      <button type="button" className="btn btn--h40d" style={{ background: 'var(--danger)', color: '#fff' }} disabled={ocupado} onClick={sair}>Sair da família</button>
    </Folha>
  );
}

/** Depois de entrar na família (ou restaurar dados de outra pessoa): escolher quem usa este aparelho. */
export function QuemEVoce() {
  const { state, api } = useStore();
  const pessoas = state.pessoas.filter((p) => !ehPet(p));
  return (
    <div className="pu" style={{ placeItems: 'center', display: 'grid', minHeight: '100vh' }}>
      <div className="stack" style={{ gap: 18, width: 'min(420px, 100% - 32px)' }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="pu__rotulo">FAMÍLIA</span>
          <h2 className="pu__titulo" style={{ margin: 0 }}>Quem é você?</h2>
          <span style={texto}>Escolha o seu perfil. Ele passa a ser o "você" deste aparelho.</span>
        </div>
        <div className="card">
          {pessoas.map((p) => (
            <button key={p.id} type="button" className="row" style={{ padding: '14px 20px', fontSize: 15, minHeight: 48 }} onClick={() => api.definirEu(p.id)}>
              <span>{p.nome}</span><span className="muted">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```
  A lista de aparelhos da família fica para a Etapa 4, junto com "Remover aparelho".

- [ ] **Step 2: Ligações.**
  - **`src/desktop/Paginas.tsx`:** em `DPrivacidade`, logo antes de `<CardAtualizacoes />`, acrescente `<CardFamilia />`, com `import { CardFamilia } from '../ui/Familia';`.
  - **`src/desktop/PrimeiroUso.tsx`:** em `BoasVindasD`, troque o estado `restaurar` por `const [folha, setFolha] = useState<null | 'restaurar' | 'familia'>(null);`. Em `pu__acoes`, os dois links ficam:
```tsx
        <button type="button" className="btn btn--link btn--h40d" onClick={() => setFolha('familia')}>Entrar na família</button>
        <button type="button" className="btn btn--link btn--h40d" onClick={() => setFolha('restaurar')}>Restaurar um backup</button>
```
    e no fim:
```tsx
      {folha === 'restaurar' && <RestaurarBackup desktop primeiroUso onClose={() => setFolha(null)} />}
      {folha === 'familia' && <EntrarNaFamilia desktop onClose={() => setFolha(null)} />}
```
    com `import { EntrarNaFamilia } from '../ui/Familia';`.
  - **`src/App.tsx`:** na decisão de telas, onde está `{!temEu(state) ? (`, troque por:
```tsx
      {!temEu(state) && MODO_REAL && state.pessoas.some((p) => p.tipo !== 'pet') ? (
        <QuemEVoce />
      ) : !temEu(state) ? (
```
    O resto continua igual. Adicione `import { QuemEVoce } from './ui/Familia';` e confira se `MODO_REAL` já é importado de `./data/tempo`; se não for, importe.

    Com isso, "Quem é você?" aparece quando há pessoas mas nenhuma é "você" neste aparelho: depois de entrar na família, ou num restore com outras pessoas. O primeiro uso normal, sem pessoas, continua igual.

- [ ] **Step 3: Run** `npx vitest run`, `npm run build`. Expected: tudo passa, sem erros.

- [ ] **Step 4: Navegador.**
  1. Rode `npm run dev` e abra `http://localhost:1420/#/privacidade`.
  2. O card "Família e aparelhos" aparece com "Criar família" e "Entrar com convite".
  3. As duas folhas abrem e fecham.
  4. No navegador, "Entrar" mostra o erro "A família só funciona no app instalado.".

- [ ] **Step 5: Commit** `git add src/ui/Familia.tsx src/ui/Backup.tsx src/desktop/Paginas.tsx src/desktop/PrimeiroUso.tsx src/App.tsx && git commit -m "Sincronização: família e aparelhos, convite e Quem é você?"`

---

### Task 10: Verificação com dois aparelhos de teste e documentação

**Files:**
- Modify: `CLAUDE.md`, `docs/ARQUITETURA.md`, `README.md`

- [ ] **Step 1: Documentação.**
  - **`CLAUDE.md`**, em "Regras › Privacidade", acrescente:
```markdown
  - Exceção pedida pelo usuário (01/11/2026): **sincronização da família** (`src-tauri/src/remoto.rs`, `sincronia.rs`) grava e lê pacotes **cifrados com a chave da família** num repositório **privado** do GitHub que o usuário criou (Contents API, token fine-grained só desse repositório, guardado no kv cifrado). Sem família configurada, nada é enviado. Testes manuais só com `npm run app:teste -- a|b` (outro identificador), nunca com o app real.
```
  - **`docs/ARQUITETURA.md`:**
    - Na seção da sincronização, acrescente um parágrafo "**Feito (Etapa 2, 01/11/2026)**": repositório privado no GitHub, pacotes `eventos/<aparelho>/<n>.bin` cifrados com AAD `familia|aparelho|n`, convite `PCASA1:` em texto (QR na Etapa 4), envio ao abrir, a cada 5 min, 5 s após mudança e no botão, restaurar backup mescla quando há família, e só `agenda` do `config` vale entre aparelhos.
    - Na seção "Pendências", liste: Wi-Fi local (Etapa 5), compactação de pacotes, remover aparelho e troca de chave (Etapa 4) e lista de aparelhos na tela.
  - **`README.md`**, nova seção "Sincronizar a família" depois de "Publicar uma versão": os 3 passos do card "Criar família" (repositório privado, token fine-grained com Contents read/write, colar) e "Convidar aparelho" → "Entrar na família".

- [ ] **Step 2: Commit** `git add CLAUDE.md docs/ARQUITETURA.md README.md && git commit -m "Etapa 2: sincronização pelo GitHub documentada"`

- [ ] **Step 3: Verificação manual** (feita pelo controlador com o usuário; precisa de um repositório privado de teste e de um token):
  1. `npm run app:teste -- a` e `npm run app:teste -- b`.
  2. Abra `src-tauri/target/teste-a/arquivo-saude.exe`. Faça o primeiro uso (pessoa "Ana Teste", senha) e cadastre um remédio.
  3. Em Privacidade e backup, use "Criar família" com o repositório de teste e o token. Confira "Sincronizado agora · pelo GitHub".
  4. No GitHub, o repositório tem `familia.json` e `eventos/pc-…/000001.bin`, e o `.bin` não tem texto legível.
  5. Em A, "Convidar aparelho" › "Mostrar convite" › "Copiar convite".
  6. Abra `teste-b`. Na boas-vindas, use "Entrar na família", cole o convite e escolha "Ana Teste" em "Quem é você?". Crie a senha: o remédio de A aparece em B.
  7. Edite o remédio em B e espere 5 s. Em A, "Sincronizar agora": a edição aparece.
  8. Edite o mesmo campo nos dois com A desconectado, depois sincronize: vence a edição mais recente nos dois.
  9. Ao terminar, apague os dados de teste com "Apagar todos os dados" em cada app de teste.
