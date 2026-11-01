# Arquitetura e próximos marcos

## Decisão: sincronização entre aparelhos

O handoff deixou a sincronização em aberto. A proposta abaixo segue as regras já definidas: dados só nos aparelhos, cada pessoa é dona dos próprios registros e doses são só de adição.

**Modelo de dados: log de eventos por dono.** Cada aparelho grava suas mudanças como eventos (`criou`, `editou`, `dose_registrada`…) assinados com a chave do dono (Ed25519) e marcados com relógio lógico híbrido (HLC). O SQLite local é uma projeção desse log.
- Quem pode editar um registro é só o dono (ou quem cuida de um dependente). Assim quase não há conflito entre pessoas.
- Entre os aparelhos da mesma pessoa (celular + computador), vale o último HLC por campo.
- Doses nunca são editadas nem apagadas: um “desfazer” vira um evento novo que anula o anterior.
- Antes de enviar, o aparelho filtra os eventos pelas categorias que a pessoa compartilha com cada destinatário (`Compartilhamento`).

Escolhi isso em vez de CRDT genérico (Automerge, cr-sqlite) porque o modelo de dono único já elimina a maior parte dos conflitos, e um log simples é mais fácil de auditar, de fazer backup e de filtrar por categoria.

**Transporte, em duas camadas:**
1. **Conexão direta na rede local** (padrão). Descoberta por mDNS e canal cifrado Noise (`XX`) com as chaves trocadas no pareamento por QR (M13). Status na D07: “conexão direta”.
2. **Pasta sincronizada do próprio usuário** (opcional, para quem mora em outra casa). O aparelho grava pacotes de eventos cifrados para a chave pública de cada destinatário (formato `age`/X25519) numa pasta que o usuário já sincroniza (Google Drive, OneDrive, Syncthing). Quem guarda a pasta só vê bytes cifrados. Status: “via pasta sincronizada”.

Nenhum servidor de terceiros recebe dados legíveis. Um relay próprio com criptografia ponta a ponta pode entrar depois, se a pasta não bastar.

**Feito (Etapa 2, 01/11/2026): sincronização pelo GitHub.** Repositório privado do usuário no GitHub (criado por ele, token fine-grained só desse repositório com Contents read/write, guardado no kv cifrado; `familia_criar` e `familia_entrar` recusam repositório público). Layout: `familia.json` em claro (só `familiaId` e `versao`) e pacotes `eventos/<aparelho>/<n>.bin` cifrados com XChaCha20-Poly1305, AAD `familiaId|aparelhoId|n`, até 200 eventos ou ~1 MB. O convite é texto `PCASA1:` (chave da família e token), mostrado só depois de "Mostrar convite"; o QR fica para a Etapa 4. O envio roda ao abrir o app, a cada 5 min, 5 s depois de uma mudança e no botão "Sincronizar agora". Recebimento: `INSERT OR IGNORE` por id; a pasta de cada aparelho não é listada (a listagem do GitHub corta em 1000 itens): o app sonda `n + 1`, `n + 2`… e para no primeiro que não existe, então só lê a sequência sem buracos; um pacote que não decifra é pulado; erro de rede ou do GitHub interrompe a rodada e tenta de novo depois. Só entram eventos com `id` e `aparelho` em texto e `aparelho` diferente do aparelho que recebe (ninguém escreve em nome dele); eventos de outros aparelhos, da família ou de fora, vindos de um backup restaurado, passam. Os aparelhos vistos em eventos aceitos ficam em `sync_vistos:<familiaId>`. Envio: o estado fica no kv por família, `sync_envio:<familiaId>` = `{ n, ultimoId }` (último pacote e id do último evento que subiu; o formato antigo `{ n, enviados }` vale como `ultimoId` vazio e reenvia tudo, sem problema, porque duplicatas são ignoradas) e `sync_lidos:<familiaId>` (último pacote lido de cada aparelho). O comando `sync_cursor` devolve `ultimoId` e os aparelhos já recebidos (lidos ou vistos); o front (`eventosParaEnviar`, `src/data/log.ts`) monta o recorte: os eventos do log, na ordem local, depois de `ultimoId` (procurado no log inteiro; se ele não está lá, todos), tirando os de aparelhos já recebidos (sobem os deste aparelho e os de backups restaurados de aparelhos que ninguém publicou ainda). Só esse recorte vai para `sync_enviar`, que fatia e numera a partir de `n + 1`. Na primeira sincronização de um aparelho, `ultimoId` é vazio e ainda não há aparelho lido: sobe o log inteiro que ele tiver (no aparelho que criou a família, tudo o que já existia; num aparelho novo que entra, quase nada). Pacote `n` que já está no repositório e abre com a chave da família: se os ids dele são o começo do recorte (resposta de uma gravação perdida), contam como enviados e o resto segue no `n + 1`; se não (recorte que encolheu ou recomeçou), o número está ocupado e o mesmo lote vai para o `n + 1`. Uma sincronização por vez (trava no Rust). Erro no envio não impede o recebimento; um recebimento que falha no meio deixa a reprojeção marcada para a próxima rodada. Com senha, o app abre bloqueado mesmo sem "eu"; o "Quem é você?" só aparece depois de desbloquear, e um aparelho sem senha é convidado a criar uma logo depois. Se a primeira sincronização ao entrar falha, a folha "Entrar na família" fica aberta com o erro e "Tentar de novo". "Sair da família" só limpa `familia`, então entrar de novo na mesma família retoma a numeração. Restaurar um backup num aparelho que já está na família mescla (adiciona os eventos que faltam) em vez de substituir. Só `agenda` do `config` vale entre aparelhos. Testes manuais com dois aparelhos: `npm run app:teste -- a` e `-- b` (identificador próprio, dados e entrada do Gerenciador de Credenciais separados).

