# Android e sincronização da família — desenho

Data: 31/10/2026. Aprovado em conversa com o usuário, parte por parte.

## Objetivo

- Ter o Prontuário de Casa no **Android**, além do desktop.
- **Sincronizar** os aparelhos do usuário (desktop e celular) e os aparelhos dos outros membros da família, cada um com o próprio app.
- Funcionar nos dois casos de uso: todos na mesma casa (mesmo Wi-Fi) e em casas diferentes (pela internet).
- **Abrir sem senha na rede de casa**, se a pessoa quiser.

Regras que continuam valendo:
- Nada legível sai dos aparelhos.
- Dados de saúde nunca ficam em claro no disco.
- O log de eventos é só de adição.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Transporte | Wi-Fi local **e** repositório **privado** no GitHub | O usuário pediu o GitHub, que não exige login do Google nem verificação de app, e o token é distribuído no pareamento. |
| Modelo de sincronização | **Log único da família**, cifrado com uma **chave da família** | Escolha do usuário: mais simples de construir e de depurar. |
| Compartilhamento | Vira **o que cada pessoa vê na tela** | Com o log único, todos os aparelhos recebem tudo. A privacidade entre membros passa a ser de exibição, o que é aceito. |
| Edição | **Todos editam tudo** o que veem | Escolha do usuário. |
| Conflitos | Último HLC vence, **por campo**. Doses só se somam. | O modelo de eventos já é append-only. CRDT seria excesso. |
| Distribuição Android | **APK no GitHub Releases**, fora da Play Store | Sem conta de desenvolvedor nem dependência da Google. A atualização segue o mesmo caminho do desktop. |

## 1. Identidade e entrada na família

**"Quem sou eu" é do aparelho**
- `souEu` sai do evento da pessoa e vira configuração local do aparelho, no `kv` cifrado: `{ aparelhoId, pessoaId }`.
- `aparelhoId` é aleatório e fica estável, por exemplo `pc-3f9a`. Cada aparelho tem um nome legível ("PC do Lucas"), escolhido no convite.
- Migração: no primeiro início da versão nova, a pessoa com `souEu: true` vira a `pessoaId` local. O campo `souEu` dos eventos antigos é ignorado pelo reducer.

**Chave da família**
- 32 bytes aleatórios, gerados pelo primeiro aparelho, no botão "Criar família" em Privacidade › Aparelhos.
- Fica no cofre do aparelho: Gerenciador de Credenciais no Windows, Keystore no Android.
- Cifra todos os pacotes trocados, com XChaCha20-Poly1305 e AAD = `familiaId|aparelhoId|seq`.
- Não cifra o banco local, que continua com a chave do aparelho.

**Convite por QR**
- Em Privacidade › Aparelhos › "Convidar aparelho", aparece um QR na tela.
- O QR contém: `familiaId`, a chave da família, o repositório (`dono/nome`), o token do GitHub e um código de uso único que vale 10 minutos.
- O QR nunca é enviado pela rede. Some ao fechar a tela ou depois de 10 minutos.
- No desktop, a alternativa ao QR é um texto para colar, com o mesmo conteúdo em base64 e um aviso.

**Entrar na família (aparelho novo)**
- No primeiro uso, a opção "Entrar na família" faz o seguinte:
  1. lê o QR;
  2. baixa o log, pelo Wi-Fi se houver um aparelho da família na rede, senão pelo GitHub;
  3. pergunta "Quem é você?", listando as pessoas (não os pets);
  4. depois disso, cria o PIN ou a senha local.
- Se a pessoa não estiver na lista, há a opção "Sou outra pessoa", que cria a pessoa nova como evento.

**Remover um aparelho**
- Em Aparelhos › "Remover", um aparelho que continua na família faz três coisas:
  1. gera uma chave nova;
  2. publica um pacote de **troca de chave**, cifrado com a chave nova para cada aparelho que fica;
  3. avisa para trocar o token do GitHub.
- Para cifrar a chave nova só para os aparelhos que ficam, cada aparelho tem também um par X25519, criado no convite, cuja chave pública vai no log.
- O aparelho removido continua com o que já tinha, mas não lê nada novo.

**Compartilhamento**
- `Compartilhamento` continua no log. Por padrão, cada pessoa mostra tudo para todos.
- Cada pessoa pode esconder categorias dela de outra pessoa.
- Quem vê uma categoria também pode editá-la.

## 2. Log, conflitos e transporte

