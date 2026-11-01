# Histórico e passagem de contexto

Resumo das sessões em que o projeto foi criado (Claude, out/2026), para quem continuar o trabalho.

## O que foi pedido

- Recriar fielmente (hi-fi) os mockups do handoff `docs/design/` num app de verdade.
- **Precisa gerar um executável `.exe` para Windows.** Foi o requisito explícito dele na escolha da stack; daí o **Tauri 2**. Android vem depois, do mesmo código.
- Usuários reais: ele, o pai e a mãe. Conversa e textos do app em **português**. Ele é designer de produto sênior: valoriza fidelidade visual e respostas curtas.

## Linha do tempo

1. **Marco 1**: projeto Tauri 2 + React/TS + Vite. As 31 telas (M01–M23, D01–D08) recriadas e comparadas lado a lado com o HTML de referência (capturas com Playwright). Dados de exemplo em memória. Navegador de telas para desenvolvimento.
2. **Marco 2**: persistência real. Log de eventos cifrado em SQLite (XChaCha20-Poly1305, chave no Gerenciador de Credenciais do Windows), primeiro uso em 3 passos, PIN/senha com Argon2id, backup `.fsaude` (manual, semanal, restaurar, trocar senha), apagar tudo, adesão calculada das doses, datas reais fora do modo exemplo.
3. **Telas desktop (29/10/2026)**: primeiro uso em tela dividida, formulários em diálogo largo, detalhe do remédio, resumo para consulta e carteirinha em tela cheia. Atalhos "D·…" no navegador de telas. A impressão da ficha de emergência e do resumo agora corre em várias páginas.
4. **Perfil com foto (29/10/2026)**: foto no lugar das iniciais em todo avatar, cabeçalho do perfil mais completo (D02, M10) e "Editar perfil" funcionando no desktop (diálogo) e no celular (tela). A foto é cortada em quadrado e reduzida para 384×384 JPEG antes de entrar no log. Atalhos "D·Editar perfil" e "M·Editar perfil" no navegador de telas. Spec em `docs/superpowers/specs/2026-10-29-perfil-foto-design.md`.
5. **Pets (30/10/2026)**: Mel e Thor como pessoas do tipo `pet`, com vacinas, prevenção, sintomas, procedimentos e pesagens, formulários no desktop e no celular, lembretes de reforço e prevenção, divisória "Pets" nas listas, resumo veterinário e ficha de emergência do pet. Atalhos "D·Pet", "M·Pet", "D·Vacina" e outros no navegador de telas. Spec em `docs/superpowers/specs/2026-10-29-pets-design.md`.

## Decisões tomadas (e por quê)

| Decisão | Motivo |
|---|---|
| Tauri 2 em vez de Flutter/KMP | Gera `.exe` (NSIS/MSI) e APK de uma base web, e permite recriar o hi-fi com CSS. |
| SQLite comum + criptografia no app, **não SQLCipher** | O SQLCipher no Windows exige compilar OpenSSL (Perl, NASM); travaria o `app:build` no Windows. |
| Log de eventos (append-only) como modelo de dados | Atende "doses só de adição" e prepara a sincronização. |
| Sincronização (ainda não feita): LAN direta (mDNS + Noise) + pasta sincronizada do usuário com `age` | O handoff deixou a escolha em aberto, com a regra "sem servidor de terceiros com dados em claro". Detalhes em `ARQUITETURA.md`. |
| Modo exemplo × modo real (`src/data/tempo.ts`) | O navegador mostra os mockups (hoje = 28/10/2026); o app instalado começa vazio, com a data real. |
| Modal de atualização (D08) só abre por busca manual | O updater real ainda não existe; não mostrar uma "versão nova" falsa. |
| Formulários do desktop em diálogo largo próprio, com a lógica compartilhada em `src/data/formularios.ts` | Não havia desktop desenhado para formulários; o diálogo com a tela mobile dentro ficava apertado. |
| Pet é uma `Pessoa` com `tipo: 'pet'` | Reaproveita perfil, remédios, consultas, exames, lembretes e ficha de emergência; só os registros veterinários são novos. |
| Pets ficam fora do compartilhamento | Pet é da casa, não de um dono com privacidade própria; não há o que escolher compartilhar. |
| Foto dentro do log de eventos | Fica cifrada e entra no backup `.fsaude`, sem arquivo solto no disco. |

## O que foi verificado

- `npm run build` sem erros de tipo; `cargo test` com 6 testes (cofre, senha, banco cifrado sem texto legível, chave errada detectada, substituir log, backup ida e volta / senha errada).
- Fluxo real completo no navegador com `?persistir=1`: primeiro uso, data inválida bloqueada, PIN errado/certo, dose persistida após recarregar, estoque descontado, backup, apagar tudo, restaurar com senha errada/certa.
- Binário nativo compilado e rodado em **Linux** (Xvfb): cria o banco cifrado, onboarding funciona e os dados voltam ao reabrir. O arquivo do banco não contém nomes legíveis.
- **Windows 11 (29/10/2026)**: `npm run build`, `cargo test` (6 ok) e `npm run app:dev` no PC de desenvolvimento (Rust 1.99.1 + VS Build Tools 2022). A chave do banco vai para o Gerenciador de Credenciais (`chave-do-banco.br.familia.arquivosaude`) e o primeiro uso no app nativo funcionou.

## O que NÃO foi verificado

- O instalador (`npm run app:build`) ainda não foi gerado nem instalado no Windows.
- O fluxo nativo de escolher pasta/arquivo (`tauri-plugin-dialog`) só foi testado na versão simulada do navegador.

## Pendências conhecidas e detalhes

- "Editar" de remédios, consultas, exames e planos ainda não funciona (o do perfil já funciona). Botões "Ver receita", "Fotografar receita/laudo", "Abrir PDF" e "Exportar" são só visuais. "Exportar PDF" do resumo usa `window.print()`.
- No passo 2 do primeiro uso, o "Voltar" depois de salvar o passo 1 não é ideal.
- A biometria só aparece no modo exemplo; a real entra com o Android.
- Ícones do app gerados a partir de `app-icon.svg` com `npx tauri icon app-icon.png`.
- Dados de exemplo: a consulta do dentista (18/11) não está no seed de propósito, para bater com M03/D01. Ela aparece quando se salva a M18, que vem pré-preenchida com o dentista.

## Próximo passo sugerido

1. No Windows: `npm run app:build` e instalar o `.exe` gerado.
2. `git init` + primeiro commit (a pasta ainda não é repositório) e publicar no GitHub (necessário para o updater via Releases).
3. Marco 3: lembretes (notificações do sistema com Tomei / 15 min / Pular).
