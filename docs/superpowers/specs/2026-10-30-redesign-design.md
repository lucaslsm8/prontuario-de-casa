# Redesign — casca e Início (variação "1 · Cartão escuro")

Data: 30/10/2026. Referência visual: quadro de direções (V1 desktop e celular), já com o arredondamento reduzido que foi aprovado.

## Por quê

O app parecia "morto": tinha pouca cor, a tipografia não tinha voz, tudo era o mesmo cartão branco e nada se mexia. A V1 resolve isso com quatro mudanças:

- um cartão escuro com a dose da vez em destaque;
- a linha do dia;
- ícones na navegação;
- cantos menos redondos.

Tudo isso mantendo o teal, a IBM Plex e os textos atuais.

## Escopo

1. **Tokens.** Os raios diminuem e entram dois tokens para o cartão escuro. Isso vale para o app inteiro.
2. **Casca do desktop.**
   - **Barra lateral:**
     - topo: a marca, com o selo escuro e "Arquivo / da família";
     - navegação: cada item ganha um ícone, e o item ativo fica escuro (`--ink`) com texto branco;
     - listas PESSOAS e PETS: continuam iguais;
     - pé: "Privacidade e backup", o botão vermelho-claro **Ficha de emergência** (abre `?abrir=emergencia:<eu>`) e o cartão de quem está usando.
   - **Cartão de quem está usando:** mostra avatar, nome e o estado do backup ("Backup hoje, 08:12" / "Sem backup ainda") e leva para Privacidade.
   - Não existe sincronização, então o texto "Sincronizado" do mockup não entra.
3. **Casca do celular.** A tab bar continua escura, com raio 10 e o item ativo com raio 6.
4. **Início no desktop (D01).**
   - **Cabeçalho:** a data `Quarta-feira, 28/10/2026`, a saudação pelo horário ("Bom dia", "Boa tarde", "Boa noite") e os botões Adicionar exame e Nova consulta.
   - **Coluna principal:** o cartão da dose e o cartão "Doses de hoje" (linha do dia e lista com PESSOAS e PETS).
   - **Coluna direita (280 px):**
     - os três números: doses de hoje (com quantas estão atrasadas), próxima consulta e estoque baixo;
     - "Remédio acabando", com 10 blocos e o botão Comprei mais;
     - "Próximos compromissos", com até 3 itens, um bloco de data e "em N dias".
5. **Início no celular (M03).** De cima para baixo:
   - saudação;
   - cartão da dose: Tomei em largura total, com "Lembrar em 15 min" e "Pular" embaixo;
   - cartão "Doses de hoje", com a linha do dia e a lista;
   - "Remédio acabando", em linha compacta, quando houver;
   - "Próximos".
   - A tela de primeiro uso (M20) não muda.

Ficam fora desta etapa:
- o layout das outras telas, que só herdam os tokens;
- os raios escritos direto no código das outras telas (inline), que serão trocados quando cada tela for redesenhada.

## Tokens (`src/styles/tokens.css`)

| Token | Antes | Depois |
|---|---|---|
| `--r-tabbar` | 22 | 10 |
| `--r-plan` | 20 | 12 |
| `--r-card` | 16 | 10 |
| `--r-cta` | 14 | 8 |
| `--r-input` | 12 | 6 |
| `--r-btn` | 10 | 6 |
| `--r-pill` | 99 | 6 |
| `--hero-bg` (novo) | não existe | `#14202A` |
| `--hero-2` (novo) | não existe | `#22323D` |

Os raios fixos em `components.css` e `shell.css` (botões, segmentado, stat, diálogo, sheet, toast e sidebar) passam a usar esses tokens ou valores equivalentes. Avatares e pontos continuam redondos.

## Comportamento do cartão da dose

O cálculo fica numa função pura em `src/data/inicio.ts`, com testes.

### Qual dose aparece

- **Candidatas:** as doses de hoje sem registro.
- **Ordem:** pelo horário. Doses atrasadas aparecem antes das futuras porque têm horário menor.
- **Doses adiadas:** saem da vez até `adiadaAté` e depois voltam.
  - Se só sobrarem doses adiadas, aparece a primeira delas, com o rótulo "LEMBRAR ÀS HH:MM".

### Rótulo do cartão

| Situação | Rótulo | Cor |
|---|---|---|
| Atrasada mais de 15 min | "ATRASADA HÁ 6 H 20 MIN" (horas omitidas quando forem 0) | ponto vermelho pulsando |
| Até 15 min antes ou depois do horário | "AGORA" | teal-claro |
| Ainda vai ser | "PRÓXIMA · EM 40 MIN" | cinza |

### Conteúdo do cartão