**Pendências da sincronização:**
- Wi-Fi local (Etapa 5): descoberta na rede e envio direto entre aparelhos.
- Compactação dos pacotes.
- Remover aparelho e troca de chave da família (Etapa 4).
- Lista de aparelhos na tela de Privacidade e backup.
- Telas de família no Android (Etapas 3 e 4), incluindo o convite em QR.

Bibliotecas previstas (Rust, no `src-tauri`): `mdns-sd`, `snow` (Noise), `ed25519-dalek`/`x25519-dalek`, `age`.

## Armazenamento (feito no marco 2)

- **Log de eventos**: o front transforma cada ação (`dose`, `addRemedio`, `config`…) num evento `{ id, em, autor, tipo, dados }`. O estado é a projeção do log pelo mesmo reducer (`src/data/store.tsx`). Doses e “desfazer” são eventos novos, nunca edições.
- **SQLite + criptografia no app** em vez de SQLCipher: o SQLCipher no Windows exige compilar OpenSSL (Perl, NASM), o que complicaria o build. Cada evento e cada valor de configuração é cifrado com XChaCha20-Poly1305 usando o id como dado associado (um blob não pode ser trocado de lugar). Um marcador cifrado detecta chave errada logo na abertura.
- **Chave do aparelho**: 32 bytes aleatórios no Gerenciador de Credenciais (Windows) / Keychain (macOS). No Linux e, por enquanto, no Android, num arquivo na pasta privada do app (0600). No Android ela vai para o Keystore.
- **Senha/PIN**: hash Argon2id (64 MiB, 3 passadas). Serve para desbloquear a interface; a chave do banco não depende dela.
- **Backup `.fsaude`**: `FSAUDE` + versão | sal (16) | nonce (24) | JSON com o log inteiro, cifrado com chave derivada da senha do backup por Argon2id. Independe do aparelho. A senha do backup fica guardada (cifrada) no banco para o backup semanal automático.
- **Identidade do aparelho** (feito em 01/11/2026): "quem sou eu" fica no `kv` cifrado (`identidade = { aparelhoId, pessoaId }`), fora do log; o `souEu` dos eventos só vale para logs antigos (`resolverEu`). Cada evento novo leva `aparelho` e `hlc` (relógio lógico híbrido, `src/data/hlc.ts`); eventos antigos recebem HLC na carga, sempre igual (`migrarLog`), sem reescrever o banco. O estado é projetado na ordem do HLC.
- **Pets**: um pet é uma `Pessoa` com `tipo: 'pet'` (espécie, raça, veterinário). Os registros próprios vêm de eventos `addVacina`, `addPrevencao`, `addSintoma`, `addProcedimento` e `addPesagem` (cada `Pesagem` e `Prevencao` tem `id`). "Apliquei hoje" mostra "Desfazer", que emite `desfazerPrevencao { id }` (remove a prevenção com esse id; o log continua append-only). Prevenção não aceita data futura. Pets não entram em `Compartilhamento`. Os lembretes agora incluem reforço de vacina (`proxima`) e prevenção (data + `intervaloDias`), além das doses.

