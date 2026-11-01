# Telas desktop — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Primeiro uso, formulários e as funções que só existiam no celular ganham versões desktop próprias.

**Architecture:** A lógica dos formulários sai dos componentes mobile para hooks compartilhados (`src/data/formularios.ts`); mobile e desktop só mudam a apresentação. Um kit de formulário desktop (`src/desktop/Formulario.tsx` + CSS) monta os diálogos. Componentes visuais reaproveitáveis (cartas da M01, grade de adesão, documento do resumo, carteirinha em tela cheia) são extraídos dos arquivos mobile para serem usados pelos dois layouts.

**Spec:** `docs/superpowers/specs/2026-10-29-telas-desktop-design.md` — **é a fonte dos valores visuais e textos**. Leia a seção indicada em cada tarefa.

## Global Constraints

- Textos da interface em pt-BR exatamente como na spec e nos componentes mobile existentes. Datas `DD/MM/AAAA`.
- Cores, raios, sombras e tipografia só por variáveis de `src/styles/tokens.css` (exceto valores que a spec dá em px). Transições `var(--t) var(--ease)`.
- Sem ícones novos (o cadeado é `<Lock />`). Sem dependências novas. Sem rede.
- O estado só muda por `api.*` (log de eventos). Nenhuma regra de salvar duplicada entre mobile e desktop.
- **O mobile não muda visualmente.** Toda extração precisa manter M02, M06, M16, M17, M18, M19, M01 idênticas.
- `npm run build` sem erros e `npm test` passando ao fim de cada tarefa. Rode `npm run dev` e confira no navegador as telas tocadas (modo exemplo: `http://localhost:1420`, desktop ≥ 760 px; o DevBar no canto inferior esquerdo força layout e abre telas).
- Arquivos mantêm o fim de linha que já têm. Commits terminam com linha em branco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não adicionar `.superpowers/`.

---

### Task 1: Hooks de formulário compartilhados

**Files:**
- Create: `src/data/formularios.ts` (hooks + funções puras), `src/data/formularios.test.ts`
- Modify: `src/mobile/Remedios.tsx` (NovoRemedio), `src/mobile/Agenda.tsx` (NovaConsulta), `src/mobile/Exames.tsx` (AdicionarExame), `src/mobile/Onboarding.tsx` (FormPessoa)

**Produces (usados nas tarefas 2 e 3):**
- `lerDataHora(texto: string, hoje: string): { data: string; hora: string } | null` — aceita "18/11 · 14:00", "18/11/2026 14:00", "18/11 14h00"; sem ano usa o ano de `hoje`, ou o seguinte se a data já passou (regra atual de `NovaConsulta`).
- `lerNascimento(texto: string, hoje: string): { iso?: string; erro?: string }` — vazio → `{}`; inválido ou futuro → `{ erro: 'Data inválida. Use DD/MM/AAAA.' }` (regra atual de `FormPessoa`).
- `mascaraData(v: string): string` (movida de Onboarding).
- `FREQUENCIAS`, `DOSES`, `DURACOES`, `AVISAR`, `PARENTESCO`, `SANGUE`, `CATEGORIAS_EXAME`, `LEMBRAR` (as listas que hoje estão espalhadas nos componentes).
- `useFormRemedio(onSalvo)`, `useFormConsulta(onSalvo)`, `useFormExame(onSalvo)`, `useFormPessoa({ souEu, onSalvo })`: cada um devolve um objeto com os valores, os setters, `valido: boolean` e `salvar(): void` (que faz exatamente o que o `salvar` do componente faz hoje, inclusive o toast). Valores iniciais iguais aos de hoje (`ex(...)` para os dados de exemplo). `useFormConsulta` guarda `quando` como texto e também expõe `data`/`hora` separados para o desktop (`setData`, `setHora` atualizam `quando` como `"DD/MM/AAAA · HH:MM"`).

- [ ] Testes primeiro (`formularios.test.ts`): `lerDataHora` (com e sem ano, data passada vira ano seguinte, formatos aceitos, texto inválido → null), `lerNascimento` (vazio, válida, 31/02, futura, ano com 2 dígitos), `mascaraData`. Rode `npm test` e veja falhar.
- [ ] Implemente `formularios.ts`. Rode `npm test` até passar.
- [ ] Troque a lógica dos 4 componentes mobile pelos hooks, sem mudar o JSX visível.
- [ ] `npm run build && npm test`. No navegador (390×844 via DevBar "Celular"), compare M02, M06, M17, M18 antes/depois: idênticas, e salvar continua funcionando (o item aparece na lista e o toast aparece).
- [ ] Commit: "Formulários: lógica em hooks compartilhados".

---

### Task 2: Kit desktop e formulários em diálogo largo

**Spec:** seção "2. Formulários — diálogo largo".

**Files:**
- Create: `src/desktop/Formulario.tsx` — `DDialogo({ titulo, largura?, onClose, rodape, children })` (Esc e clique fora fecham; foco no primeiro campo), `DGrade`, `DCampo({ label, span2?, children })`, `DSelect<T>({ opcoes, valor, onChange })`, `DChips` (ChipGroup com chips xs), `DConfirmar({ titulo, texto, confirmar, perigo?, onConfirm, onClose })`.
- Create: `src/desktop/Formularios.tsx` — `DNovoRemedio`, `DNovaConsulta`, `DNovoExame`, `DNovaPessoa`, `DFichaEmergencia`, usando os hooks da Task 1.
- Modify: `src/styles/shell.css` (classes `.dlg`, `.dlg__head`, `.dlg__body`, `.dlg__foot`, `.dgrid`, `.dfield`, `.input--desk`, `.dselect`); `src/desktop/Shell.tsx` (`Dialogo` usa os componentes novos e aceita `?abrir=pessoa`; remove o "celular dentro do diálogo"; sidebar ganha "+ Adicionar pessoa" abaixo das pessoas, estilo link teal 13 px).