- Hora grande.
- Nome do remédio. A concentração aparece em teal-claro, separada do nome ("Apoquel" + "16 mg") quando o nome termina em número e unidade.
- Na linha de baixo: quem toma (em negrito) · a dose cadastrada (`r.dose`, por exemplo "½ comprimido").

### Quando não há dose para mostrar

- Todas registradas: "Tudo em dia hoje", com a próxima dose de amanhã (o menor horário dos remédios de hoje).
- Nenhuma dose com horário hoje: "Nenhum remédio com horário hoje" e o botão Cadastrar remédio.

### Ações

| Ação | O que faz |
|---|---|
| **Tomei** | `api.marcarDose(id, h)` |
| **Pular** | `api.marcarDose(id, h, 'pulada')` |
| **Lembrar em 15 min** | Guarda `adiadaAté = agora + 15` só na tela; não é dado de saúde e não persiste. O lembrete do sistema continua como está (o "15 min" da notificação já existe no Rust). Mostra o aviso "Vou lembrar às HH:MM", com Desfazer. |

Tomei e Pular são eventos que já existem no log. O aviso com Desfazer também já existe.

### Troca de dose

Quando a dose muda, o cartão entra com `fade + translateY(10px)` em 200 ms (`var(--ease)`), usando `key` para remontar.

### "Agora"

Vem de `useAgora()`, em `src/data/useAgora.ts`:
- no modo real, é o relógio, atualizado a cada 30 s;
- nos dados de exemplo, é fixo em 14:20, para bater com o mockup.

## Linha do dia

- A escala vai de 06:00 a 22:00, com marcas em 06:00, 10:00, 18:00 e 22:00. Horários fora da faixa ficam presos nas pontas.
- O trilho passado é `#C8DCDD`. O marcador "Agora HH:MM" fica escuro.
- Os pontos são de 16 px no desktop e 14 px no celular:

| Estado da dose | Ponto |
|---|---|
| Tomada | preenchido teal |
| Pulada | preenchido cinza |
| Atrasada | borda vermelha |
| Futura | borda cinza |

- Quando o estado muda, o ponto troca de cor com transição de 200 ms.
- No celular, as marcas de hora encurtam para "06h" e "22h".

## Lista "Doses de hoje"

Cada linha mostra hora, avatar (redondo para pessoas, raio 6 para pets), nome do remédio com a concentração em cinza e quem toma.

O final da linha muda conforme o estado:
- **Pendente:** botão **Tomei**.
- **Tomada:** etiqueta "Tomada às 06:34" em teal-claro e o botão de desfazer, um ícone de seta.
- **Pulada:** etiqueta "Pulada" em cinza e o mesmo botão de desfazer.
- **Atrasada:** a hora aparece em vermelho.

O botão de desfazer chama `api.desfazerDose(id, h)`, que é novo e só emite o evento `desfazerDose`, que já existe.

Os rótulos PESSOAS e PETS só aparecem quando há pets com dose hoje. O alvo de toque no celular é de 44 px.

## Remédio acabando

- Mostra o primeiro remédio ativo com `estoqueBaixo`:
  - o rótulo "ACABANDO" em `--warn-text` e uma etiqueta com os dias que restam;
  - nome e concentração;
  - o texto "N comprimidos · acaba em DD/MM";
  - 10 blocos preenchidos por `pctEstoque`, em `--warn-bar` quando o estoque está baixo e teal quando não.
- **Comprei mais** chama `api.comprei(id, 30)`, como na tela de Remédios. Os blocos se enchem com um atraso escalonado de 25 ms por bloco.
- Sem remédio baixo, o cartão não aparece. O número "Estoque baixo" mostra 0, com o texto "Tudo em dia".

## Ícones

Ficam em `src/ui/Icones.tsx`: SVG de traço 1,8, 18 px, `currentColor`. São eles: início, remédio, agenda, exame, plano, cadeado, emergência, sino, pular, check, desfazer, estoque e marca.

Isso muda a regra antiga "ícones: quase nenhum" (CLAUDE.md será atualizado): agora há ícones na navegação e nas ações do cartão da dose, mas não nas listas.

## Testes

- `src/data/inicio.test.ts`, com casos para:
  - a escolha da dose (atrasada, agora, futura, adiada que volta, só adiadas);
  - o texto do rótulo;
  - a posição na linha (dentro e fora da faixa);
  - a separação de nome e concentração.
- `npm run build` sem erros.
- Conferência no navegador, no desktop e no celular, com os dados de exemplo:
  - Tomei, 15 min, Pular e Desfazer;
  - Comprei mais;
  - o estado "Tudo em dia";
  - o Início de quem não tem doses (Pedro).
