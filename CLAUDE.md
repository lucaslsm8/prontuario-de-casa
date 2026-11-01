# Prontuário de Casa — guia para o Claude Code

App pessoal de saúde da família (Windows/desktop + Android, sem iOS). UI em **pt-BR**. Dados só no aparelho, cifrados.
Stack: Tauri 2 (Rust) + React 18 + TypeScript + Vite. Leia também `README.md` e `docs/ARQUITETURA.md`.

## Comandos

- `npm install` — dependências do front.
- `npm run dev` — navegador em http://localhost:1420 com **dados de exemplo** dos mockups (hoje fixo = 28/10/2026). `?persistir=1` testa o modo real no navegador (sem criptografia, só para desenvolvimento).
- `npm run build` — `tsc -b` + build do Vite. Rode sempre depois de mudar TypeScript.
- `npm run app:dev` / `npm run app:build` — app nativo / instaladores `.exe` e `.msi` em `src-tauri/target/release/bundle/`.
- `cd src-tauri && cargo test` — testes de criptografia, banco e backup.

## Design (fidelidade hi-fi)

- Referência: `docs/design/Arquivo de Saude Familiar.dc.html` (abrir no navegador; 23 telas mobile M01–M23 + 8 desktop D01–D08) e `docs/design/HANDOFF.md` (tokens, comportamento, modelo de dados).
- Cores, raios, sombras e tipografia estão em `src/styles/tokens.css`. Use as variáveis, não valores soltos.
- Textos da interface em pt-BR exatamente como nos mockups. Datas `DD/MM/AAAA`, números `1,74 m`, `R$ 1.240,00`.
- Fontes IBM Plex Sans/Mono empacotadas localmente (`@fontsource`), nada de CDN (o app é offline).
- Em `npm run dev`, a barra no canto inferior esquerdo ("Telas") abre cada tela pelo ID do mockup. Use-a para comparar com a referência.
- Ícones: só na navegação e nas ações do cartão da dose (`src/ui/Icones.tsx`, traço 1,8). Nada de ícones nas listas. O cadeado antigo continua em divs (`<Lock />`).
- Redesign "cartão escuro" (30/10/2026, `docs/superpowers/specs/2026-10-30-redesign-design.md`): raios menores, Início com cartão da dose, linha do dia e "Remédio acabando" (`src/ui/Inicio.tsx`, lógica em `src/data/inicio.ts`). As outras telas ainda não ganharam o novo layout.

## Arquitetura

- `src/data/store.tsx`: estado = projeção de um **log de eventos**. Toda mudança passa por `api.*` → `emitir()` → evento `{ id, em, autor, tipo, dados }` gravado via `persistencia.gravar` e aplicado pelo `reducer`. Não altere o estado por fora do reducer. Doses e "desfazer" são eventos novos (append-only).
- `src/data/persistencia.ts`: no app instalado chama os comandos Rust (`invoke`); no navegador usa memória/localStorage.
- `src/data/tempo.ts`: `MODO_REAL` (Tauri ou `?persistir`) × `MODO_EXEMPLO` (navegador). `HOJE` vem daqui. `ex(exemplo, real)` só pré-preenche formulários nos dados de exemplo.
- Registros: `editarRegistro` / `removerRegistro` / `restaurarRegistro` (coleção + id) servem a remédios, consultas, exames, planos, vacinas e medições; `removerPessoa` leva tudo da pessoa. Anexos (fotos/PDF) são eventos `addAnexo` com data URL (cifrados, no backup). Medições, valores de exame (`Exame.resultados`), busca (`src/data/busca.ts`) e .ics (`src/data/ics.ts`) são funções puras com testes.
- `src/data/seed.ts`: dados de exemplo (Helena logada; Roberto compartilha tudo; Pedro só remédios e plano; pets Mel e Thor, ids `mel` e `thor`). Números de carteirinha, ANS e telefones são fictícios.
- Layout por largura: < 760 px = mobile (tab bar, `src/mobile/`), senão desktop (sidebar, `src/desktop/`). No desktop, os formulários abrem em diálogo próprio (`src/desktop/Formularios.tsx`) com a lógica em `src/data/formularios.ts` (`?abrir=consulta|remedio|exame|pessoa|pet|perfil:<id>|emergencia:<id>|vacina|prevencao|sintoma|procedimento|pesagem:<id>`).
- Componentes base em `src/ui/index.tsx` (Chip, Toggle, Segmented, Row, Bar, Pill…) e `src/ui/Backup.tsx` (folhas de senha, PIN e restaurar).
- Rust (`src-tauri/src/`):
  - `banco.rs`: SQLite com tabelas `eventos` e `kv`, cada valor cifrado com XChaCha20-Poly1305 (id como AAD).
  - `cripto.rs`: chave do aparelho no Gerenciador de Credenciais (Windows) / Keychain (macOS), em arquivo no Linux/Android. Argon2id para PIN e backup.
  - `backup.rs`: formato `.fsaude`.
  - `lib.rs`: comandos Tauri.
  - Comandos `async` (não travam a janela). Argumentos em uma palavra, respostas em camelCase.

## Regras

- Privacidade: nada vai para servidor de terceiros. Não adicione analytics, CDN ou chamadas de rede sem pedir.
  - Exceção pedida pelo usuário (31/10/2026): a **agenda conectada** baixa o endereço iCal que a pessoa colou (comando Rust `baixar_agenda`, só https), ao abrir o app e no botão "Atualizar agenda". Nada é enviado.
  - Exceção pedida pelo usuário (31/10/2026): **atualizações** (`src/data/atualizacao.ts`, `tauri-plugin-updater`) baixam o `latest.json` e o instalador do GitHub Releases (`lucaslsm8/prontuario-de-casa`), ao abrir (opção "Procurar ao abrir o app") e no botão. Assinatura conferida com a chave pública do `tauri.conf.json`; a privada fica fora do repo (`~/.tauri/prontuario-de-casa.key` e segredo do GitHub).
- Repositório público: dados de exemplo só com a família inventada (Almeida: Helena, Roberto, Pedro; pets Mel e Thor). Nunca commitar dados reais, backups `.fsaude`, bancos ou documentos pessoais.
- Nunca grave dados de saúde em claro no disco. Novos dados persistentes entram como evento (front) ou `kv` cifrado (Rust).
- Ações destrutivas sempre com confirmação. "Apagar tudo" exige digitar APAGAR.
- Transições: 150–200 ms ease-out (`var(--t)`, `var(--ease)`).
- Alvo de toque mínimo de 44 px no mobile.

## Próximos marcos (ver docs/ARQUITETURA.md)

1. Lembretes (notificações do sistema; ações Tomei / 15 min / Pular).
2. Atualizações no Android (APK). No desktop já funcionam: `npm run app:build` (script `scripts/app-build.mjs`) e tag `v*` → `.github/workflows/release.yml`.
3. Android (`npm run tauri android init`, Keystore, biometria).
4. Sincronização entre aparelhos (log de eventos + LAN/Noise + pasta sincronizada com `age`).
5. Visual V1 nas telas que ainda têm o layout antigo (Pessoa, Planos, Privacidade, telas do celular).

Lista de melhorias e o que já foi feito: `docs/melhorias.md`.