## Próximos marcos

1. **Lembretes**: `tauri-plugin-notification` no desktop; no Android, AlarmManager com ações nativas Tomei / Lembrar em 15 min / Pular (M15), respeitando “esconder nome do remédio”.
2. **Atualizações**: desktop com `tauri-plugin-updater` lendo o `latest.json` do GitHub Releases (assinatura verificada). Android: consultar a API de Releases, baixar o APK, conferir hash e abrir o instalador (`REQUEST_INSTALL_PACKAGES`). Backup antes de instalar ligado por padrão.
3. **Android**: `npm run tauri android init`, chave no Keystore, biometria (`tauri-plugin-biometric`), ajustes de área segura.
4. **Sincronização**, conforme a decisão acima.
5. Edição de registros, que nos mockups aparece como “Editar”. **Perfil feito** (29/10/2026): evento `editarPessoa { pessoaId, patch }` com só os campos alterados, inclusive alergias, condições, contato e foto. A foto fica dentro do evento (data URL JPEG 384×384, qualidade 0,82), portanto no log cifrado e no backup `.fsaude`; nunca em arquivo solto. Faltam remédios, consultas, exames e planos.
   Custo: cada troca de foto acrescenta ~40–70 KB ao log (append-only, nada é apagado).

## Observações sobre o design

- A D04 de novembro/2026 precisa de 6 semanas (o dia 1º cai num domingo); o mockup mostra 5 e corta o dia 30. O app mostra as 6.
- Nos mockups, a seção “Pessoas” da sidebar aparece só em D01/D02. No app ela fica em todas as telas do desktop.
- Telas não desenhadas que precisei criar seguindo o mesmo visual: hub de Configurações (mobile), bloqueio por senha no desktop, confirmação de “Encerrar tratamento”, “Escolher itens” do resumo, histórico de versões e tela cheia da carteirinha (“Mostrar no balcão”).
- Telas desktop criadas fora dos mockups (D01–D08 não as cobrem):
  - **Formulários em diálogo largo** (`src/desktop/Formularios.tsx`): remédio, consulta, exame, pessoa e ficha de emergência. A lógica (validação, eventos) fica em `src/data/formularios.ts` e é a mesma do mobile, só a apresentação muda.
  - **Primeiro uso em tela dividida** (no modo real a boas-vindas fica em `/`; `/boas-vindas` existe só para o navegador de telas; depois `/cadastro?passo=1|2|3`): painel de marca de um lado, formulário do outro, em vez da coluna estreita do celular.
  - **Detalhe do remédio** (`/remedios/:id`): no mobile é a M16; no desktop a D05 só lista.
  - **Resumo para consulta** (`/consulta/:id/resumo`): documento imprimível com “Escolher itens”; “Exportar PDF” usa `window.print()`.
  - **Carteirinha em tela cheia** (“Mostrar no balcão” na D06): número grande em fundo escuro, fecha com Esc ou clique.
