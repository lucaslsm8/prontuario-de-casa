# Prontuário de Casa

App pessoal (Windows/desktop + Android) para organizar a saúde da família: remédios com lembrete e estoque, consultas, exames, plano de saúde e ficha de emergência. Dados ficam no aparelho.

Stack: **Tauri 2** (gera o `.exe` do Windows e, depois, o APK) + **React 18 / TypeScript / Vite**. Design de referência em [`docs/design/`](docs/design/HANDOFF.md).

## Estado atual (marco 2)

- **Dados salvos de verdade**: cada mudança vira um evento gravado num SQLite local, cifrado com XChaCha20-Poly1305. A chave fica no Gerenciador de Credenciais do Windows (Keychain no macOS). O arquivo do banco não tem nenhum dado legível.
- **Primeiro uso**: boas-vindas → você → alguém da casa (opcional) → PIN (celular) ou senha (desktop). Também dá para restaurar um backup direto na M01.
- **Bloqueio**: PIN/senha conferidos com Argon2id, bloqueio ao abrir e por inatividade.
- **Backup `.fsaude`**: arquivo cifrado com a senha do backup (Argon2id + XChaCha20-Poly1305), que abre em qualquer aparelho. Manual ou semanal (feito ao abrir o app, mantém os 8 últimos), pasta escolhida pelo usuário, restaurar, trocar senha.
- **Apagar todos os dados** apaga o banco e a chave do aparelho.
- Adesão (%, grade de 14 dias) calculada pelo histórico real de doses.
- As 31 telas do handoff seguem iguais aos mockups nos dados de exemplo.
- **Perfil com foto e edição**: foto no lugar das iniciais em todo avatar e "Editar perfil" no desktop e no celular. A foto fica dentro do log cifrado.
- **Pets** (Mel e Thor nos dados de exemplo): cadastro de pet, vacinas, antipulgas e vermífugo, sintomas, procedimentos e peso, remédios e consultas veterinárias. Lembretes de reforço de vacina e de prevenção, resumo para o veterinário e ficha de emergência do pet. Pets aparecem sob a divisória "Pets" nas listas e não entram no compartilhamento.
- Telas desktop além dos mockups: primeiro uso em tela dividida, formulários em diálogo largo (remédio, consulta, exame, pessoa, emergência), detalhe do remédio, resumo para consulta e carteirinha em tela cheia ("Mostrar no balcão").

- **Atualizações** pelo GitHub Releases: o app instalado procura versão nova ao abrir (dá para desligar) e em Privacidade e backup › Atualizações. O instalador é assinado; o app confere a assinatura antes de instalar e pode fazer um backup antes.

