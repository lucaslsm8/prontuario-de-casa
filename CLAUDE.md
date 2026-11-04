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
- Compartilhamento: quem nunca definiu o que compartilha (dependente sem aparelho, cadastrado por alguém) aparece com tudo para a família (`compartilhado` em `store.tsx`).
- Layout por largura: < 760 px = mobile (tab bar Início/Agenda/Remédios/Exames/Plano, `src/mobile/`). O celular funciona **por perfil** (`src/mobile/Perfil.tsx`): abre no de quem usa o aparelho, a foto no topo do Início troca (vale até fechar o app) e `EscopoPerfil` (`store.tsx`) entrega às telas só o recorte da pessoa (`recortarPerfil`); os formulários começam com ela em "De quem" (`perfil` do `useStore`). Família, perfis, configurações, busca e o detalhe de um registro pelo id (`/remedios/:id`, `/exames/:id`, `/consulta/…`) ficam sem recorte; do perfil de alguém, `useAbrirNoPerfil` troca o perfil antes de abrir a aba. No perfil de um pet, o Início é o perfil dele (`PetPerfil inicio`) e a aba Plano vira **Fotos** (`/fotos`). Engrenagem no topo do Início e no seletor levam a Configurações; lá ficam o menu inferior Texto/Ícones (`config.menuIcones`, por aparelho) e "Exportar perfil em PDF" (`src/data/relatorio.ts` + `src/data/pdfTexto.ts`, PDF escrito à mão, sem biblioteca; também no desktop em Privacidade). A Agenda tem a vista "Consultas" (lista com filtro, `src/data/consultas.ts`). Desktop é o painel da família toda; a aba Consultas (`src/desktop/Consultas.tsx`, filtro em `src/data/consultas.ts`) lista as consultas de todos, próximas e passadas, senão desktop (sidebar, `src/desktop/`). No desktop, os formulários abrem em diálogo próprio (`src/desktop/Formularios.tsx`) com a lógica em `src/data/formularios.ts` (`?abrir=consulta|remedio|exame|pessoa|pet|perfil:<id>|emergencia:<id>|vacina|prevencao|sintoma|procedimento|pesagem:<id>`).
- Fotos de perfil: `useEscolherFoto` abre o ajuste (`RecortarFoto` em `src/ui/Foto.tsx`: arrastar, pinça/roda/barra para zoom; recorte em `recorteDaVista`, `src/data/perfil.ts`).
- Vacinas editam e apagam: `useFormVacina(pet, onSalvo, vacina)`; celular `/pet/:id/vacina/:vid`, desktop `?abrir=editar-vacina:<id>`.
- Componentes base em `src/ui/index.tsx` (Chip, Toggle, Segmented, Row, Bar, Pill…) e `src/ui/Backup.tsx` (folhas de senha, PIN e restaurar).
- Rust (`src-tauri/src/`):
  - `banco.rs`: SQLite com tabelas `eventos` e `kv`, cada valor cifrado com XChaCha20-Poly1305 (id como AAD).
  - `cripto.rs`: chave do aparelho no Gerenciador de Credenciais (Windows) / Keychain (macOS), em arquivo no Linux/Android. Argon2id para PIN e backup.
  - `backup.rs`: formato `.fsaude`.
  - `epoca.rs`: "Remover aparelho" troca a chave da família (época nova), selada com X25519 + HKDF para cada aparelho que fica (`chaves/<época>/<id>.bin`); o marco `chaves/<base>/proxima.bin` vai por último e decide a sucessora. Chaves antigas no kv `chaves_antigas:<fid>`; pacotes da época e ≥ 1 em `eventos/<id>/<e>-<n>.bin`.
  - `lib.rs`: comandos Tauri.
  - Android: plugins Kotlin em `src-tauri/gen/android/app/src/main/java/br/familia/arquivosaude/` (`CofrePlugin`, `RedePlugin`, `InstaladorPlugin`, `LembretePlugin`, `QrPlugin` com ZXing para o QR do convite), cada um com um `*_android.rs`. `LembretePlugin.acaoPendente` entrega uma vez a ação da notificação (Tomei / 15 min / Pular) que abriu o app fechado: o `tauri-plugin-notification` dispara `actionPerformed` no `load`, antes do listener do JS, e a ação se perderia. `useLembretes` consulta na montagem e põe na mesma fila das outras ações.
  - Aparelhos (`store.tsx`, `case 'aparelho'` e `acaoDoEvento`): o evento `aparelho` só vale assinado pelo próprio aparelho, e a primeira `chavePublica` fica (TOFU). "Remover aparelho" exige token novo do GitHub.
  - Comandos `async` (não travam a janela). Argumentos em uma palavra, respostas em camelCase.

## Regras

