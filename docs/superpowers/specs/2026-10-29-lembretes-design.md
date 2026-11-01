# Marco 3 — Lembretes no Windows

Aprovado em 29/10/2026. Escopo: **só desktop Windows**. O Android usa o mesmo contrato no marco Android.

## Decisões

| Pergunta | Escolha |
|---|---|
| Ao fechar a janela | O app **encerra**. Lembretes só com o app aberto (pode estar minimizado). Sem bandeja e sem abrir com o Windows. |
| Responder a dose | **Botões na notificação**: Tomei / Lembrar em 15 min / Pular esta dose (M15). Clicar no corpo foca a janela. |
| O que lembra | Doses e consultas/exames. Estoque baixo fica para depois. |
| De quem | Remédios cadastrados neste aparelho, de qualquer pessoa. Sem sincronização, hoje isso é tudo o que está no aparelho. Quando a sincronização existir, remédios recebidos de outra pessoa não lembram aqui. |
| Arquitetura | Front calcula, Rust agenda e mostra (abaixo). |

Descartados: `setTimeout` no front (o WebView2 atrasa timers com a janela minimizada e não serve no Android) e `tauri-plugin-notification` (no Windows não tem botões de ação).

## Arquitetura

```
estado (reducer) ──► lembretes.ts (função pura) ──► invoke('agendar_lembretes', { lista })
                                                         │
                                       Rust: thread do agendador (só memória)
                                                         │ na hora
                                          notificação do Windows (tauri-winrt-notification)
                                                         │ clique
                              evento 'lembrete-acao' { id, acao } ──► front ──► api.*
```

### 1. `src/data/lembretes.ts` (novo, sem React)

`proximosLembretes(state, agora: Date, horas = 24): Lembrete[]`

```ts
interface Lembrete {
  id: string;            // estável: `dose:<remedioId>:<previstoPara>` ou `consulta:<id>:<antecedencia>`
  quando: string;        // ISO local "2026-10-29T21:00"
  titulo: string;
  corpo: string;
  acoes: boolean;        // true = mostra Tomei / 15 min / Pular
}
```

Regras:
- **Dose**: remédio `ativo`, `lembrete`, sem `seNecessario`, dentro de `inicio`/`fim`. Um lembrete por horário em `[agora − 30 min, agora + horas]`, se ainda não houver dose registrada para esse `previstoPara`.
  - Os 30 min para trás cobrem quem abre o app logo depois do horário. Nada mais antigo vira aviso, porque as pendentes já aparecem no Início.
- **Consulta/exame**: para cada item de `lembretes[]` (`2 h antes`, `1 dia antes`, `1 semana`), `quando = data/hora − antecedência`, se estiver na janela. Sem ações.
- **Textos** (pt-BR, iguais à M15):
  - Esconder nome ligado: `Hora do remédio do {curto}` / `Abra para ver qual. 1 dose às {HH:MM}.`
  - Esconder nome desligado: `{nome} · {curto}` / `{doseLonga ?? dose} às {HH:MM}.`
  - Consulta: `{titulo} {hoje|amanhã|em 7 dias|DD/MM} às {HH:MM}` / `{profissional · local}`, omitindo o que faltar.

### 2. `src-tauri/src/lembretes.rs` (novo)

- O comando `agendar_lembretes(lista)` (async) **substitui** a lista inteira. A lista fica só em memória e nunca vai para o disco.
- Uma thread espera o próximo `quando` (com `Condvar`, para acordar quando a lista muda) e mostra a notificação. Ela marca o id como mostrado para não repetir.
- Lógica de "qual é o próximo e o que já foi mostrado" separada do relógio e da notificação, para testar com relógio falso.
- **Lembrar em 15 min**: o Rust reagenda o mesmo lembrete para agora + 15 min, sem evento no log. O id ganha o sufixo `:adiado` para não ser descartado pela próxima lista.
- **Tomei / Pular**: emite `lembrete-acao` `{ id, acao: 'tomada' | 'pulada' }` para o front. O clique no corpo emite `{ id, acao: 'abrir' }` e o Rust foca a janela.
- Notificação: `tauri-winrt-notification` (`add_button`, `on_activated`), com o app id = `identifier` (`br.familia.arquivosaude`) no app instalado e o id do PowerShell em `app:dev`.
- No Linux/macOS o comando existe e só registra no log, sem mostrar nada.

### 3. Front: `useLembretes()` em `src/data/store.tsx`

- Só em `MODO_REAL` com Tauri. No navegador e nos dados de exemplo não faz nada (a M15 continua sendo a simulação).
- Recalcula e chama `agendar_lembretes` quando o estado muda e a cada virada de hora.
- Ouve `lembrete-acao` e chama `api.marcarDose(remedioId, previstoPara, status)`. Funciona com o app bloqueado, como na M15 da tela bloqueada.
- Uma dose marcada no app some da próxima lista e o Rust descarta o lembrete pendente.

### Ajustes necessários no código atual

- `marcarDose` hoje monta `previstoPara` com `HOJE`, fixo ao carregar o módulo. Com o app aberto de um dia para o outro, isso erra a data. Mudança: aceitar o `previstoPara` completo (chamadores do Início continuam passando o horário de hoje) e calcular "hoje" na hora no modo real.
- `HOJE` no modo real precisa ser recalculado na virada do dia (o Início também se beneficia).

## Privacidade

- A lista de lembretes vive só em memória no Rust.
- O texto da notificação fica no Centro de Ações do Windows. Por isso "Esconder nome do remédio" vem ligado por padrão (já é assim).

## Testes

- `lembretes.ts`: horários do dia, janela de −30 min, dose já marcada some, remédio encerrado ou fora de `fim`, esconder nome ligado/desligado, consulta 2 h / 1 dia / 1 semana, virada de dia.
  - O projeto não tem test runner no front. Adicionar o `vitest` só como devDependency, rodando com `npm test`.
- `lembretes.rs`: próximo lembrete, substituição da lista, adiar 15 min, não repetir o já mostrado (relógio falso). Roda no `cargo test`.
- Manual no Windows (`app:dev` e instalador): os três botões, o clique no corpo, a dose marcada no app cancela o aviso, minimizado, bloqueado.

## Riscos

- O Windows só mostra notificação de app com AppUserModelID registrado. O instalador NSIS do Tauri cria o atalho com o `identifier`. Conferir no `.exe` instalado. Em `app:dev`, o app id do PowerShell serve.
- O "Não perturbe" do Windows segura as notificações. Isso é do sistema, e não vamos contornar.

## Fora deste marco

Android (AlarmManager), estoque baixo, bandeja e abrir com o Windows, som personalizado.