- **Sincronização pelo GitHub** (desktop): os aparelhos da família trocam eventos por um repositório privado seu, tudo cifrado. Veja [Sincronizar a família](#sincronizar-a-família).

**Ainda não:** app Android e sincronização pela rede local (Wi-Fi). Plano em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodar no navegador (mais rápido para revisar o design)

```bash
npm install
npm run dev          # http://localhost:1420
```

O navegador abre com os **dados de exemplo** dos mockups (hoje = 28/10/2026), em memória. Para testar o app de verdade no navegador (primeiro uso, PIN, backup simulado), abra `http://localhost:1420/?persistir=1`.

No canto inferior esquerdo aparece uma barra de desenvolvimento (só com os dados de exemplo):
- **Telas**: lista as 31 telas pelo ID do mockup (M01…D08), mais atalhos "D·…" para as telas desktop criadas fora dos mockups, e abre cada uma no estado certo.
- **Celular / Desktop**: força um layout. O celular aparece numa moldura 390×844, igual aos mockups.
- **Dados de exemplo**: volta ao estado inicial.

## Gerar o `.exe` do Windows

Pré-requisitos (uma vez só):
1. [Node.js](https://nodejs.org) 20 ou mais novo.
2. [Rust](https://rustup.rs) (`rustup` com o toolchain `stable-x86_64-pc-windows-msvc`).
3. **Microsoft C++ Build Tools** com a carga “Desenvolvimento para desktop com C++”.
4. WebView2: já vem no Windows 10/11.

Depois:

```bash
npm install
npm run app:dev      # abre o app numa janela nativa, com recarga automática
npm run app:build    # gera os instaladores
```

Os instaladores saem em `src-tauri/target/release/bundle/`:
- `nsis/Prontuário de Casa_0.4.0_x64-setup.exe` (instalador `.exe`, instala para o usuário atual, em pt-BR)
- `msi/Prontuário de Casa_0.4.0_x64_pt-BR.msi`

O executável sem instalador fica em `src-tauri/target/release/arquivo-saude.exe`.

O `app:build` gera também os arquivos de atualização (`.sig`) quando acha a chave de assinatura em `%USERPROFILE%\.tauri\prontuario-de-casa.key` (ou na variável `TAURI_SIGNING_PRIVATE_KEY`). Sem a chave, gera só os instaladores.

### Da versão portátil para a instalada

O app instalado usa o mesmo identificador (`br.familia.arquivosaude`): abre o mesmo banco em `%APPDATA%` com a mesma chave do Gerenciador de Credenciais. Instalou no mesmo usuário do Windows, os dados já estão lá. Por segurança, faça antes um backup em Privacidade e backup; em outro computador, use "Restaurar um backup" no primeiro uso.

Onde ficam os dados no Windows: `%APPDATA%\br.familia.arquivosaude\arquivo.db` (cifrado). Backups vão por padrão para `Documentos\Arquivo da família`.

Testes do Rust (criptografia, banco, backup): `cd src-tauri && cargo test`.

## Publicar uma versão

1. Suba a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (ex.: `0.3.0`), escreva o que mudou em [`.github/notas-da-versao.md`](.github/notas-da-versao.md) (uma linha por item, com `- `; é o texto do aviso de atualização no app) e faça o commit.
2. `git tag v0.3.0 && git push origin main v0.3.0`.
3. O workflow [`release.yml`](.github/workflows/release.yml) compila no Windows, assina e cria um **rascunho** de release com o instalador e o `latest.json`.
4. No GitHub, confira o rascunho e publique. A partir daí o app instalado encontra a versão nova.

Uma vez só: em Settings › Secrets and variables › Actions, crie o segredo `TAURI_SIGNING_PRIVATE_KEY` com o conteúdo de `%USERPROFILE%\.tauri\prontuario-de-casa.key`. Guarde essa chave num lugar seguro: sem ela não dá para publicar atualizações que o app aceite.

### Android

O mesmo workflow gera o APK assinado e o anexa ao mesmo release (`Prontuario.de.Casa_<versão>_android.apk` e `.sha256`). Uma vez só:

1. Rode `npm run android:chave`: cria a chave em `~/.tauri/prontuario-android.jks` (senha em `~/.tauri/prontuario-android.senha`) e imprime dois comandos PowerShell.
2. Rode esses dois comandos para cadastrar os segredos `ANDROID_KEYSTORE_B64` e `ANDROID_KEYSTORE_SENHA` no GitHub. Sem eles, o job `android` falha de propósito (não publica APK sem assinatura).
3. **Guarde** `~/.tauri/prontuario-android.jks` e a senha num lugar seguro: sem eles, o Android não aceita atualizar o app instalado com uma versão nova.

## Sincronizar a família

A sincronização usa um repositório **privado** no GitHub que você cria. Os eventos vão cifrados; o GitHub só guarda arquivos ilegíveis.

**Primeiro aparelho (Criar família):**
1. No GitHub, crie um repositório **privado** vazio (ex.: `prontuario-sync`).
2. Em Settings › Developer settings › Fine-grained tokens, gere um token só para esse repositório, com **Contents: Read and write**.
3. Em Privacidade e backup › Família e aparelhos, clique em "Criar família" e cole `dono/nome` e o token. O token fica cifrado neste aparelho.

**Outros aparelhos (Convidar aparelho → Entrar na família):**
1. No aparelho que já está na família, em Privacidade e backup › Família e aparelhos, clique em "Convidar aparelho" e depois "Mostrar convite". Copie o texto (`PCASA1:…`).
2. No outro aparelho, na tela de boas-vindas, use "Entrar na família" (ou "Entrar com convite" em Privacidade e backup) e cole o convite.
3. Escolha em "Quem é você?" a pessoa que usa aquele aparelho e crie a senha.

O convite dá acesso à família: passe só para os seus aparelhos e apague o texto depois de usar.

## Estrutura

```
src/
  data/        tipos, dados de exemplo, store (eventos + seletores), persistência e formatação pt-BR
  ui/          componentes base: Chip, Toggle, Segmented, Row, Bar, Pill, Avatar…
  styles/      tokens do design (cores, raios, sombras) e estilos base
  mobile/      telas M01–M23 + shell com tab bar flutuante
  desktop/     telas D01–D08 + telas extras, shell com sidebar e formulários em diálogo
  dev/         navegador de telas (só em `npm run dev`)
src-tauri/     app nativo (Rust): banco cifrado (banco.rs), criptografia (cripto.rs), backup (backup.rs), comandos (lib.rs)
docs/          handoff de design e arquitetura
```
