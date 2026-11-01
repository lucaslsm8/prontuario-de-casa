# Telas desktop que faltam

Aprovado em 29/10/2026. Hoje, no desktop, o primeiro uso e os formulários aparecem como telas de celular, e três funções só existem no celular. Os mockups não desenham essas telas para desktop; o design abaixo segue o sistema das D01–D08 (tokens em `src/styles/tokens.css`).

## Escopo

1. **Primeiro uso** (M01 + cadastro em 3 passos + restaurar backup) em **tela dividida**.
2. **Formulários** (Novo remédio M06, Nova consulta M18, Adicionar exame M17, Ficha de emergência M14, Adicionar pessoa M02) em **diálogo largo**.
3. **Funções que faltam no desktop**: Detalhe do remédio (M16), Resumo para consulta (M19), carteirinha em tela cheia ("Mostrar no balcão", M09).

Fora: edição de registros (marco 5); Configurações e Atualizações (já cobertas por D07/D08). O mobile não muda visualmente.

## Regra de arquitetura

A lógica de cada formulário (estado, validação, salvar) sai do componente mobile para um hook compartilhado. Mobile e desktop só mudam a apresentação. Funções de conversão (data/hora digitada, data de nascimento) viram funções puras com teste.

## 1. Primeiro uso — tela dividida

- **Painel esquerdo** (44% da largura, entre 420 e 560 px), fundo `--ink`, texto branco, padding 48 px:
  - as três cartas inclinadas da M01 (mesmo componente, extraído);
  - título "A saúde da sua família, organizada num lugar só." (36 px, 600, letter-spacing −.02em);
  - texto "Remédios com lembrete, consultas, exames e a carteirinha do plano, de cada pessoa da casa." (16 px, branco 72%);
  - rodapé: cadeado + "Tudo fica guardado neste aparelho" (13 px, branco 72%).
- **Lado direito**: fundo `--bg`, conteúdo centralizado na vertical, largura máx. 520 px, padding 48×56.
  - **Boas-vindas**: rótulo mono "PRIMEIRO USO", título "Vamos organizar a saúde da casa" (28 px), lista dos 3 passos (1 Você · 2 Alguém da casa (opcional) · 3 Senha do app) em linhas com número mono; botões "Começar" (`btn--ink` h48) e "Restaurar um backup" (link teal). Restaurar abre o diálogo existente (`RestaurarBackup desktop`).
  - **Passos 1–3**: rótulo mono "PASSO N DE 3" + barra de 3 segmentos (`progress-seg`), título (passo 1 "Vamos começar por você", passo 2 "Quem vamos adicionar?", passo 3 "Proteja o app"), subtítulo "Só o nome é obrigatório. O resto pode vir depois." (passos 1–2). Campos em grade de 2 colunas: Nome (2 colunas), Data de nascimento, Tipo sanguíneo (chips mono xs); passo 2 inclui "Parentesco com você" (chips xs). Rodapé: à esquerda "Pular por enquanto" (passo 2, link teal); à direita "Voltar" (`btn--outline` h40d) e "Continuar" (`btn--ink` h40d). Passo 3: texto do desktop atual, botões "Agora não" (outline) e "Criar senha" (ink), que abre `SenhaApp desktop`.
- A moldura em cartão provisória (`is-cartao`) sai.

## 2. Formulários — diálogo largo

- **Diálogo** 640 px, raio 20, `--shadow-modal`, altura máx. `100vh − 48px`:
  - cabeçalho: título 20 px/600 à esquerda, botão × (32 px) à direita, padding 20×24;
  - corpo com rolagem, padding 4×24×20, grade de 2 colunas (gap 14 vertical, 16 horizontal);
  - rodapé fixo com divisória, padding 14×24, botões à direita: "Cancelar" (`btn--outline` h40d) e "Salvar …" (`btn--teal` h40d, desativado sem o campo obrigatório).
  - Esc e clique fora fecham.
