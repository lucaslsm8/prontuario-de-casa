# Melhorias finais (Etapas 4–6) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o produto, desktop e Android, com:
1. rede de casa sem senha;
2. convite por QR;
3. lista de aparelhos e remoção com troca da chave da família;
4. lembretes de remédio no Android;
5. atualização do APK pelo próprio app;
6. sincronização direta pelo Wi-Fi.

No fim, versão 0.5.0 com o `.exe` e o `.apk` no release.

**Architecture:**
- Cada recurso é uma tarefa independente sobre o que já existe:
  - log de eventos com HLC;
  - família no `kv` cifrado;
  - pacotes cifrados (`pacote.rs`);
  - remoto (`remoto.rs`);
  - plugins Kotlin do próprio app, no padrão do `CofrePlugin` (`src-tauri/gen/android/app/src/main/java/br/familia/arquivosaude/` + módulo Rust `#[cfg(target_os = "android")]` com `register_android_plugin`).
- Toda chamada de rede fica no Rust (`ureq`, https, timeout).
- Tudo que é só do desktop fica atrás de `#[cfg(desktop)]` ou das plataformas da capability.

**Tech Stack:** Tauri 2 (desktop e Android), Kotlin, Rust (`ureq`, `chacha20poly1305`, `x25519-dalek`, `mdns-sd`, `snow`), React/TS, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-barcode-scanner`, `qrcode` (já no projeto).

Spec: [`docs/superpowers/specs/2026-10-31-android-sincronizacao-design.md`](../specs/2026-10-31-android-sincronizacao-design.md), seções 1–4.

## Global Constraints

- **Nada legível sai do aparelho.** Dados de saúde nunca ficam em claro no disco nem na rede. Novas configurações locais vão para o `kv` cifrado.
- **Rede.** Só as três exceções documentadas no `CLAUDE.md` (agenda, atualização, família no GitHub), mais:
  - a rede local da Task 6, cifrada com a chave da família;
  - a consulta de versão do APK da Task 5, na API do GitHub Releases deste repositório.

  Nada além disso. Registre cada exceção nova no `CLAUDE.md`.
- **Desktop real intocado.** Nunca rodar `npm run app:dev`, `npm run app:build` nem o `.exe` real. Testes manuais só com `npm run app:teste -- a|b`.
- **Depois de cada tarefa:**
  - `cd src-tauri && cargo test`;
  - `cargo clippy --all-targets`, sem avisos novos;
  - `npx vitest run`;
  - `npm run build`;
  - e, se a tarefa tocar o Android, o APK de debug compila.

  Ambiente Android (Git Bash):

  `export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk" NDK_HOME="$LOCALAPPDATA/Android/Sdk/ndk/28.2.13676358" JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.21.21-hotspot"`

  `npx tauri android build --apk --target aarch64 --debug > /tmp/apk.log 2>&1`, e leia o log para achar o erro real.
- **Interface:**
  - textos em pt-BR;
  - alvo de toque ≥ 44 px no celular;
  - cores das variáveis de `src/styles/tokens.css`;
  - nada de ícones em listas;
  - ações destrutivas sempre com confirmação.
- **Permissões.** Permissões Android novas no manifesto e pedidas em tempo de execução só quando o recurso é usado. Capabilities por plataforma (`desktop.json`, `mobile.json`).
- **Código.** Lógica pura com testes (vitest e `cargo test`). Código no estilo do projeto: identificadores e comentários em português, densidade de comentário parecida.

---

### Task 1: Rede de casa sem senha

**Comportamento** (spec seção 3):
- **Onde:** Privacidade › Bloqueio › "Redes de casa", no desktop e no celular.
- **Cadastrar:** o botão "Esta é a rede de casa" guarda a identidade da rede atual no `kv` local `redes_casa` (lista de `{ id, nome }`). Dá para cadastrar várias e remover cada uma, com confirmação.
- **Uso:** ao abrir o app e no bloqueio por inatividade, se a rede atual estiver cadastrada, **não pede senha nem biometria**. Fora dela, tudo segue como hoje.
- **Escopo:** por aparelho, desligada por padrão. **Não sincroniza.**
- **Texto da opção:** "Quem pegar o aparelho dentro de casa abre o app sem senha. Os dados continuam cifrados."

**Identidade da rede:**
- **Desktop:** MAC do gateway padrão.
  - No Windows, ache o IPv4 do gateway (`route print -4 0.0.0.0` ou `GetIpForwardTable2`) e o MAC dele (`arp -a <ip>` ou `GetIpNetTable2`). Para chamar programa externo, use `std::process::Command` com `CREATE_NO_WINDOW` (`creation_flags(0x08000000)`).
  - O texto de saída pode estar em pt-BR: o parse aceita só os padrões numéricos (IP e MAC `xx-xx-xx-xx-xx-xx`), não palavras.
  - Linux/macOS: devolva "indisponível".
- **Android:** BSSID do Wi-Fi atual, pelo plugin Kotlin `RedePlugin` com `WifiManager`/`ConnectivityManager`.
  - Exige `ACCESS_FINE_LOCATION` e `ACCESS_WIFI_STATE`, com o pedido em tempo de execução só ao tocar "Esta é a rede de casa".
  - Um BSSID `02:00:00:00:00:00` (sem permissão) conta como "indisponível".
- **Nome amigável:** no Android, o SSID; no desktop, "Rede (gateway xx…)".
- **Formato guardado:** `id` = hash SHA-256, em hex, do MAC/BSSID normalizado em minúsculas, para não guardar o identificador cru.

**Interfaces:**
- **Comandos Rust:**
  - `rede_atual() -> Option<{ id, nome }>`;
  - `redes_casa() -> Vec<{ id, nome }>`;
  - `rede_casa_adicionar(id, nome)`;
  - `rede_casa_remover(id)`.
- **Store:** a abertura (`bloqueado: ini.temSenha`) e `useBloqueioPorInatividade` consultam `estaEmCasa()` em `src/data/redeCasa.ts`. Na abertura, se estiver em casa, `bloqueado` começa `false`. Na inatividade, em casa, não bloqueia.
- **Testes:**
  - parse da saída do `route`/`arp`, com exemplos em pt-BR e em inglês;
  - normalização e hash do id;
  - `estaEmCasa`, puro, com a rede atual e a lista.

---

### Task 2: Convite por QR

**Comportamento:**
- **Desktop:** em "Convidar aparelho", depois de "Mostrar convite", aparece o **QR** do mesmo texto `PCASA1:…`, gerado localmente com o pacote `qrcode` que já está no projeto, ao lado do texto e do botão Copiar. O aviso de segurança continua. O QR some ao fechar a folha.
- **Android:** em "Entrar na família" (boas-vindas e card), um botão **"Ler QR"** abre a câmera com `@tauri-apps/plugin-barcode-scanner` (crate `tauri-plugin-barcode-scanner`, só mobile; permissão de câmera pedida na hora). Lido um `PCASA1:`, preenche o convite e entra direto. Cancelar volta para o campo de colar.
- **Convite com prazo:** na hora de **gerar**, o convite ganha `"x": <ms de expiração = agora + 10 min>`. `ler_convite` recusa expirados com "convite vencido; gere outro". Convites sem `x` (antigos) continuam aceitos.

**Interfaces:**
- `familia::convite(f, expira_ms: Option<u64>)`;
- `ler_convite(texto, agora_ms)`;
- testes do prazo.

---

### Task 3: Aparelhos da família: nome, lista e "visto por último"

**Comportamento:**
- Ao criar ou entrar numa família, e na primeira abertura com família, o aparelho emite **uma vez** o evento `aparelho { aparelhoId, nome, plataforma: 'pc' | 'cel', chavePublica }`. O padrão do nome é "PC de <curto>" / "Celular de <curto>", e ele pode ser renomeado no card. `chavePublica` é a X25519 da Task 4. Renomear é um novo evento `aparelho` com o mesmo id: vale o mais recente pelo HLC.
- O reducer projeta `state.aparelhos: { id, nome, plataforma, chavePublica?, removido?: boolean, visto: string /* ISO do último evento dele */ }[]`.
- O card "Família e aparelhos" lista os aparelhos (nome, "este aparelho", "visto há …"), com "Renomear" no próprio aparelho e "Remover" nos outros (Task 4).

**Interfaces:**
- evento `aparelho`;
- `State.aparelhos`;
- seletor `aparelhosDaFamilia(state)`;
- testes do reducer (renomear, `visto`, ordem).

---

### Task 4: Remover aparelho e trocar a chave da família

**Comportamento:**
- **Par de chaves por aparelho:** cada aparelho tem um par **X25519**. A chave privada fica no `kv` cifrado (`chave_x25519`) e a pública vai no evento `aparelho` (Task 3).
- **"Remover aparelho"** (confirmação: digitar o nome do aparelho):
  1. gera uma **chave nova** da família, a época `e+1`;
  2. para cada aparelho **não removido** que tenha chave pública, grava `chaves/<época>/<aparelhoId>.bin`, com a chave nova cifrada para ele: X25519 efêmero + HKDF-SHA256 + XChaCha20-Poly1305, AAD `"<familiaId>|<época>|<aparelhoId>"`;
  3. emite o evento `removerAparelho { aparelhoId }`;
  4. passa a usar a chave nova para os pacotes seguintes.
- **Época nos pacotes:** cada pacote passa a levar a época no AAD (`"<familiaId>|<época>|<aparelho>|<n>"`) e no nome (`eventos/<aparelho>/<época>-<n>.bin`). Pacotes antigos, sem época, continuam lidos com a chave da época 0, que se mantém no `kv` (`chaves_antigas`).
- **Ao receber:**
  - o aparelho que encontra `chaves/<época nova>/<seu id>.bin` abre o arquivo com a própria privada, guarda a chave e passa a usá-la;
  - o aparelho removido não encontra o arquivo, deixa de conseguir ler e mostra "Este aparelho foi removido da família".
- **Token:** a tela de remover avisa que o token do GitHub também precisa ser trocado (o aparelho removido conhece o token). Ela oferece um campo "Novo token (opcional)". Se preenchido, ele vai **junto** no arquivo cifrado de cada aparelho e substitui o token de todos.

**Interfaces:** novo módulo `src-tauri/src/epoca.rs` com:
- `selar(chave_pub, conteudo, aad)` e `abrir(chave_priv, selado, aad)`;
- gestão de épocas no `kv`;
- testes:
  - ida e volta;
  - outro aparelho não abre;
  - aparelho removido não recebe;
  - pacotes de época 0 continuam legíveis.

`sincronia.rs`/`lib.rs` usam a chave da época certa.

---

### Task 5: Lembretes de remédio no Android

**Comportamento:**
- No Android, os lembretes usam `@tauri-apps/plugin-notification` (crate `tauri-plugin-notification`, só mobile).
  - Usa notificações **agendadas** (`schedule: Schedule.at(data, …, allowWhileIdle: true)`) a partir de `proximosLembretes(state, agora)`, a mesma lista que o desktop manda ao Rust.
  - A cada recálculo: cancela as pendentes do app e agenda de novo.
  - Usa o tipo de ação "dose" com **Tomei / 15 min / Pular**.
  - "Esconder nome do remédio nas notificações" continua valendo, pois o texto vem de `proximosLembretes`.
- Ação tocada:
  - **Tomei/Pular:** `marcarDose` (já existe em `useLembretes`);
  - **15 min:** agenda uma nova notificação daqui a 15 min com o mesmo id e o sufixo `|adiado`.
  - Com o app fechado, tocar a ação abre o app, que trata a ação ao iniciar (listener `onAction` registrado logo na montagem).
- **Permissões:** `POST_NOTIFICATIONS` (Android 13+), pedida na primeira vez que há lembrete. `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` conforme a documentação do plugin.
- **Desktop:** continua com o agendador Rust atual, sem nenhuma mudança.

**Interfaces:**
- `src/data/lembretesAndroid.ts`;
- `useLembretes` escolhe entre o caminho Rust (desktop) e o plugin (Android);
- testes da conversão `Lembrete` → notificação agendada (puro).

---

### Task 6: Atualização do APK pelo app

**Comportamento:**
- **Onde:** no Android, a tela "Atualizações" (`src/mobile/Config.tsx`, `Atualizacoes`) e a verificação ao abrir, se "Procurar ao abrir" estiver ligado.
- **Consulta:** chama o comando Rust `apk_verificar()`, que consulta `https://api.github.com/repos/lucaslsm8/prontuario-de-casa/releases/latest`:
  - pega a versão (`tag_name` sem o `v`), as notas (`body`) e os assets `*_android.apk` e `*_android.apk.sha256`;
  - compara com a versão instalada;
  - devolve `{ versao, notas, url, sha256 }` ou `null`.
