# Pets: Mel e Thor

Aprovado em 29/10/2026. Depende do perfil com foto e edição (`2026-10-29-perfil-foto-design.md`). O app é só da família, e os dois cachorros entram como perfis próprios.

## Onde aparecem

- **Nas mesmas telas da família, separados por uma divisória** com o rótulo "Pets" (mono 11 px, caixa alta, `--text-3`, linha `--divider`):
  - sidebar (desktop): seção "Pessoas" e, abaixo, "Pets";
  - Família (celular): lista de pessoas e, abaixo, "Pets";
  - Início, Remédios, Agenda, Exames: os itens dos pets ficam num grupo "Pets" depois dos da família;
  - "Para quem" nos formulários: pessoas, separador e pets.
- Sem compartilhamento por categoria: os pets são da casa, e todo mundo vê e edita. Não aparecem na matriz de compartilhamento (D07/M13).

## Dados

- `Pessoa` ganha `tipo?: 'pessoa' | 'pet'` (ausente = pessoa) e, para pets, `pet?: DadosPet`:
  - `especie: 'cachorro'` (só cachorro por enquanto), `raca`, `castrado?: boolean`, `microchip?: string`;
  - `veterinario?: { nome; clinica?; telefone? }`, `clinica24h?: { nome; telefone }`.
- O peso do pet vem do histórico: `pesagens: { data; kg }[]`. O peso exibido é o da última pesagem.
- Entidades novas no estado (eventos append-only, mesmo padrão de `addExame`):
  - `Vacina { id, pessoaId, nome, data, lote?, veterinario?, proxima? }` (evento `addVacina`);
  - `Prevencao { id, pessoaId, tipo: 'vermifugo' | 'antipulgas' | 'outro', produto, data, intervaloDias }` (evento `addPrevencao`). A próxima é `data + intervaloDias`;
  - `Sintoma { id, pessoaId, data, sinais: string[], nota? }` (evento `addSintoma`), com sinais de uma lista fixa: Vômito, Diarreia, Coceira, Apatia, Falta de apetite, Tosse, Mancando, Outro;
  - `Procedimento { id, pessoaId, data, tipo: 'Cirurgia' | 'Castração' | 'Limpeza de tártaro' | 'Exame de imagem' | 'Outro', descricao?, clinica?, nota? }` (evento `addProcedimento`);
  - `Pesagem { pessoaId, data, kg }` (evento `pesagem`).
- Remédios, consultas e exames dos pets usam os tipos existentes (`pessoaId` do pet). Consulta de pet tem como título padrão "Veterinário".

## Lembretes (marco 3)

- `proximosLembretes` também gera:
  - **reforço de vacina**, às 09:00 do dia `proxima`: "Vacina da Mel: V10 hoje";
  - **prevenção**, às 09:00 do dia da próxima aplicação: "Antipulgas do Thor hoje".
- Sem botões de ação, como nas consultas. Ids `vacina|<id>` e `prevencao|<id>`.

## Perfil do pet

- **Cabeçalho:** foto, nome, "Cachorro · raça · sexo · N anos · nasc. DD/MM/AAAA". Indicadores: Peso (última pesagem e data) · Castrado(a) · Microchip · Veterinário (nome + ligar) · Clínica 24 h (ligar).
- **Abas (desktop) / seções (celular):**
  - **Resumo:** próximas vacinas e prevenções, remédios em uso, últimos sintomas;
  - **Vacinas:** tabela com vacina, data, lote, veterinário e próximo reforço (laranja se vencido), mais "+ Registrar vacina";
  - **Prevenção:** lista por tipo, com produto, última aplicação, próxima e "Apliquei hoje" (registra nova aplicação com o mesmo intervalo);
  - **Sintomas:** diário (data, chips dos sinais, nota) e "+ Registrar sintoma" (chips multi-seleção + nota + data, padrão hoje);
  - **Procedimentos:** lista com data, tipo, clínica e observações, e "+ Registrar procedimento";
  - **Peso:** lista de pesagens e "+ Nova pesagem";
  - **Remédios, Consultas, Exames:** iguais às das pessoas, filtrados pelo pet.
- **Editar perfil do pet:** mesmo diálogo/tela da spec de perfil, com os campos do pet no lugar dos humanos (nome, nascimento, sexo, raça, castrado, microchip, veterinário, clínica 24 h, alergias). Sem tipo sanguíneo, altura, pressão ou contato humano.
- **Cadastro:** "+ Adicionar pet" na seção Pets (sidebar e Família). Diálogo/tela com nome, raça, sexo, nascimento, peso atual e castrado.

## Formulários novos

Desktop em diálogo largo (kit `DDialogo`) e celular em tela, com a lógica em hooks em `src/data/formularios.ts`:

- "Registrar vacina": vacina (com sugestões V8, V10, Antirrábica, Gripe canina, Giárdia, Leishmaniose), data, lote, veterinário, próximo reforço (atalhos: 1 ano, 6 meses, 21 dias);
- "Registrar prevenção": tipo, produto, data, a cada N dias (atalhos 30/90);
- "Registrar sintoma";
- "Registrar procedimento";
- "Nova pesagem".

## Resumo para consulta e ficha de emergência

- O resumo (M19 e desktop) de uma consulta de pet troca as seções humanas por: Identificação do pet, Peso (últimas 3 pesagens), Alergias, Remédios em uso, Vacinas (últimas e próximas), Prevenção, Sintomas dos últimos 30 dias e Procedimentos.
- Ficha de emergência do pet: peso, alergias, microchip, remédios em uso, veterinário e clínica 24 h com ligação.

## Dados de exemplo

O seed ganha a Mel e o Thor, com raça, foto vazia, 2 vacinas cada (uma com reforço próximo), uma prevenção, um sintoma recente da Mel e uma castração do Thor, para as telas aparecerem preenchidas no `npm run dev`.

## Verificação

- Testes (Vitest):
  - reducer dos eventos novos;
  - cálculo da próxima prevenção;
  - lembretes de vacina/prevenção em `proximosLembretes`;
  - agrupamento "família / pets" nas listas.
- Navegador, desktop e celular:
  - cadastrar um pet;
  - registrar cada tipo;
  - ver o grupo "Pets" separado em Início, Remédios, Agenda e Exames;
  - resumo e ficha do pet.