- **Campo**: rótulo em cima (13 px, 500, `--text-2`), input desktop 42 px, raio 10, 14 px. Escolhas curtas (pessoa, categoria, lembrar) em chips xs (32 px); listas (dose, frequência, duração, avisar, vincular consulta) em `<select>` nativo com o mesmo visual do input.
- **Novo remédio**: Remédio e dosagem (2 col.) · Para quem (chips, 2 col.) · Dose · Frequência · Horários (chips mono, 2 col.) · Duração · Avisar para repor · Estoque atual (número + unidade) · Lembrete no horário (toggle, 2 col.). Botão "Salvar remédio".
- **Nova consulta**: Especialidade (2 col.) · Para quem (chips) · Data (DD/MM/AAAA) · Hora (HH:MM) · Profissional · Local · Pelo plano (toggle) · Levar (lista com ✓ e "+ Adicionar item", 2 col.) · Lembrar (chips). "Salvar consulta".
- **Adicionar exame**: Páginas (miniaturas + "+", 2 col.) · Nome do exame (2 col.) · De quem (chips) · Categoria (chips) · Data da coleta · Laboratório · Vincular a consulta (select). "Salvar exame".
- **Adicionar pessoa** (fora do primeiro uso): Nome (2 col.) · Data de nascimento · Parentesco (chips) · Tipo sanguíneo (chips). "Adicionar pessoa". Entrada nova: "+ Adicionar pessoa" na seção Pessoas da sidebar.
- **Ficha de emergência**: diálogo de leitura 560 px. Faixa vermelha (`--danger`) com "FICHA DE EMERGÊNCIA" (mono), nome (30 px/700) e idade; depois a mesma ordem da M12 (sangue, alergias em destaque laranja, condições, remédios, plano, contato). Rodapé: "Imprimir" (outline, `window.print()`) e "Fechar" (ink).

## 3. Funções que faltam

- **Detalhe do remédio** (`/remedios/:id`). A linha da tabela D05 passa a abrir esta página (antes ia para a pessoa).
  - Cabeçalho: "← Remédios" (link), título (nome, 26 px), meta "Pessoa · dose · horários"; à direita "Encerrar tratamento" (outline, texto `--danger`), só para remédio ativo.
  - Grade 2 colunas: cartão **Estoque** (dias restantes, barra, "acaba em DD/MM", "Comprei mais"; laranja quando baixo, como na M16) e cartão **Adesão nos últimos 14 dias** (percentual + grade 7×2 da M16, componente extraído).
  - Cartão **Detalhes** (largura total): Receitado por · Indicação · Desde · Lembrete (ligado/desligado, só leitura).
  - "Encerrar tratamento" abre diálogo de confirmação com o texto da M16.
- **Resumo para consulta** (`/consulta/:id/resumo`):
  - Barra: "← Voltar", "Escolher itens" (abre lista de seções com caixas de seleção), "Exportar PDF" (`btn--ink`, `window.print()`).
  - Documento branco centralizado, 760 px, padding 40, com o mesmo conteúdo da M19 (componente do documento extraído e compartilhado).
  - Entradas: botão "Resumo para consulta" na faixa "PRÓXIMA" da D02 e clique numa consulta da agenda D04.
- **Mostrar no balcão** (D06): botão no cartão do plano. Abre camada em tela cheia `#14202A`: operadora (14 px, branco 70%), número em mono 56 px, titular; "Esc ou clique para fechar" (13 px). Fecha com Esc ou clique.

## Verificação

- `npm run build`, `npm test` (inclui os testes novos das funções puras).
- Comparação visual no navegador (1440×900 e 390×844) de cada tela desktop nova e das telas mobile afetadas pela extração (M02, M06, M16, M17, M18, M19), que não podem mudar.
- Navegador de telas (DevBar) ganha atalhos para as telas desktop novas.