- [ ] Implemente o kit e os 5 formulários conforme a spec (ordem dos campos, textos, botões).
- [ ] `npm run build && npm test`.
- [ ] No navegador 1440×900 (modo exemplo, layout desktop): abra `/#/?abrir=remedio`, `consulta`, `exame`, `pessoa`, `emergencia:roberto`. Confira a spec item a item; salve um de cada e veja o item aparecer (Remédios, Agenda, Exames, sidebar). Esc fecha.
- [ ] Commit: "Desktop: formulários em diálogo largo".

---

### Task 3: Primeiro uso em tela dividida

**Spec:** seção "1. Primeiro uso — tela dividida".

**Files:**
- Create: `src/desktop/PrimeiroUso.tsx` — `DPrimeiroUso` (layout dividido + rotas: boas-vindas, `cadastro?passo=1|2|3`).
- Modify: `src/mobile/Onboarding.tsx` (extrair as cartas da M01 em `CartasBoasVindas({ escuro? })` exportado; a M01 continua igual), `src/App.tsx` (sem `souEu` e layout desktop → `DPrimeiroUso`; em `RotasDesktop`, `/cadastro` → `DPrimeiroUso`; remover a prop `cartao`), `src/mobile/Shell.tsx` e `src/styles/shell.css` (remover `is-cartao`).
- Passo 2 usa `useFormPessoa({ souEu: false })`; passo 1 `souEu: true`. Fluxo igual ao atual: passo 1 salva → passo 2; passo 2 salva ou pula → passo 3; passo 3 "Criar senha" (SenhaApp desktop) ou "Agora não" → `/`. "Voltar" no passo 1 → boas-vindas; no passo 2/3 → passo anterior apenas como navegação (não desfaz o que foi salvo).

- [ ] Implemente.
- [ ] `npm run build && npm test`.
- [ ] No navegador 1440×900 com `?persistir=1` (comece limpando o `localStorage` da página): percorra boas-vindas → passo 1 (teste data inválida) → passo 2 (pular e também salvar) → passo 3 (criar senha) → cai na D01. Teste "Restaurar um backup". Em 390×844 o primeiro uso continua o mobile.
- [ ] Commit: "Desktop: primeiro uso em tela dividida".

---

### Task 4: Detalhe do remédio no desktop

**Spec:** seção "3", item "Detalhe do remédio".

**Files:**
- Create: `src/desktop/Remedio.tsx` — `DRemedio`.
- Modify: `src/mobile/Remedios.tsx` (extrair a grade de adesão 7×2 e o cartão de estoque da M16 em componentes exportados, sem mudar a M16), `src/App.tsx` (rota `remedios/:id` no desktop), `src/desktop/Paginas.tsx` (linha da tabela D05 → `/remedios/:id`).
- "Encerrar tratamento" usa `DConfirmar` (Task 2) e `api.encerrar`.

- [ ] Implemente. `npm run build && npm test`.
- [ ] Navegador 1440×900: D05 → clique em Levotiroxina e num remédio com estoque baixo; "Comprei mais" atualiza; encerrar pede confirmação e move o remédio para "encerrados". M16 no celular igual.
- [ ] Commit: "Desktop: detalhe do remédio".

---

### Task 5: Resumo para consulta e carteirinha no balcão

**Spec:** seção "3", itens "Resumo para consulta" e "Mostrar no balcão".

**Files:**
- Create: `src/desktop/Resumo.tsx` — `DResumo`.
- Modify: `src/mobile/Agenda.tsx` (extrair `SECOES` e o corpo do documento da M19 em `DocumentoResumo({ consulta, incluir })` exportado; M19 igual), `src/App.tsx` (rota `consulta/:id/resumo` no desktop), `src/desktop/Pessoa.tsx` (botão "Resumo para consulta" na faixa PRÓXIMA), `src/desktop/Paginas.tsx` (clique numa consulta da D04 → resumo; botão "Mostrar no balcão" na D06), `src/mobile/Familia.tsx` (extrair a carteirinha em tela cheia em `CarteirinhaBalcao({ plano, onClose })` se ainda não for componente; M09 igual). Esc fecha a camada.
- `@media print`: no desktop, imprimir só o documento (esconder sidebar e barra).

- [ ] Implemente. `npm run build && npm test`.
- [ ] Navegador 1440×900: D02 Roberto → "Resumo para consulta"; "Escolher itens" tira e põe seções; "Exportar PDF" abre a impressão só com o documento. D04 → clique numa consulta abre o resumo. D06 → "Mostrar no balcão" abre e fecha (Esc e clique). M19 e M09 iguais no celular.
- [ ] Commit: "Desktop: resumo para consulta e carteirinha no balcão".

---

### Task 6: Navegador de telas e documentação

**Files:** `src/dev/DevBar.tsx`, `README.md`, `docs/HISTORICO.md`, `docs/ARQUITETURA.md` (seção "Observações sobre o design"), `CLAUDE.md` (Arquitetura: "No desktop, os formulários abrem em diálogo próprio (`src/desktop/Formularios.tsx`) com a lógica em `src/data/formularios.ts`").

- [ ] DevBar: atalhos para as telas novas no grupo desktop, com rótulos "D·Primeiro uso", "D·Novo remédio", "D·Nova consulta", "D·Novo exame", "D·Nova pessoa", "D·Emergência", "D·Remédio", "D·Resumo", "D·Balcão".
- [ ] Documente as telas desktop criadas (fora dos mockups) em ARQUITETURA › Observações sobre o design, e registre no HISTORICO.
- [ ] `npm run build && npm test`. Commit: "Telas desktop: atalhos e documentação".