- **Baixar:** `apk_baixar(url, sha256)` baixa para o cache do app (até 200 MB), confere o SHA-256 e devolve o caminho. Se o hash não bater, apaga e dá erro.
- **Instalar:** o plugin Kotlin `InstaladorPlugin` abre o instalador do Android (`FileProvider` + `ACTION_VIEW`, `application/vnd.android.package-archive`). Exige `REQUEST_INSTALL_PACKAGES`. Se não houver permissão de "instalar apps desconhecidos", abre a tela de configurações correspondente.
- **Backup antes:** se ligado e com senha de backup, faz o backup antes, como no desktop.
- **Desktop:** continua com o `tauri-plugin-updater`, sem mudança.
- **CLAUDE.md:** registrar a exceção de rede (só a API pública de releases deste repositório; nada é enviado).

**Interfaces:**
- comandos `apk_verificar`, `apk_baixar`;
- `InstaladorPlugin.instalar(caminho)`;
- testes:
  - comparação de versões;
  - parse do JSON de release (exemplo fixo);
  - conferência do hash.

---

### Task 7: Sincronização direta pelo Wi-Fi

**Comportamento** (spec seção 2, "Pelo Wi-Fi"):
- **Descoberta:** com família configurada, o app anuncia `_prontuario._tcp.local` por mDNS (crate `mdns-sd`). O anúncio leva só o hash da família (`sha256(familiaId)[0..8]` em hex) e o `aparelhoId`. O app também procura outros com o mesmo hash.
- **Canal:** ao achar um par, abre TCP e faz o handshake **Noise `NNpsk0_25519_ChaChaPoly_SHA256`** (crate `snow`), com PSK derivada da chave da família da época atual por HKDF, rótulo "prontuario-lan".
- **Troca:**
  1. cada lado manda a lista de ids de eventos que tem;
  2. o outro devolve os eventos que faltam, em blocos de até 1 MB;
  3. quem recebe grava com `gravar_novo` e o front reprojeta, pelo mesmo caminho do GitHub (`api.recarregar` via evento Tauri `sync-lan-chegou`).