**Evento**
- `Evento` ganha `aparelho` (o id do aparelho que criou o evento) e `hlc`.
- O `hlc` é o relógio lógico híbrido: `"<ms desde 1970>-<contador>-<aparelhoId>"`, que dá ordem total.
- `id` continua globalmente único.
- O estado é o mesmo reducer, aplicado aos eventos **ordenados por `hlc`**.
- Eventos antigos sem `hlc` recebem um na migração, derivado de `em` e da ordem atual, com o `aparelhoId` local.

**Sincronizar**
- A operação é: "eventos que eu não tenho", por id.
- O log local é a união dos logs recebidos. Ao receber eventos com HLC anterior ao último aplicado, o estado é **reprojetado**.
- Para ficar rápido, a projeção guarda um ponto de controle (snapshot) a cada N eventos.

**Conflitos**
- `editarRegistro` e `editarPessoa` são aplicados por campo, em ordem de HLC. Por isso o último vence, campo a campo.
- `removerRegistro` × `editarRegistro`: vence o de HLC maior. "Restaurar" continua sendo um evento novo.
- `dose` é deduplicada por `(remedioId, previstoPara)`, mantendo o de menor HLC. "Desfazer" aponta para o id da dose.
- `config`:
  - só as **preferências da família** sincronizam: agenda conectada e compartilhamento;
  - bloqueio, senha, notificações, rede de casa e aparência ficam no `kv` local de cada aparelho.

**Pelo GitHub**
- O repositório privado é criado pelo usuário, por exemplo `lucaslsm8/prontuario-sync`.
- O acesso é por um **token fine-grained** limitado a esse repositório, com permissão só de *Contents: read & write*.
- Layout dos arquivos:
  - `familia.json`: só metadados não sensíveis, `{ familiaId, versao }`;
  - `eventos/<aparelhoId>/<seq>.bin`: um pacote cifrado com até 200 eventos, ou um anexo grande sozinho;
  - `base/<aparelhoId>-<seq>.bin`: compactação dos pacotes antigos.
- **Envio**: depois de uma mudança, espera 5 s sem novas mudanças e grava pela Contents API.
- **Recebimento**: acontece ao abrir o app, a cada 5 minutos com o app aberto e no botão "Sincronizar agora". O app lista `eventos/*`, guarda o último `seq` lido de cada aparelho e baixa só os pacotes novos.
- **Compactação**: o aparelho com mais de 500 pacotes próprios junta os antigos num `base/` e apaga os soltos. Os outros aparelhos já leram e guardam os eventos.
- Todas as chamadas de rede são feitas no Rust (`ureq`, só https, com timeout). O token fica no `kv` cifrado.

**Pelo Wi-Fi**
- **Descoberta** por mDNS (`_prontuario._tcp`), anunciando só `familiaId` em hash e `aparelhoId`.
- **Canal** Noise `NNpsk0` (crate `snow`), com PSK derivada da chave da família.
- **Troca**: cada lado manda o resumo `{ aparelhoId: maiorSeq }` e envia os eventos que faltam ao outro.
- Os eventos recebidos pelo Wi-Fi também entram no próximo envio ao GitHub do aparelho que os criou. Quem recebe não reenvia eventos dos outros.

**Anexos**
- Continuam dentro dos eventos `addAnexo`.
- Cada anexo maior que 512 KB vai num pacote próprio. O limite da Contents API é 100 MB e o app já limita PDF a 10 MB.

**Status**
- Em Privacidade › Aparelhos aparecem:
  - a última sincronização e o caminho usado (Wi-Fi ou GitHub);
  - a lista de aparelhos com a última vez visto;
  - erros.
- Aviso quando o token estiver a 15 dias de vencer, ou já vencido (resposta 401 do GitHub).

## 3. Sem senha na rede de casa

- Fica em Privacidade › Bloqueio › "Redes de casa": a opção "Esta é a rede de casa" guarda a identidade da rede atual.
  - Desktop: o MAC do gateway padrão, que funciona com Wi-Fi ou cabo.
  - Android: o BSSID do Wi-Fi. O Android exige permissão de localização, pedida só nessa hora.
- Na abertura e no bloqueio por inatividade:
  - se a rede atual estiver cadastrada, não pede senha nem biometria;
  - fora dela, segue como hoje.
- A opção é **por aparelho**, **desligada por padrão** e aceita várias redes. Ela não sincroniza.
- O texto da opção explica que quem pegar o aparelho dentro de casa abre o app. Os dados continuam cifrados no disco com a chave do aparelho, e só a tela de bloqueio é pulada.

