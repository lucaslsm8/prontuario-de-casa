# Perfil com foto e edição — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Foto no perfil (cifrada no log), cabeçalho completo e "Editar perfil" funcionando no desktop e no celular.

**Spec:** `docs/superpowers/specs/2026-10-29-perfil-foto-design.md` — fonte dos textos e valores visuais.

**Architecture:** Evento novo `editarPessoa { pessoaId, patch }` aplicado pelo reducer. Funções puras (recorte, diff, números BR) em `src/data/perfil.ts` com testes. Hook `useFormPerfil` em `src/data/formularios.ts`, usado pelo diálogo desktop e pela tela mobile.

## Global Constraints

- Textos em pt-BR conforme a spec. Tokens de `src/styles/tokens.css`. Sem dependências novas, sem rede, sem ícones novos.
- Estado só muda por `api.*`; o evento é append-only. Foto só dentro do evento (data URL JPEG 384×384, qualidade 0,82), nunca em arquivo solto.
- Mobile: só as mudanças descritas na spec (avatar 72 e linha de idade/nascimento na M10, tela de edição nova); nada mais muda.
- `npm run build` limpo e `npm test` passando em cada tarefa. Fim de linha preservado. Commits com linha em branco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não adicionar `.superpowers/`.

---

### Task 1: Dados, evento e avatar com foto

**Files:** `src/data/types.ts` (`Pessoa.foto?: string`), `src/data/store.tsx` (Mudanca `editarPessoa`, reducer, `api.editarPessoa(pessoaId, patch)`), `src/data/perfil.ts` + `src/data/perfil.test.ts` (novos), `src/ui/index.tsx` (`Avatar` com foto), `src/styles/components.css` (`.avatar img`).

**Produces:**
- `api.editarPessoa(pessoaId: string, patch: PatchPessoa)`, onde `PatchPessoa = Partial<Omit<Pessoa, 'id' | 'souEu'>> & { foto?: string | null }`. Reducer: aplica campo a campo; `foto: null` remove; ignora `id`/`souEu` se vierem.
- `perfil.ts`: `recorteQuadrado(w, h): { sx, sy, lado }`; `diffPessoa(antes: Pessoa, depois: Pessoa): PatchPessoa` (só campos alterados, comparação profunda para arrays/objetos; foto removida vira `null`); `lerNumeroBR(texto): number | undefined` ("1,74" → 1.74, "72" → 72, "72,5 kg" → 72.5, vazio/ inválido → undefined).
- `Avatar` com `pessoa.foto`: `<img src alt="">` redonda, `object-fit: cover`, mesmos tamanhos; sem foto, iniciais como hoje.

- [ ] Testes primeiro (reducer via função `reducer` exportada ou `projetar` se já exportada — confira; senão exporte o reducer para teste), `perfil.ts`. Veja falhar, implemente, passe.
- [ ] Commit "Perfil: evento editarPessoa e avatar com foto".

### Task 2: Escolher e reduzir a foto

**Files:** `src/data/perfil.ts` (`reduzirFoto(file: File): Promise<string>` usando `createImageBitmap`/`Image` + `canvas`, recorte de `recorteQuadrado`, 384×384, `image/jpeg` 0,82; rejeita se não for imagem), `src/ui/Foto.tsx` (novo: `TrocarFoto({ pessoa, tamanho, onFoto })` = avatar com faixa "Adicionar foto"/"Trocar foto" na base do círculo — no desktop aparece no hover/foco, no celular sempre; `<input type="file" accept="image/*" hidden>`; erro → toast "Não foi possível usar essa imagem.").

- [ ] Implemente; `reduzirFoto` sem teste de canvas (o recorte já é testado). Commit "Perfil: escolher e reduzir foto".

### Task 3: Desktop — cabeçalho D02 e diálogo "Editar perfil"

**Files:** `src/data/formularios.ts` (`useFormPerfil(pessoa, onSalvo)`: estado de todos os campos da spec, listas editáveis de alergias/condições, `foto`, `valido`, `salvar()` → `api.editarPessoa(id, diffPessoa(...))` + toast "Perfil atualizado"; validação com `lerNascimento` e `lerNumeroBR`), `src/desktop/Formularios.tsx` (`DEditarPerfil`), `src/desktop/Shell.tsx` (`?abrir=perfil:<id>`), `src/desktop/Pessoa.tsx` (cabeçalho: `TrocarFoto` 88 px, linha de subtítulo, faixa de 5 `.stat` conforme a spec; "Editar perfil" abre o diálogo; só para `editaveis(state)`).

- [ ] Testes do hook não são exigidos; teste `diffPessoa` cobre a regra. Commit "Desktop: cabeçalho do perfil e Editar perfil".

### Task 4: Celular — M10 e tela "Editar perfil"

**Files:** `src/mobile/Familia.tsx` (`PerfilMembro`: `TrocarFoto` 72 px, subtítulo com idade e nascimento; "Editar" do TopNav → `/pessoa/:id/editar`), `src/mobile/EditarPerfil.tsx` (novo, usa `useFormPerfil`, estilo dos formulários M06/M18), `src/App.tsx` (rota mobile).

- [ ] Commit "Celular: foto no perfil e Editar perfil".

### Task 5: Atalhos e documentação

**Files:** `src/dev/DevBar.tsx` ("D·Editar perfil" → `/?abrir=perfil:roberto`, "M·Editar perfil" → `/pessoa/roberto/editar` no layout mobile), `docs/HISTORICO.md`, `docs/ARQUITETURA.md` (marco 5 parcialmente feito: perfil), `CLAUDE.md` (Próximos marcos item 5).

- [ ] Commit "Perfil: atalhos e documentação".