- **Frequência:** ao abrir, a cada 2 minutos com o app aberto e depois de mudanças (debounce de 5 s, junto com o GitHub).
- **Status no card:** "Sincronizado há … · pelo Wi-Fi" quando a última troca foi local.
- **Android:**
  - o plugin Kotlin `RedePlugin` (Task 1) ganha `multicastLock(adquirir: Boolean)`, porque o mDNS exige `WifiManager.MulticastLock` e as permissões `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_NETWORK_STATE` e `INTERNET`;
  - o servidor TCP só fica ativo com o app aberto.
- **Desktop:** o servidor escuta numa porta efêmera anunciada no mDNS. O Windows pode perguntar sobre o firewall na primeira vez; documente no README.
- **Erros:** nada derruba o app. Falha de handshake (chave errada, outra família) é ignorada em silêncio.

**Interfaces:**
- módulo `src-tauri/src/lan.rs`, com:
  - `iniciar(app)` e `parar()`;
  - troca de eventos testada com dois pares em memória (canal duplex) e handshake Noise com PSK certa e errada;
- comando `lan_sincronizar_agora()`;
- `src/data/sincronizacao.ts` dispara o LAN junto com o GitHub.

---

### Task 8: Documentação, versão 0.5.0 e APK

- [ ] Atualizar:
  - `CLAUDE.md`: exceções de rede, próximos marcos e permissões Android;
  - `docs/ARQUITETURA.md`: o que foi feito em cada recurso;
  - `README.md`: rede de casa, QR, aparelhos, lembretes no Android, atualização do APK e LAN.
- [ ] Revisão final do branch inteiro (controlador).
- [ ] Versão 0.5.0:
  - `package.json`, `Cargo.toml` e `tauri.conf.json`;
  - o `versionCode`/`versionName` Android vêm do `tauri.conf.json`; confira o `tauri.properties`;
  - notas em `.github/notas-da-versao.md`.
- [ ] O controlador gera o APK local assinado para o usuário instalar e, com aprovação, cria a tag `v0.5.0`. O workflow publica o `.exe` e o `.apk`, se os segredos do Android estiverem cadastrados.
