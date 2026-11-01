# Lembretes no Windows — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notificações do Windows para doses (com Tomei / Lembrar em 15 min / Pular esta dose) e consultas, enquanto o app está aberto.

**Architecture:** Uma função pura no front (`src/data/lembretes.ts`) transforma o estado nos lembretes das próximas 24 h. Um hook manda a lista ao Rust (`agendar_lembretes`) a cada mudança. No Rust, uma thread espera cada horário e mostra a notificação com `tauri-winrt-notification`. Os cliques em Tomei/Pular voltam como evento `lembrete-acao` e viram `api.marcarDose`. "Lembrar em 15 min" é resolvido só no Rust.

**Tech Stack:** Tauri 2, Rust (chrono, `tauri-winrt-notification` 0.8, `windows-registry` 0.6), React 18 + TypeScript, Vitest 2.1.9.

**Spec:** `docs/superpowers/specs/2026-10-29-lembretes-design.md`

## Global Constraints

- Textos da interface e das notificações em **pt-BR**, exatamente como abaixo.
- Privacidade: a lista de lembretes nunca vai para o disco (nem `kv`, nem evento). Sem rede.
- Nada muda no modo exemplo (navegador sem `?persistir`) nem no navegador com `?persistir`: os lembretes só existem com `EM_TAURI`.
- Doses continuam append-only: Tomei/Pular passam por `api.marcarDose`, que emite o evento `dose`.
- Comandos Tauri `async`, argumentos em uma palavra (`lista`), respostas em camelCase.
- Rode `npm run build` depois de mudar TypeScript e `cd src-tauri && cargo test` depois de mudar Rust.
- No terminal da sessão, o `cargo` fica em `~/.cargo/bin/cargo` (o PATH antigo não tem). Terminais novos já encontram.
- Refinamento em relação à spec: o título com nome escondido usa "da" para `sexo: 'Feminino'` ("Hora do remédio da Helena") e "do" nos outros casos.

---

### Task 1: `lembretes.ts`, a função pura, com testes (Vitest)

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `test`)
- Create: `src/data/lembretes.ts`
- Test: `src/data/lembretes.test.ts`

**Interfaces:**
- Consumes: `State` (tipo, de `src/data/store.tsx`), `Pessoa` (de `src/data/types.ts`).
- Produces:
  - `interface Lembrete { id: string; quando: string; titulo: string; corpo: string; acoes: boolean }`
  - `proximosLembretes(s: State, agora: Date, horas = 24): Lembrete[]`, ordenada por `quando`.
  - Ids: `dose|<remedioId>|<AAAA-MM-DDTHH:MM>` e `consulta|<consultaId>|<rótulo>`. `quando` é a hora local `AAAA-MM-DDTHH:MM`.

- [ ] **Step 1: Instalar o Vitest**

```bash
npm install -D vitest@2.1.9
```

Em `package.json`, dentro de `"scripts"`, acrescentar depois de `"preview"`:

```json
    "test": "vitest run",
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `src/data/lembretes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { proximosLembretes } from './lembretes';
import type { State } from './store';
import type { Consulta, Pessoa, Remedio } from './types';

const pessoa = (id: string, curto: string, sexo: Pessoa['sexo']): Pessoa => ({ id, nome: curto, curto, sexo, cor: '#ccc', alergias: [], condicoes: [] });

const remedio = (o: Partial<Remedio> = {}): Remedio => ({
  id: 'levo', pessoaId: 'roberto', nome: 'Levotiroxina 75 mcg', dose: '1 comp.', doseLonga: '1 comprimido', unidade: 'comprimidos',
  horarios: ['06:30', '21:00'], continuo: true, avisarDias: 5, lembrete: true, ativo: true, ...o,
});

const consulta = (o: Partial<Consulta> = {}): Consulta => ({
  id: 'cardio', tipo: 'consulta', pessoaId: 'roberto', titulo: 'Cardiologista', profissional: 'Dra. Ana', local: 'Clínica Centro',
  data: '2026-10-30', hora: '14:30', levar: [], lembretes: ['1 dia antes', '2 h antes'], ...o,
});

