# Handoff: Arquivo de saúde da família (v1)

## Overview
App pessoal (Android + desktop) para uma família de 3 adultos organizar a saúde do dia a dia: membros, perfil clínico básico, remédios com lembrete e estoque, consultas, exames (fotos/PDF) e plano de saúde brasileiro (carteirinha, ANS, CNS). Idioma: **pt-BR**. Dados **locais** no aparelho, com backup criptografado.

**Fora do escopo da v1:** prontuário eletrônico (EMR), telemedicina, integração automática com operadoras, qualquer IA diagnóstica.

Usuários reais: o autor, o pai e a mãe. Nos mockups: **Helena** (logada, 56), **Roberto** (61, compartilha o perfil completo com ela), **Pedro** (compartilha só remédios e plano). Operadora "Vitalis Saúde", ANS 000000, números de carteirinha e telefones são **fictícios**.

## About the Design Files
O arquivo `Arquivo de Saude Familiar.dc.html` é uma **referência de design em HTML**: mostra aparência e conteúdo, não é código de produção. A tarefa é **recriar estas telas** num stack apropriado. Não existe codebase ainda; sugestão (decida você):
- **Tauri 2** (desktop + Android com uma base web) ou **Flutter**/**Kotlin Multiplatform**.
- Banco local: **SQLite** criptografado (SQLCipher) ou equivalente.

Abra o HTML no navegador: é um canvas com todas as telas lado a lado. Cada tela tem `data-screen-label` (ex.: `M07 Agenda`, `D03 Exames`).

## Fidelity
**Hi-fi.** Cores, tipografia, espaçamentos, raios e textos são finais. Recrie fielmente. Textos em pt-BR devem ser mantidos como estão.

## Decisões de produto e técnicas (já tomadas)
1. **Plataformas:** somente **Android** e **desktop** (Windows/macOS/Linux). Sem iOS.
2. **Modelo de conta:** cada adulto gerencia o próprio perfil no próprio aparelho e escolhe o que compartilhar com cada pessoa, por categoria: Perfil clínico, Remédios, Consultas, Exames, Plano. Também é possível cadastrar pessoas sem celular (dependentes que você cuida).
3. **Privacidade:** dados ficam no aparelho. Nada vai para servidor de terceiros. Bloqueio por biometria/PIN (Android) ou senha (desktop), com bloqueio por inatividade. Opção de esconder o nome do remédio nas notificações ("Hora do remédio do Roberto"). A comunicação de privacidade na UI é **discreta**: só um ícone de cadeado e o texto nas Configurações.
4. **Backup:** arquivo criptografado com senha (`.fsaude`), manual ou automático (semanal), em pasta escolhida pelo usuário. Restaurar no onboarding (M01) e nas Configurações.
5. **Atualizações via GitHub Releases:**
   - Desktop: updater nativo (ex.: `tauri-plugin-updater` ou `electron-updater`) lendo o GitHub Releases, com verificação de assinatura.
   - Android: o app consulta a API de Releases, baixa o APK assinado e abre o instalador do sistema (permissão `REQUEST_INSTALL_PACKAGES`, que o usuário concede uma vez). Verifique a assinatura/hash antes de instalar.
   - Frequência configurável: **1x por dia** (padrão) ou **1x por semana**. Opção "Backup antes de atualizar" vem **ligada**.
   - Telas: M22, M23, D08.
6. **Sincronização entre aparelhos: A DEFINIR (decisão do Claude Code).** Requisitos:
   - Quando alguém adiciona ou edita um dado compartilhado, os aparelhos autorizados devem receber a mudança.
   - Manter o espírito "sem servidor de terceiros com dados em claro". Opções a avaliar: P2P na rede local (mDNS + TLS), relay com criptografia ponta a ponta, CRDT/log de eventos (ex.: Automerge, cr-sqlite), ou uma pasta sincronizada do próprio usuário com o arquivo criptografado.
   - Resolver conflitos com regras simples. Cada pessoa é dona dos próprios registros. Doses marcadas são eventos só de adição (append-only).
   - O pareamento inicial na UI é por **QR code** (M13). O status aparece como "Última sincronização entre aparelhos: hoje, 08:12 · conexão direta" (D07). Ajuste o texto conforme a solução escolhida.

## Screens / Views

### Shell mobile (todas as telas M*)
- Frame de referência 390×844, fundo `#F4F7F7`.
- Status bar 48px. Conteúdo com padding `14px 20px`.
- **Tab bar flutuante:** posição absoluta a 16px das laterais e 26px do fundo. Altura 62, raio 22, fundo `#14202A`. Itens com 12px/600, cor `#A7B4BB`. O item ativo vira uma pílula de 46px de altura, raio 16, fundo `#E3F0F0`, texto `#14202A`.
- Abas: **Início · Agenda · Remédios · Exames · Família**.
- Título de tela: 28px/600, letter-spacing −0.02em.
- Botão "+" de criar: 44×44, raio 14, fundo `#1F6E74`.
- CTA primário de rodapé: altura 54, raio 14, fundo `#14202A`, texto branco 16/600, preso ao fim do conteúdo (`margin-top:auto`). Telas com tab bar devem respeitar a área dela.

### Shell desktop (todas as telas D*)
- Referência 1280×800.
- Sidebar de 232px, fundo branco, borda direita `#DFE6E7`. Em cima, "Família Almeida" 16/600. Navegação: Início, Agenda, Remédios, Exames, Planos de saúde (14px, padding 10/12, raio 10; ativo com fundo `#E3F0F0` e peso 600). Abaixo, a seção "PESSOAS" com avatares de 26px. No rodapé, cadeado + "Privacidade e backup".
- Conteúdo com padding 28–32px / 32–36px.

### Mobile
| ID | Tela | Propósito / conteúdo-chave |
|---|---|---|
| M01 | Boas-vindas | Três cartões empilhados com rotação (−4°, 3°, −1.5°) mostrando plano, dose e consulta. Título "A saúde da sua família, organizada num lugar só." e subtítulo. Cadeado + "Tudo fica guardado neste aparelho". Botões "Começar" (primário) e "Restaurar um backup" (texto teal). |
| M02 | Cadastro de membro | Passo 2 de 3 com barra de progresso segmentada (3 × 4px). Título "Quem vamos adicionar?". Campos Nome (foco: borda 1.5 `#1F6E74`) e Data de nascimento (mono). Chips de parentesco: Cônjuge, Filho(a), Pai ou mãe, Outro. Grade 5 col de tipo sanguíneo (A+…O−, "Não sei" ocupando 2 col). Só o nome é obrigatório. |
| M03 | Início | Saudação com data. Pilha de avatares da família. 3 indicadores: doses hoje, consultas no mês, estoque baixo (em laranja). Lista "HOJE" com as doses (tomadas ficam esmaecidas com pílula "Tomado"; pendente tem botão "Marcar"). "PRÓXIMOS" com data em bloco (mês mono 10px + dia 20/600). |
| M04 | Perfil do membro | Avatar 60, nome, "61 anos · cônjuge · compartilha tudo com você". Faixa de 3 colunas (Sangue/Peso/Altura). Cartão de alergia (fundo `#FBEEE8`). Condições e histórico com anos. Links para Remédios / Consultas / Exames / Plano. Botão contornado "Ficha de emergência" → M14. |
| M05 | Remédios | Segmentado Em uso / Encerrados. Chips por pessoa. Cartões com dose e horário e barra de estoque de 5px (teal; laranja `#C4643E` quando baixo, com pílula "Repor"). "Se necessário" não tem horário. |
| M06 | Novo remédio | Nome+dosagem, Para quem, Dose, Frequência, Horários (chips mono teal-claro gerados pela frequência), Duração, Lembrete (toggle), Estoque atual, Avisar para repor (N dias antes), foto da receita (opcional). CTA "Salvar remédio". |
| M07 | Agenda | Mês com setas e faixa da semana (dia selecionado preto; ponto teal = consulta, laranja = exame). Grupos por dia (mono 11px caixa alta). Cartão de consulta com hora, duração, profissional, pessoa, endereço, checklist "Levar" e ações "Lembrar 1 dia antes" / "Como chegar". |
| M08 | Exames | Busca, chips de categoria, agrupamento por mês. Miniatura 44×54 (tipo PDF/FOTO) + nome, pessoa, data e laboratório. |
| M09 | Plano / carteirinha | Cartão escuro `#14202A` (operadora, ANS, número mono 21px, titular, plano, validade). Botões "Mostrar no balcão" (abre o número em tela cheia, com brilho no máximo) e "Copiar nº". Lista: Acomodação, Segmentação, Abrangência, Carências, CNS, Central 24 h (link de ligação). Aviso: "Informações digitadas por você…". |
| M10 | Privacidade | Texto curto explicativo. Toggles de biometria e de esconder nome do remédio. Tempo de bloqueio. Backup (último, tamanho, frequência, "Fazer agora" / "Restaurar"). Lista "Compartilhado com você". Ação destrutiva "Apagar todos os dados deste aparelho" (`#B23A2A`, pede confirmação dupla). |
| M11 | Desbloqueio | Fundo `#14202A`, ícone de cadeado em quadrado teal 72 r22. Indicador de 6 dígitos do PIN. Teclado de círculos 72px `#22323D`, com "Biometria" e "Apagar". Link "Acesso de emergência" → M14 sem desbloquear (só se o usuário ativou). |
| M12 | Família (aba) | Seu cartão. "COMPARTILHADOS COM VOCÊ" com pílulas do que cada pessoa compartilha. "VOCÊ COMPARTILHA COM". Botão tracejado "Convidar ou adicionar pessoa". |
| M13 | Compartilhar meu perfil | Passo 1 de 2: "O que o Pedro pode ver?" com toggles por categoria. Área de QR (placeholder) com o texto do próximo passo. CTA "Gerar código". O passo 2 (leitura do QR no outro aparelho) não foi desenhado; segue o mesmo padrão. |
| M14 | Ficha de emergência | Cabeçalho vermelho `#B23A2A` com nome grande 30/700. Sangue, alergia em destaque, condições, remédios, plano. Botão de ligar para o contato de emergência. Texto grande, legível por terceiros. |
| M15 | Lembrete (tela bloqueada) | Notificação com o nome escondido e as ações **Tomei / Lembrar em 15 min / Pular esta dose**. Usar as ações nativas de notificação do Android. |
| M16 | Detalhe do remédio | Cabeçalho, cartão de estoque baixo ("Comprei mais" atualiza o estoque, "Ver receita"), adesão dos últimos 14 dias (grade 7×2: preenchido = tomada; tracejado laranja = perdida), receitado por, indicação, lembrete. "Encerrar tratamento". |
| M17 | Adicionar exame | Páginas capturadas (foto/PDF, várias) + adicionar página. Nome, de quem, categoria (Sangue, Urina, Imagem, Coração, Outro), data da coleta, laboratório, vincular a consulta. |
| M18 | Nova consulta | Especialidade, para quem, data/hora, profissional, local, pelo plano, checklist "Levar", lembrete (2 h / 1 dia / 1 semana). |
| M19 | Resumo para consulta | Documento gerado a partir de um membro + consulta: identificação, alergias, condições, remédios com % de adesão em 30 dias, exames anexados, perguntas do paciente. "Exportar PDF" / "Mostrar na tela". "Escolher itens" permite incluir ou excluir seções. |
| M20 | Início vazio | Checklist "Vamos começar" (4 passos com progresso) + cartão tracejado "Mais alguém da casa?". |
| M21 | Exames vazio | Ilustração de folhas (só divs), "Nenhum exame ainda", "Fotografar laudo" / "Importar PDF". |
| M22 | Atualizações | Versão instalada. Cartão da nova versão (notas, "Baixar e instalar · 14 MB", "Publicada ontem no GitHub Releases · assinatura conferida"). Toggle de procurar automaticamente. Segmentado 1x por dia / 1x por semana. Toggle de backup antes. Última verificação. Histórico de versões. |
| M23 | Instalando | Etapas com status: Backup criptografado → Download e assinatura → Instalando (barra %). Aviso de que o Android vai pedir confirmação. |

### Desktop
| ID | Tela | Conteúdo-chave |
|---|---|---|
| D01 | Início | Saudação + ações "Adicionar exame" / "Nova consulta". 4 indicadores (o último em laranja: "Repor em breve"). Duas colunas: Remédios de hoje (com hora em que foi tomado) e Próximos 30 dias. |
| D02 | Perfil clínico | Cabeçalho do membro. Abas Perfil clínico/Remédios/Consultas/Exames/Plano (ativa com sublinhado 2px `#14202A`). 5 indicadores (alergia em laranja). 3 cartões (Condições, Remédios em uso, Exames recentes). Faixa "PRÓXIMA". |
| D03 | Exames | Lista à esquerda (440px; item selecionado com borda 1.5 teal) + painel de visualização (pré-visualização do laudo, metadados, anotação). |
| D04 | Agenda (mês) | Grade 7×5 com eventos em pílulas (consulta `#E3F0F0`/`#14484C`, exame `#FBEEE8`/`#7A3519`) e legenda. |
| D05 | Remédios | Tabela: Remédio · Pessoa · Horários · Adesão 30 d · Estoque. Linha com estoque baixo em fundo `#FDF8F6`. Lista de encerrados recentes. |
| D06 | Planos de saúde | Cartões de todos os planos da família (o selecionado tem outline teal). Grade de detalhes 2 col (ANS, segmentação, abrangência, acomodação, carências, CNS, central, mensalidade). Imagens frente/verso da carteirinha. Anotação. |
| D07 | Privacidade e backup | Bloqueio, backup (arquivo, pasta, ações). **Matriz de compartilhamento** (pessoa → categorias ✓/—): o que você compartilha você edita; o que os outros compartilham aparece como "definido por ele". Status de sincronização. |
| D08 | Atualização disponível | Modal 520px sobre o app, com overlay `rgba(20,32,42,.38)`. Versão, origem, notas, checkbox de backup antes, "Lembrar amanhã" / "Instalar e reiniciar". |

## Interactions & Behavior
- **Marcar dose:** registra `tomada_em` com a hora real. A linha fica esmaecida (`#8C9AA2`) com a pílula "Tomado HH:MM". Desfazer por 5 s (toast).
- **Estoque:** cada dose tomada desconta do estoque. Fica "baixo" quando os dias restantes são ≤ o valor de "Avisar para repor". Nesse ponto aparece no Início e chega uma notificação.
- **Lembretes:** notificações locais agendadas (AlarmManager/WorkManager no Android; notificações do SO no desktop), com ações Tomei / Adiar 15 min / Pular.
- **Bloqueio:** ao abrir e após a inatividade configurada (padrão de 1 min no mobile, 5 min no desktop).
- **Ficha de emergência:** acessível sem desbloquear somente se o usuário ativar.
- **Formulários:** só o nome é obrigatório no cadastro. Datas em `DD/MM/AAAA`. Números em formato BR (`1,74 m`, `R$ 1.240,00`).
- **Atualização:** checagem em background na frequência escolhida. Se "Backup antes" estiver ligado, gerar o backup antes de instalar. Se a instalação falhar, oferecer restaurar o backup.
- **Ações destrutivas:** sempre com confirmação. "Apagar todos os dados" pede que o usuário digite uma palavra de confirmação.
- **Estados vazios:** M20 e M21 são o padrão. Repita o tom (frase curta + 1–2 ações) nas outras listas.
- **Transições:** sem animação específica. Use 150–200 ms ease-out em toggles, seleção de chips e modais.

## Modelo de dados (sugestão)
- `Pessoa` (id, nome, nascimento, sexo, parentesco, tipo_sanguineo, peso, altura, cor_avatar, dono_device_id)
- `Alergia` (pessoa_id, substancia, reacao, ano)
- `Condicao` (pessoa_id, nome, desde, tipo: condição | cirurgia | vacina)
- `Remedio` (pessoa_id, nome, dosagem, dose, frequencia, horarios[], inicio, fim/continuo, se_necessario, estoque, avisar_dias, receita_arquivo, receitado_por, indicacao, ativo)
- `Dose` (remedio_id, previsto_para, status: tomada | pulada | perdida, registrado_em) — append-only
- `Consulta` (pessoa_id, especialidade, profissional, local, data_hora, duracao, pelo_plano, levar[], lembretes[], notas)
- `Exame` (pessoa_id, nome, categoria, data_coleta, laboratorio, solicitante, consulta_id?, arquivos[], anotacao)
- `Plano` (pessoa_id, operadora, registro_ans, numero, produto, acomodacao, segmentacao, abrangencia, carencias, validade, titular/dependente, cns, central, mensalidade, vencimento, imagens[], anotacao)
- `Compartilhamento` (de_pessoa, para_pessoa, categorias[])
- `Config` (bloqueio, timeout, esconder_nome_notif, backup_freq, backup_pasta, update_freq, backup_antes_update)

## Design Tokens
**Cores**
- Fundo app `#F4F7F7` · Superfície `#FFFFFF` · Canvas/borda do frame `#D3DBDD`
- Borda de cartão `#DFE6E7` · Divisor interno `#E9EEEF` · Borda de input/botão secundário `#C3CED1`
- Tinta `#14202A` · Texto secundário `#5B6B75` · Texto terciário/desativado `#8C9AA2` · Tab inativa `#A7B4BB`
- Escuro secundário (teclado, cartão 2) `#22323D`
- Primária (teal) `#1F6E74` · Teal claro (fundo selecionado/pílulas) `#E3F0F0` · Teal escuro (texto em fundo claro) `#14484C` · Teal em fundo escuro `#7FC4C8`
- Alerta: fundo `#FBEEE8`, barra `#C4643E`, texto `#9A4524`, texto forte `#7A3519`, trilho `#F2D9CD`, linha `#FDF8F6`
- Destrutivo/emergência `#B23A2A`
- Avatares: Helena `#D6E8E9`, Roberto `#E2E0EE`, Pedro `#EEE7D6`
- Segmentado (trilho) `#E3E9EA` · Toggle desligado `#D3DBDD`
- Placeholder listrado: `repeating-linear-gradient(135deg,#EEF2F3 0 6px,#E3E9EA 6px 12px)`

**Tipografia**
- Base: **IBM Plex Sans** 400/500/600/700. Números, horários, códigos e rótulos de seção: **IBM Plex Mono** 400/500.
- Escala: 88 (relógio da tela bloqueada) · 32 (título de página no desktop) · 28 (título mobile) · 26 · 24 · 20–22 (números de indicador) · 17–18 · 16 (corpo forte e inputs) · 15 (corpo) · 14 · 13 · 12 (meta) · 11 (rótulo mono caixa alta, letter-spacing .1em) · 10.
- Títulos com letter-spacing −0.02em.

**Raios:** 44 (frame do celular) · 22 (tab bar) · 20 (cartão de carteirinha) · 16 (cartões) · 14 (CTA, botão +) · 12 (inputs) · 10 (botões desktop, chips de horário) · 99 (pílulas e chips).

**Espaçamento:** gaps de 4/6/8/10/12/14/16/18/20/22/24; padding de cartão 14–16 (mobile) e 16–20 (desktop); linhas de lista com 12–14 vertical.

**Sombras:** frame `0 30px 60px -30px rgba(20,40,50,.3)` · carteirinha `0 20px 40px -24px rgba(20,40,50,.6)` · modal `0 40px 80px -30px rgba(10,20,30,.5)` · segmento ativo `0 1px 2px rgba(20,40,50,.1)`.

**Alvos de toque:** mínimo de 44px no mobile (os chips de 34–40px ficam com área de toque de 44).

**Ícones:** os mockups quase não usam ícones (só o cadeado em divs, ✓ e ›). Use uma biblioteca de ícones de traço fino e consistente (ex.: Lucide), com parcimônia.

## Assets
Não há imagens finais. Placeholders listrados indicam: miniaturas de exame, pré-visualização de PDF, frente/verso da carteirinha e QR code (gerar de verdade).

## Files
- `Arquivo de Saude Familiar.dc.html`: todas as 31 telas (23 mobile + 8 desktop). Abra direto no navegador; `support.js` é o runtime necessário para renderizar.