- Privacidade: nada vai para servidor de terceiros. Não adicione analytics, CDN ou chamadas de rede sem pedir.
  - Exceção pedida pelo usuário (31/10/2026): a **agenda conectada** baixa o endereço iCal que a pessoa colou (comando Rust `baixar_agenda`, só https), ao abrir o app e no botão "Atualizar agenda". Nada é enviado.
  - Exceção pedida pelo usuário (31/10/2026): **atualizações** (`src/data/atualizacao.ts`, `tauri-plugin-updater`) baixam o `latest.json` e o instalador do GitHub Releases (`lucaslsm8/prontuario-de-casa`), ao abrir (opção "Procurar ao abrir o app") e no botão. Assinatura conferida com a chave pública do `tauri.conf.json`; a privada fica fora do repo (`~/.tauri/prontuario-de-casa.key` e segredo do GitHub).
  - Exceção pedida pelo usuário (01/11/2026): **sincronização da família** (`src-tauri/src/remoto.rs`, `sincronia.rs`) grava e lê pacotes **cifrados com a chave da família** num repositório **privado** do GitHub que o usuário criou (Contents API, token fine-grained só desse repositório, guardado no kv cifrado). Sem família configurada, nada é enviado. Testes manuais só com `npm run app:teste -- a|b` (outro identificador), nunca com o app real.
  - Exceção pedida pelo usuário (02/11/2026): **sincronização pelo Wi-Fi** (`src-tauri/src/lan.rs`) só na **rede local**: anúncio mDNS `_prontuario._tcp.local.` (TXT só `f` = 16 hex do SHA-256 do familiaId e `a` = aparelhoId) e TCP numa porta efêmera, cifrado com Noise `NNpsk0_25519_ChaChaPoly_SHA256` e PSK derivada da chave da família da época atual (HKDF, "prontuario-lan"). Só com família configurada, app aberto e desbloqueado; removido não troca. Outra família falha no handshake e é ignorada. Com alguma rede de casa cadastrada, só liga numa delas (reavaliado a cada `lan_iniciar`).
  - Exceção pedida pelo usuário (02/11/2026): **atualização do APK no Android** (`src-tauri/src/apk.rs`) consulta a API pública de releases deste repositório (`api.github.com/repos/lucaslsm8/prontuario-de-casa/releases/latest`) e baixa o `*_android.apk` e o `.sha256` do GitHub Releases, ao abrir (opção "Procurar ao abrir") e no botão. O SHA-256 é conferido antes de abrir o instalador do Android (`InstaladorPlugin.kt`). Nada é enviado.
  - Pedido do usuário (02/11/2026): **consultas na agenda do celular** (Android, `AgendaPlugin.kt`, `src/data/agendaCelular.ts`). Com a opção ligada em Configurações, as consultas de quem usa o aparelho viram eventos na agenda escolhida (CalendarContract, a mesma do Google Agenda, que sincroniza com a conta Google da pessoa). O texto do evento (título, profissional, local, preparo) sai do cofre por escolha da pessoa; o app guarda só "id da consulta → id do evento" nas preferências. Desligar tira os eventos. Qualquer pessoa da família marca consulta para qualquer outra (`paraConsultas` / `editaConsulta` em `store.tsx`).
- Repositório público: dados de exemplo só com a família inventada (Almeida: Helena, Roberto, Pedro; pets Mel e Thor). Nunca commitar dados reais, backups `.fsaude`, bancos ou documentos pessoais.
- Nunca grave dados de saúde em claro no disco. Novos dados persistentes entram como evento (front) ou `kv` cifrado (Rust).
  - Limitação do Android: o `tauri-plugin-notification` guarda título e corpo de cada lembrete agendado em claro no SharedPreferences do app (pasta privada) até disparar. Com "Esconder nomes" ligado (padrão), a dose vai sem o nome do remédio e consulta/vacina/prevenção vão com texto genérico ("Lembrete do Prontuário de Casa" / "Hora de um cuidado", `paraAgendar` em `src/data/lembretesAndroid.ts`). Com ele desligado, o texto completo (remédio, título da consulta, profissional, local, pet) fica lá.
- Ações destrutivas sempre com confirmação. "Apagar tudo" exige digitar APAGAR.
- Transições: 150–200 ms ease-out (`var(--t)`, `var(--ease)`).
- Alvo de toque mínimo de 44 px no mobile.

## Próximos marcos (ver docs/ARQUITETURA.md)

Feito até a 0.5.0: lembretes no desktop (`lembretes.rs`) e no Android (plugin de notificações, Tomei / 15 min / Pular); atualizações no desktop (`npm run app:build`, `scripts/app-build.mjs`, tag `v*` → `.github/workflows/release.yml`) e no Android (APK pelo app); app Android (AndroidKeyStore, biometria, QR do convite, rede de casa); sincronização pelo GitHub e pelo Wi-Fi, com aparelhos da família e "Remover aparelho".

1. Visual V1 nas telas que ainda têm o layout antigo (Pessoa, Planos, Privacidade, telas do celular).
2. Pasta sincronizada com `age` (para quem mora em outra casa), se o GitHub não bastar.

Lista de melhorias e o que já foi feito: `docs/melhorias.md`.