## 4. App Android

- **Base**: `tauri android init` neste projeto. A UI é a de celular que já existe (largura < 760 px), mais:
  - área segura (`env(safe-area-inset-*)`);
  - a tecla voltar ligada ao `useVoltar`.
- **Chave do aparelho**: plugin Kotlin `cofre`. Ele gera uma chave AES no **AndroidKeyStore** e guarda, num arquivo privado, a chave de 32 bytes do banco cifrada por ela. Substitui o caminho `arquivo 0600` atual do Android em `cripto.rs`.
- **Desbloqueio**: PIN (Argon2id, como hoje) ou **biometria** com `tauri-plugin-biometric`. Na rede de casa, sem desbloqueio.
- **Lembretes**:
  - plugin Kotlin `lembretes` com `AlarmManager.setExactAndAllowWhileIdle` e permissão `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM`;
  - notificação com ações **Tomei / 15 min / Pular**;
  - o texto respeita "esconder nome do remédio";
  - com o app fechado, a ação é guardada numa **fila local cifrada** (Keystore) e vira evento `dose` ao abrir o app;
  - os alarmes são reagendados no boot (`RECEIVE_BOOT_COMPLETED`) e a cada mudança de remédio.
- **Atualização**:
  - o workflow de release passa a gerar também o **APK assinado**, com o keystore Android no segredo `ANDROID_KEYSTORE` (+ senha) e cópia com o usuário;
  - o app consulta o `latest.json` (entrada `android`), baixa o APK, confere o SHA-256 publicado e abre o instalador (`REQUEST_INSTALL_PACKAGES`);
  - backup antes, se ligado.
- **Arquivos**:
  - backup `.fsaude` e exportações pelo seletor de documentos do Android (SAF);
  - fotos pela câmera ou pela galeria.
- **Ambiente de desenvolvimento** (instalação única no PC):
  - Android Studio (SDK, NDK, emulador) e JDK 17;
  - `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`;
  - teste no emulador e no celular do usuário (depuração USB ou sem fio).

## Ordem de construção

Cada etapa termina utilizável e com testes.

1. **Identidade local + HLC**: `souEu` para o `kv`, `aparelhoId`, `hlc` nos eventos, reducer ordenado por HLC, migração. Nada muda na tela.
2. **Sincronização pelo GitHub**: chave da família, pacotes, envio e recebimento, tela Aparelhos com status. Testada com duas cópias no desktop.
3. **Android básico**: build, Keystore, PIN, biometria, área segura, APK assinado no Releases.
4. **Convite por QR e "Entrar na família"**, com o celular sincronizando pelo GitHub.
5. **Wi-Fi local** (mDNS + Noise) e **rede de casa sem senha**.
6. **Lembretes nativos no Android** e **atualização do APK**.

## Erros e casos de borda

- **Sem internet ou GitHub fora**: fica tudo local. O envio fica pendente e o app tenta de novo no próximo ciclo, e o status mostra "aguardando conexão".
- **Pacote que não decifra** (chave errada ou arquivo corrompido): o app ignora o pacote, registra no status e não para a sincronização.
- **Relógio do aparelho muito errado** (mais de 1 dia): o HLC limita o avanço, e o app avisa "confira a data e hora deste aparelho".
- **Dois aparelhos compactando ao mesmo tempo**: cada um só compacta a própria pasta.
- **Token sem permissão ou vencido**: aviso persistente em Aparelhos. Os dados locais seguem funcionando.
- **Aparelho removido tentando enviar**: os outros ignoram pacotes cifrados com a chave antiga depois da troca.

## Testes

- **Puros (vitest)**:
  - ordem por HLC e reprojeção;
  - conflito por campo;
  - deduplicação de dose;
  - remover × editar;
  - migração do `souEu`;
  - montagem e leitura de pacotes, com cifra simulada.
- **Rust (`cargo test`)**:
  - cifra e decifra de pacotes com AAD;
  - HLC;
  - troca de chave;
  - leitura e escrita no GitHub contra um servidor HTTP falso;
  - handshake Noise entre dois pares em memória.
- **Manuais**:
  - dois desktops, depois desktop + celular;
  - editar o mesmo campo nos dois e conferir o resultado;
  - remover um aparelho;
  - abrir na rede de casa e fora dela.

## Fora do escopo

- iOS.
- Play Store.
- Relay próprio na internet.
- Histórico de versões de cada registro além do log.
- Privacidade forte entre membros: com o log único, todos os aparelhos têm todos os dados, cifrados no disco.