const estado = (o: Partial<State> = {}): State => ({
  pessoas: [pessoa('roberto', 'Roberto', 'Masculino'), pessoa('helena', 'Helena', 'Feminino')],
  remedios: [], doses: [], consultas: [], exames: [], planos: [], compartilhamentos: [],
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
    const l = proximosLembretes(estado({ remedios: [remedio()] }), em('2026-10-29T08:00'));
    expect(l.map((x) => x.id)).toEqual(['dose|levo|2026-10-29T21:00', 'dose|levo|2026-10-30T06:30']);
    expect(l[0]).toEqual({
      id: 'dose|levo|2026-10-29T21:00', quando: '2026-10-29T21:00',
      titulo: 'Hora do remédio do Roberto', corpo: 'Abra para ver qual. 1 dose às 21:00.', acoes: true,
    });
  });

  it('mostra o nome quando "esconder" está desligado e usa "da" para mulheres', () => {
    const s = estado({ remedios: [remedio({ pessoaId: 'helena', nome: 'Sinvastatina 20 mg', horarios: ['21:00'] })] });
    const visivel = proximosLembretes({ ...s, config: { esconderNomeNotif: false } as State['config'] }, em('2026-10-29T08:00'));
    expect(visivel[0].titulo).toBe('Sinvastatina 20 mg · Helena');
    expect(visivel[0].corpo).toBe('1 comprimido às 21:00.');
    expect(proximosLembretes(s, em('2026-10-29T08:00'))[0].titulo).toBe('Hora do remédio da Helena');
  });

  it('inclui doses de até 30 min atrás, não mais', () => {
    const s = estado({ remedios: [remedio({ horarios: ['06:30'] })] });
    expect(proximosLembretes(s, em('2026-10-29T06:50'))[0].id).toBe('dose|levo|2026-10-29T06:30');
    expect(proximosLembretes(s, em('2026-10-29T07:01'))[0].id).toBe('dose|levo|2026-10-30T06:30');
  });

  it('não lembra dose já registrada', () => {
    const s = estado({
      remedios: [remedio({ horarios: ['21:00'] })],
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
        remedio({ id: 'd', fim: '2026-10-29' }),
        remedio({ id: 'e', inicio: '2026-10-30' }),
      ],
    });
    expect(proximosLembretes(s, em('2026-10-29T08:00')).map((x) => x.id)).toEqual([
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
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL. `Failed to resolve import "./lembretes"` (o arquivo ainda não existe).

- [ ] **Step 4: Implementar `src/data/lembretes.ts`**

```ts
// Lembretes: transforma o estado nos avisos das próximas horas.
// Função pura (sem React nem Tauri), testada em lembretes.test.ts.
// O Rust recebe a lista e mostra cada aviso na hora (src-tauri/src/lembretes.rs).

import type { State } from './store';
import type { Pessoa } from './types';

export interface Lembrete {
  id: string;      // "dose|<remedioId>|<previstoPara>" ou "consulta|<id>|<antecedência>"
  quando: string;  // hora local "2026-10-29T21:00"
  titulo: string;
  corpo: string;
  acoes: boolean;  // Tomei / Lembrar em 15 min / Pular esta dose
}

/** Rótulos do campo "Lembrar" da consulta (M18) → minutos antes. */
const ANTECEDENCIA_MIN: Record<string, number> = { '2 h antes': 120, '1 dia antes': 1440, '1 semana': 10080 };

/** Quem abre o app logo depois do horário ainda recebe o aviso. Mais antigo que isso fica só no Início. */
const ATRASO_MAX_MIN = 30;

const dois = (n: number) => String(n).padStart(2, '0');
const texto = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
const data = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const [hh, mm] = s.length > 10 ? s.slice(11, 16).split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm);
};
const somarMin = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);
const diasEntre = (a: string, b: string) => Math.round((data(b.slice(0, 10)).getTime() - data(a.slice(0, 10)).getTime()) / 86_400_000);
const doDa = (p?: Pessoa) => (p?.sexo === 'Feminino' ? 'da' : 'do');

export function proximosLembretes(s: State, agora: Date, horas = 24): Lembrete[] {
  const ini = texto(somarMin(agora, -ATRASO_MAX_MIN));
  const fim = texto(somarMin(agora, horas * 60));
  const esconder = s.config.esconderNomeNotif;
  const out: Lembrete[] = [];

  const dias: string[] = [];
  for (let d = data(ini.slice(0, 10)); texto(d).slice(0, 10) <= fim.slice(0, 10); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    dias.push(texto(d).slice(0, 10));
  }

  for (const r of s.remedios) {
    if (!r.ativo || !r.lembrete || r.seNecessario) continue;
    const p = s.pessoas.find((x) => x.id === r.pessoaId);
    const nome = p?.curto ?? '';
    for (const dia of dias) {
      if ((r.inicio && dia < r.inicio) || (r.fim && dia > r.fim)) continue;
      for (const h of r.horarios) {
        const quando = `${dia}T${h}`;
        if (quando < ini || quando > fim) continue;
        if (s.doses.some((x) => x.remedioId === r.id && x.previstoPara === quando)) continue;
        out.push({
          id: `dose|${r.id}|${quando}`,
          quando,
          titulo: esconder ? `Hora do remédio ${doDa(p)} ${nome}` : `${r.nome} · ${nome}`,
          corpo: esconder ? `Abra para ver qual. 1 dose às ${h}.` : `${r.doseLonga ?? r.dose} às ${h}.`,
          acoes: true,
        });
      }
    }
  }

  const agoraTxt = texto(agora);
  for (const c of s.consultas) {
    const hora = `${c.data}T${c.hora}`;
    if (hora <= agoraTxt) continue;
    for (const rotulo of c.lembretes) {
      const min = ANTECEDENCIA_MIN[rotulo];
      if (min === undefined) continue;
      const quando = texto(somarMin(data(hora), -min));
      if (quando < ini || quando > fim) continue;
      const n = diasEntre(quando, c.data);
      const dia = n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
      out.push({
        id: `consulta|${c.id}|${rotulo}`,
        quando,
        titulo: `${c.titulo} ${dia} às ${c.hora}`,
        corpo: [c.profissional, c.local].filter(Boolean).join(' · '),
        acoes: false,
      });
    }
  }

  return out.sort((a, b) => a.quando.localeCompare(b.quando));
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: PASS, 8 testes.

- [ ] **Step 6: Conferir os tipos**

Run: `npm run build`
Expected: sem erros. O `tsc -b` inclui `src/**`, então o arquivo de teste também é checado. Se reclamar de `vitest` sem tipos, ele já traz os próprios e nada mais é necessário.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/data/lembretes.ts src/data/lembretes.test.ts
git commit -m "Lembretes: calcular doses e consultas das próximas 24 h"
```

---

### Task 2: Fila de lembretes no Rust (lógica pura, com testes)

**Files:**
- Create: `src-tauri/src/lembretes.rs`
- Modify: `src-tauri/src/lib.rs:1-3` (declarar `mod lembretes;`)

**Interfaces:**
- Consumes: o formato do `Lembrete` da Task 1 (JSON `{ id, quando, titulo, corpo, acoes }`).
- Produces (usado na Task 3):
  - `pub struct Lembrete { pub id, pub quando, pub titulo, pub corpo: String, pub acoes: bool }` (Deserialize, Clone)
  - `pub struct Agendador`, com `Agendador::novo() -> Arc<Agendador>`, `fn substituir(&self, lista: Vec<Lembrete>)`, `fn adiar(&self, id: &str)` e `fn rodar(self: Arc<Self>, mostrar: impl Fn(Lembrete) + Send + 'static)`.
  - Id do adiamento: `<id original>|adiado`.

- [ ] **Step 1: Escrever o módulo com os testes e a fila ainda vazia**

Criar `src-tauri/src/lembretes.rs`:

```rust
//! Lembretes: o front manda a lista das próximas horas (src/data/lembretes.ts) e
//! aqui uma thread espera cada horário e chama a notificação (notificacao.rs).
//! A lista fica só em memória; nada disso vai para o disco.

use chrono::{Duration, Local, NaiveDateTime};
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::{Arc, Condvar, Mutex};

const ADIADO: &str = "|adiado";
const ADIAR_MIN: i64 = 15;
/// Acorda pelo menos a cada minuto (suspensão do PC, troca de relógio).
const ESPERA_MAX: std::time::Duration = std::time::Duration::from_secs(60);

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Lembrete {
    pub id: String,
    pub quando: String,
    pub titulo: String,
    pub corpo: String,
    pub acoes: bool,
}

#[derive(Default)]
pub struct Fila {
    itens: Vec<Lembrete>,
    mostrados: HashSet<String>,
}

impl Fila {
    pub fn substituir(&mut self, _lista: Vec<Lembrete>) {}
    pub fn vencidos(&mut self, _agora: NaiveDateTime) -> Vec<Lembrete> { vec![] }
    pub fn proximo(&self) -> Option<NaiveDateTime> { None }
    pub fn adiar(&mut self, _id: &str, _agora: NaiveDateTime) -> bool { false }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn l(id: &str, quando: &str) -> Lembrete {
        Lembrete { id: id.into(), quando: quando.into(), titulo: "t".into(), corpo: "c".into(), acoes: true }
    }
    fn t(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").unwrap()
    }
    fn ids(v: &[Lembrete]) -> Vec<&str> {
        v.iter().map(|x| x.id.as_str()).collect()
    }

    #[test]
    fn mostra_na_hora_e_uma_vez_so() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00"), l("b", "2026-10-29T22:00")]);
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:00")));
        assert!(f.vencidos(t("2026-10-29T20:59")).is_empty());
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:00"))), ["a"]);
        assert!(f.vencidos(t("2026-10-29T21:05")).is_empty());
        assert_eq!(f.proximo(), Some(t("2026-10-29T22:00")));
    }

    #[test]
    fn lista_nova_nao_repete_o_que_ja_apareceu() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        f.vencidos(t("2026-10-29T21:00"));
        f.substituir(vec![l("a", "2026-10-29T21:00"), l("b", "2026-10-29T21:30")]);
        assert!(f.vencidos(t("2026-10-29T21:10")).is_empty());
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:30")));
    }

    #[test]
    fn adiar_volta_em_15_min_e_cai_quando_a_dose_e_marcada() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        f.vencidos(t("2026-10-29T21:00"));
        assert!(f.adiar("a", t("2026-10-29T21:02")));
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:17")));
        // A lista nova (a dose ainda não foi marcada) não derruba o adiamento.
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:17")));
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:17"))), ["a|adiado"]);
        // Adiar de novo, a partir da notificação adiada.
        assert!(f.adiar("a|adiado", t("2026-10-29T21:18")));
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:33")));
        // Dose marcada no app: o lembrete sai da lista e o adiamento vai junto.
        f.substituir(vec![]);
        assert_eq!(f.proximo(), None);
    }

    #[test]
    fn adiar_lembrete_desconhecido_nao_faz_nada() {
        let mut f = Fila::default();
        assert!(!f.adiar("x", t("2026-10-29T21:00")));
        assert_eq!(f.proximo(), None);
    }

    #[test]
    fn ignora_hora_invalida() {
        let mut f = Fila::default();
        f.substituir(vec![l("x", "amanhã")]);
        assert_eq!(f.proximo(), None);
        assert!(f.vencidos(t("2030-01-01T00:00")).is_empty());
    }
}
```

Em `src-tauri/src/lib.rs`, a lista de módulos fica:

```rust
mod backup;
mod banco;
mod cripto;
mod lembretes;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && ~/.cargo/bin/cargo test lembretes`
Expected: FAIL em `mostra_na_hora_e_uma_vez_so`, `lista_nova_nao_repete_o_que_ja_apareceu` e `adiar_volta_em_15_min…`. Avisos de `dead_code` são esperados até a Task 3.

- [ ] **Step 3: Implementar a fila e o agendador**

Em `src-tauri/src/lembretes.rs`, trocar o `impl Fila { … }` provisório por:

```rust
fn hora(l: &Lembrete) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(&l.quando, "%Y-%m-%dT%H:%M").ok()
}

fn base(id: &str) -> &str {
    id.strip_suffix(ADIADO).unwrap_or(id)
}

impl Fila {
    /// Troca a lista inteira. Um adiamento continua enquanto o lembrete original
    /// estiver na lista; se a dose foi marcada no app, os dois saem juntos.
    pub fn substituir(&mut self, lista: Vec<Lembrete>) {
        let ids: HashSet<String> = lista.iter().map(|l| l.id.clone()).collect();
        let adiados: Vec<Lembrete> = self.itens.drain(..).filter(|l| l.id.ends_with(ADIADO) && ids.contains(base(&l.id))).collect();
        self.itens = lista.into_iter().filter(|l| hora(l).is_some()).chain(adiados).collect();
        let vivos: HashSet<&str> = self.itens.iter().map(|l| l.id.as_str()).collect();
        self.mostrados.retain(|id| vivos.contains(id.as_str()));
    }

    /// Lembretes cuja hora chegou e que ainda não apareceram. Já saem marcados como mostrados.
    pub fn vencidos(&mut self, agora: NaiveDateTime) -> Vec<Lembrete> {
        let out: Vec<Lembrete> = self
            .itens
            .iter()
            .filter(|l| !self.mostrados.contains(&l.id) && hora(l).map_or(false, |t| t <= agora))
            .cloned()
            .collect();
        for l in &out {
            self.mostrados.insert(l.id.clone());
        }
        out
    }

    /// Hora do próximo lembrete que ainda não apareceu.
    pub fn proximo(&self) -> Option<NaiveDateTime> {
        self.itens.iter().filter(|l| !self.mostrados.contains(&l.id)).filter_map(hora).min()
    }

    /// "Lembrar em 15 min": uma cópia do lembrete volta daqui a 15 minutos.
    pub fn adiar(&mut self, id: &str, agora: NaiveDateTime) -> bool {
        let b = base(id).to_string();
        let Some(orig) = self.itens.iter().find(|l| l.id == id || l.id == b).cloned() else {
            return false;
        };
        let novo = format!("{b}{ADIADO}");
        self.itens.retain(|l| l.id != novo);
        self.mostrados.remove(&novo);
        let quando = (agora + Duration::minutes(ADIAR_MIN)).format("%Y-%m-%dT%H:%M").to_string();
        self.itens.push(Lembrete { id: novo, quando, ..orig });
        true
    }
}

fn agora() -> NaiveDateTime {
    Local::now().naive_local()
}

/// A fila com o relógio de verdade, compartilhada entre o comando e a thread.
pub struct Agendador {
    fila: Mutex<Fila>,
    sinal: Condvar,
}

impl Agendador {
    pub fn novo() -> Arc<Self> {
        Arc::new(Self { fila: Mutex::new(Fila::default()), sinal: Condvar::new() })
    }

    pub fn substituir(&self, lista: Vec<Lembrete>) {
        if let Ok(mut f) = self.fila.lock() {
            f.substituir(lista);
        }
        self.sinal.notify_one();
    }

    pub fn adiar(&self, id: &str) {
        if let Ok(mut f) = self.fila.lock() {
            f.adiar(id, agora());
        }
        self.sinal.notify_one();
    }

    /// Roda para sempre, numa thread própria. `mostrar` é chamado sem a fila travada.
    pub fn rodar(self: Arc<Self>, mostrar: impl Fn(Lembrete) + Send + 'static) {
        let Ok(mut f) = self.fila.lock() else { return };
        loop {
            let vencidos = f.vencidos(agora());
            if !vencidos.is_empty() {
                drop(f);
                for l in vencidos {
                    mostrar(l);
                }
                let Ok(g) = self.fila.lock() else { return };
                f = g;
                continue;
            }
            let espera = f
                .proximo()
                .map(|t| (t - agora()).to_std().unwrap_or_default())
                .unwrap_or(ESPERA_MAX)
                .min(ESPERA_MAX);
            let Ok((g, _)) = self.sinal.wait_timeout(f, espera) else { return };
            f = g;
        }
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd src-tauri && ~/.cargo/bin/cargo test`
Expected: PASS, 11 testes (os 6 antigos e os 5 novos). Os avisos de `dead_code` em `Agendador` somem na Task 3.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lembretes.rs src-tauri/src/lib.rs
git commit -m "Lembretes: fila com adiamento de 15 min no Rust"
```

---

### Task 3: Notificação do Windows e comando `agendar_lembretes`

**Files:**
- Modify: `src-tauri/Cargo.toml` (dependências só do Windows)
- Create: `src-tauri/src/notificacao.rs`
- Modify: `src-tauri/src/lib.rs` (módulo, comando, `setup`, `invoke_handler`)

**Interfaces:**
- Consumes: `lembretes::{Agendador, Lembrete}` (Task 2).
- Produces:
  - O comando Tauri `agendar_lembretes { lista: Lembrete[] } -> ()`.
  - O evento Tauri `lembrete-acao`, com payload `{ id: string, acao: 'tomada' | 'pulada' }`.
  - O clique no corpo da notificação foca a janela `main` e não emite nada.

- [ ] **Step 1: Dependências**

Em `src-tauri/Cargo.toml`, logo depois do bloco `[target.'cfg(any(windows, target_os = "macos"))'.dependencies]`:

```toml
# Notificações do Windows com botões (Tomei / 15 min / Pular).
[target.'cfg(windows)'.dependencies]
tauri-winrt-notification = "0.8"
windows-registry = "0.6"
```

- [ ] **Step 2: Criar `src-tauri/src/notificacao.rs`**

```rust
//! Notificação do sistema para um lembrete. No Windows: notificação nativa com
//! os botões Tomei / Lembrar em 15 min / Pular esta dose (M15). Nos outros
//! sistemas, por enquanto, só registra no terminal.

use crate::lembretes::{Agendador, Lembrete};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// Mesmo valor do `identifier` em tauri.conf.json.
#[cfg_attr(not(windows), allow(dead_code))]
const APP_ID: &str = "br.familia.arquivosaude";

#[derive(Clone, Serialize)]
struct Acao {
    id: String,
    acao: String,
}

/// Registra o app no Windows (HKCU, sem administrador) para as notificações
/// aparecerem como "Arquivo da família". Vale também para `npm run app:dev`.
#[cfg(windows)]
pub fn registrar() {
    use windows_registry::CURRENT_USER;
    if let Ok(k) = CURRENT_USER.create(format!(r"SOFTWARE\Classes\AppUserModelId\{APP_ID}")) {
        let _ = k.set_string("DisplayName", "Arquivo da família");
    }
}

#[cfg(not(windows))]
pub fn registrar() {}

fn focar(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg(windows)]
pub fn mostrar(app: &AppHandle, ag: &Arc<Agendador>, l: Lembrete) {
    use tauri::Emitter;
    use tauri_winrt_notification::{Scenario, Toast};

    let (app2, ag2, id) = (app.clone(), ag.clone(), l.id.clone());
    let mut t = Toast::new(APP_ID).title(&l.titulo).text1(&l.corpo);
    if l.acoes {
        t = t
            .scenario(Scenario::Reminder)
            .add_button("Tomei", "tomada")
            .add_button("Lembrar em 15 min", "adiar")
            .add_button("Pular esta dose", "pulada");
    }
    let t = t.on_activated(move |acao| {
        match acao.as_deref() {
            Some("adiar") => ag2.adiar(&id),
            Some(a @ ("tomada" | "pulada")) => {
                let _ = app2.emit("lembrete-acao", Acao { id: id.clone(), acao: a.into() });
            }
            _ => focar(&app2),
        }
        Ok(())
    });
    if let Err(e) = t.show() {
        eprintln!("notificação não mostrada: {e}");
    }
}

#[cfg(not(windows))]
pub fn mostrar(_app: &AppHandle, _ag: &Arc<Agendador>, l: Lembrete) {
    eprintln!("lembrete: {} — {}", l.titulo, l.corpo);
}
```

Fora do Windows, `Acao` e `focar` ficam sem uso. Acrescente `#[cfg_attr(not(windows), allow(dead_code))]` acima de `struct Acao` e de `fn focar` para não gerar aviso.

- [ ] **Step 3: Ligar no `lib.rs`**

Módulos:

```rust
mod backup;
mod banco;
mod cripto;
mod lembretes;
mod notificacao;
```

Trocar `use std::sync::Mutex;` por:

```rust
use std::sync::{Arc, Mutex};
```

Acrescentar o comando antes de `#[cfg_attr(mobile, tauri::mobile_entry_point)]`:

```rust
// ── Lembretes ───────────────────────────────────────────────────────────────

#[tauri::command]
async fn agendar_lembretes(lista: Vec<lembretes::Lembrete>, ag: State<'_, Arc<lembretes::Agendador>>) -> R<()> {
    ag.substituir(lista);
    Ok(())
}
```

No `setup`, antes do `Ok(())` final:

```rust
            notificacao::registrar();
            let ag = lembretes::Agendador::novo();
            app.manage(ag.clone());
            let (handle, ag2) = (app.handle().clone(), ag.clone());
            std::thread::spawn(move || ag.rodar(move |l| notificacao::mostrar(&handle, &ag2, l)));
```

No `invoke_handler`, depois de `apagar_tudo`:

```rust
            apagar_tudo,
            agendar_lembretes
```

- [ ] **Step 4: Compilar e testar**

Run: `cd src-tauri && ~/.cargo/bin/cargo test`
Expected: compila no Windows e passa os 11 testes, sem avisos de `dead_code` do módulo de lembretes.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/notificacao.rs src-tauri/src/lib.rs
git commit -m "Lembretes: notificação do Windows com Tomei / 15 min / Pular"
```

---

### Task 4: Ligar o front ao agendador

**Files:**
- Modify: `src/data/persistencia.ts` (interface `Persistencia`, `tauri()`, `memoria()`)
- Modify: `src/data/store.tsx:207-210` (`marcarDose` aceita o dia) e `StoreProvider` (chama o hook)
- Create: `src/data/useLembretes.ts`

**Interfaces:**
- Consumes: `proximosLembretes`, `Lembrete` (Task 1). O comando `agendar_lembretes` e o evento `lembrete-acao` (Task 3).
- Produces:
  - `persistencia.agendarLembretes(lista: Lembrete[]): Promise<void>`
  - `api.marcarDose(remedioId, horario, status = 'tomada', dia = HOJE)`. Os chamadores atuais não mudam.
  - `useLembretes(state: State, pronto: boolean, marcarDose)`

- [ ] **Step 1: `persistencia.ts`**

No topo, junto do outro import:

```ts
import type { Lembrete } from './lembretes';
```

Na interface `Persistencia`, depois de `apagarTudo(): Promise<void>;`:

```ts
  /** Substitui os lembretes agendados no sistema (só em memória no Rust). */
  agendarLembretes(lista: Lembrete[]): Promise<void>;
```

Em `tauri()`, depois de `apagarTudo: () => call('apagar_tudo'),`:

```ts
    agendarLembretes: (lista) => call('agendar_lembretes', { lista }),
```

Em `memoria()`, depois da linha de `apagarTudo`:

```ts
    agendarLembretes: async () => {},
```

- [ ] **Step 2: `marcarDose` com o dia**

Em `src/data/store.tsx`, trocar:

```ts
      marcarDose(remedioId: string, horario: string, status: Dose['status'] = 'tomada') {
        const agora = new Date();
        const registradoEm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
        const previstoPara = `${HOJE}T${horario}`;
```

por:

```ts
      /** `dia` vem da notificação, que pode ser de ontem (lembrete das 23:45 respondido à 00:10). */
      marcarDose(remedioId: string, horario: string, status: Dose['status'] = 'tomada', dia = HOJE) {
        const agora = new Date();
        const registradoEm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
        const previstoPara = `${dia}T${horario}`;
```

- [ ] **Step 3: Criar `src/data/useLembretes.ts`**

```ts
// Liga o estado aos lembretes do sistema. Só no app instalado: no navegador e
// nos dados de exemplo nada é agendado (a M15 continua sendo a simulação).

import { useEffect, useRef, useState } from 'react';
import { EM_TAURI } from './tempo';
import { persistencia } from './persistencia';
import { proximosLembretes } from './lembretes';
import type { State } from './store';
import type { Dose } from './types';

type MarcarDose = (remedioId: string, horario: string, status: Dose['status'], dia: string) => void;

export function useLembretes(state: State, pronto: boolean, marcarDose: MarcarDose) {
  // A lista cobre 24 h; recalcular a cada hora mantém a janela andando.
  const [hora, setHora] = useState(() => new Date().getHours());
  useEffect(() => {
    if (!EM_TAURI) return;
    const t = window.setInterval(() => setHora(new Date().getHours()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!EM_TAURI || !pronto) return;
    persistencia.agendarLembretes(proximosLembretes(state, new Date())).catch((e) => console.error('lembretes:', e));
  }, [state, pronto, hora]);

  // Tomei / Pular na notificação. Funciona com o app bloqueado, como na M15.
  const ref = useRef({ state, marcarDose });
  ref.current = { state, marcarDose };
  useEffect(() => {
    if (!EM_TAURI) return;
    let vivo = true;
    let parar: (() => void) | undefined;
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ id: string; acao: 'tomada' | 'pulada' }>('lembrete-acao', ({ payload }) => {
          const [tipo, remedioId, previstoPara] = payload.id.split('|');
          if (tipo !== 'dose' || !remedioId || !previstoPara) return;
          // Já marcada no app (notificação antiga clicada depois): não registra de novo.
          if (ref.current.state.doses.some((d) => d.remedioId === remedioId && d.previstoPara === previstoPara)) return;
          ref.current.marcarDose(remedioId, previstoPara.slice(11), payload.acao, previstoPara.slice(0, 10));
        }),
      )
      .then((u) => {
        if (vivo) parar = u;
        else u();
      })
      .catch((e) => console.error('lembretes:', e));
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);
}
```

- [ ] **Step 4: Chamar no `StoreProvider`**

Em `src/data/store.tsx`, junto dos imports:

```ts
import { useLembretes } from './useLembretes';
```

No `StoreProvider`, logo depois de `const api = useApi(state, dispatch, mostrarToast);`:

```ts
  useLembretes(state, status === 'pronto', api.marcarDose);
```

- [ ] **Step 5: Conferir build e testes**

Run: `npm run build && npm test`
Expected: sem erros de tipo e 8 testes passando.

- [ ] **Step 6: Teste rápido no app nativo**

Run: `npm run app:dev` (em background), com a janela aberta:
1. Cadastre um remédio para você com o lembrete ligado e um horário 2 minutos à frente.
2. Na hora, aparece a notificação "Hora do remédio do/da {seu nome}" com os três botões.
3. **Tomei**: o Início mostra a dose marcada e o estoque desce 1.

Expected: tudo acima acontece. Se a notificação não aparecer, confira em Configurações do Windows › Sistema › Notificações se "Arquivo da família" aparece e está ligado.

- [ ] **Step 7: Commit**

```bash
git add src/data/persistencia.ts src/data/store.tsx src/data/useLembretes.ts
git commit -m "Lembretes: agendar a partir do estado e responder Tomei / Pular"
```

---

### Task 5: Virada do dia com o app aberto

**Files:**
- Modify: `src/data/tempo.ts` (exportar `iso`)
- Create: `src/data/useViradaDoDia.ts`
- Modify: `src/data/store.tsx` (`StoreProvider` chama o hook)

**Interfaces:**
- Consumes: `HOJE`, `MODO_REAL` e `iso` de `tempo.ts`.
- Produces: `useViradaDoDia(): void`

- [ ] **Step 1: Exportar `iso`**

Em `src/data/tempo.ts`, trocar:

```ts
const iso = (d: Date) =>
```

por:

```ts
export const iso = (d: Date) =>
```

- [ ] **Step 2: Criar `src/data/useViradaDoDia.ts`**

```ts
// No app real, HOJE é fixado ao abrir. Se o app ficar aberto de um dia para o
// outro, a janela recarrega para tudo (Início, adesão, lembretes) usar a data
// nova. Espera 2 min sem uso para não perder um formulário pela metade.
// O agendador no Rust continua rodando e recebe a lista de novo ao recarregar.

import { useEffect } from 'react';
import { HOJE, MODO_REAL, iso } from './tempo';

export function useViradaDoDia() {
  useEffect(() => {
    if (!MODO_REAL) return;
    let ultimoUso = Date.now();
    const usou = () => {
      ultimoUso = Date.now();
    };
    window.addEventListener('pointerdown', usou);
    window.addEventListener('keydown', usou);
    const t = window.setInterval(() => {
      if (iso(new Date()) !== HOJE && Date.now() - ultimoUso > 120_000) location.reload();
    }, 60_000);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pointerdown', usou);
      window.removeEventListener('keydown', usou);
    };
  }, []);
}
```

- [ ] **Step 3: Chamar no `StoreProvider`**

Em `src/data/store.tsx`, junto dos imports:

```ts
import { useViradaDoDia } from './useViradaDoDia';
```

No `StoreProvider`, logo depois de `useLembretes(...)`:

```ts
  useViradaDoDia();
```

- [ ] **Step 4: Conferir**

Run: `npm run build && npm test`
Expected: sem erros e 8 testes passando.

Conferência manual no navegador com `http://localhost:1420/?persistir=1`: no console, `localStorage` intacto e nenhum recarregamento durante o uso normal. A virada em si só é testável mudando o relógio do Windows; isso fica opcional.

- [ ] **Step 5: Commit**

```bash
git add src/data/tempo.ts src/data/useViradaDoDia.ts src/data/store.tsx
git commit -m "Recarregar na virada do dia quando o app fica aberto"
```

---

### Task 6: Verificação no Windows e documentação

**Files:**
- Modify: `README.md` (seção "Estado atual")
- Modify: `docs/HISTORICO.md` (linha do tempo, verificado, próximo passo)
- Modify: `docs/ARQUITETURA.md` (marco 1 dos próximos marcos → feito no desktop)
- Modify: `CLAUDE.md` (próximos marcos, comando `npm test`)

- [ ] **Step 1: Roteiro manual no `npm run app:dev`**

Com um remédio seu, lembrete ligado e horário 2 min à frente, e uma consulta com "2 h antes" daqui a 2 h e 2 min:

| # | Ação | Esperado |
|---|---|---|
| 1 | Esperar o horário com a janela **minimizada** | Notificação com os 3 botões; ela fica na tela até alguém responder. |
| 2 | **Lembrar em 15 min** | Some; volta 15 min depois com o mesmo texto. |
| 3 | **Pular esta dose** | O Início mostra a dose como pulada; o estoque não muda. |
| 4 | Outra dose: marcar **Tomei no app** antes do horário | Nenhuma notificação aparece. |
| 5 | Notificação com o app **bloqueado** → Tomei | Dose registrada; o app continua bloqueado. |
| 6 | Clicar no **corpo** da notificação | A janela volta para a frente. |
| 7 | "Esconder nome do remédio" desligado | O título mostra "{remédio} · {nome}". |
| 8 | Consulta | "Cardiologista hoje às HH:MM" sem botões, 2 h antes. |

Anote o que falhar e corrija antes de seguir.

- [ ] **Step 2: Instalador**

Run: `npm run app:build`. Instale o `.exe` de `src-tauri/target/release/bundle/nsis/` e repita os passos 1 e 3 no app instalado.
Expected: a notificação aparece com o nome "Arquivo da família".

- [ ] **Step 3: Documentação**

`README.md`, na seção "Estado atual", trocar o título por `## Estado atual (marco 3)` e acrescentar este item à lista:

```markdown
- **Lembretes (Windows)**: notificação do sistema na hora de cada dose, com Tomei / Lembrar em 15 min / Pular esta dose, e lembrete de consultas (2 h, 1 dia ou 1 semana antes). Só com o app aberto (pode estar minimizado). Respeita "Esconder nome do remédio".
```

Na linha "**Ainda não:**", tirar "notificações do sistema" e pôr "lembretes no Android".

Ainda no `README.md`, em "Rodar no navegador", acrescentar depois do bloco de comandos:

```markdown
Testes do front (cálculo dos lembretes): `npm test`.
```

`docs/HISTORICO.md`:
- Na "Linha do tempo", acrescentar `3. **Marco 3**: lembretes no Windows (doses com Tomei / 15 min / Pular, consultas), recarga na virada do dia. Spec e plano em docs/superpowers/.`
- Em "O que foi verificado", registrar o resultado do roteiro do Step 1 e do instalador.
- Em "Próximo passo sugerido", trocar o item 3 por `3. Marco Android ou atualizações via GitHub Releases.`

`docs/ARQUITETURA.md`, em "Próximos marcos", trocar o item 1 por:

```markdown
1. **Lembretes**: feito no desktop (marco 3, ver `docs/superpowers/specs/2026-10-29-lembretes-design.md`). Falta o Android: o mesmo comando `agendar_lembretes` passa a usar o AlarmManager, com as ações nativas da M15.
```

`CLAUDE.md`, em "Comandos", acrescentar depois da linha do `npm run build`:

```markdown
- `npm test` — testes do front (Vitest), hoje o cálculo dos lembretes.
```

Em "Próximos marcos", trocar o item 1 por `1. Lembretes no Android (desktop feito no marco 3).`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/HISTORICO.md docs/ARQUITETURA.md CLAUDE.md
git commit -m "Marco 3: documentação dos lembretes"
```
