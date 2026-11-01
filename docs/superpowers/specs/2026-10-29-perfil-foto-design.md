# Perfil com foto e edição

Aprovado em 29/10/2026. Vale para pessoas e, depois, para os pets (spec `2026-10-29-pets-design.md`). Antecipa a parte de perfil do marco 5 ("Editar").

## O que muda

1. **Foto** no lugar das iniciais, em todo lugar onde hoje aparece `<Avatar>` (sidebar, listas, perfil, Início, ficha de emergência).
2. **Cabeçalho do perfil** mais completo (D02 no desktop, M10 no celular).
3. **"Editar perfil"** funciona (hoje o botão é só visual).

## Dados

- `Pessoa` ganha `foto?: string` (data URL `image/jpeg`).
- Evento novo `editarPessoa { pessoaId, patch }`, com `patch: Partial<Pessoa>` (sem `id` e sem `souEu`). O reducer aplica o patch campo a campo. É append-only, como os demais eventos.
- A foto entra no mesmo evento (`patch.foto`). Para remover, `patch.foto = null` vira `undefined` no reducer.
- **Tamanho:** a imagem é cortada no centro em quadrado e reduzida para 384×384 no navegador (`canvas`, JPEG qualidade 0,82, uns 30 KB). Nada é gravado fora do log cifrado, e o backup `.fsaude` leva a foto junto.
- **Quem pode editar:** a própria pessoa, ou quem a cadastrou neste aparelho (`editaveis(state)`), mesma regra dos formulários.

## Foto

- **Escolher:** `<input type="file" accept="image/*">`. No celular, `capture` fica para o marco Android.
- **Onde fica a ação:** o avatar do cabeçalho do perfil mostra, ao passar o mouse (desktop) ou sempre (celular), uma faixa "Trocar foto" / "Adicionar foto" na parte de baixo do círculo. No diálogo de edição há "Trocar foto" e "Remover foto".
- **Componente `Avatar`:** com `foto`, mostra `<img>` redonda (`object-fit: cover`); sem foto, as iniciais como hoje. Mesmos tamanhos.
- **Erro** (arquivo que não é imagem ou não abre): toast "Não foi possível usar essa imagem."

## Cabeçalho do perfil

- **Desktop (D02):**
  - avatar de 88 px, nome (30 px/600) e linha "Sexo · N anos · nasc. DD/MM/AAAA · relação";
  - abaixo, faixa de indicadores (cartões `.stat`): Tipo sanguíneo · Peso · Altura · Alergias (laranja se houver, com o nome da primeira e "+N") · Contato de emergência (nome e telefone);
  - botões à direita como hoje: "Ficha de emergência" e "Editar perfil".
- **Celular (M10):** avatar de 72 px. Os 3 indicadores atuais (Sangue, Peso, Altura) seguem e ganham uma linha com idade e nascimento no subtítulo. Visual da M10 preservado além disso.

## Editar perfil

- **Desktop:** diálogo largo (`DDialogo`, kit das telas desktop) "Editar perfil".
  - Foto (avatar 72 + "Trocar foto"/"Remover foto"), Nome (2 col.), Nascimento, Sexo (chips), Tipo sanguíneo (chips `DSangue`), Peso (kg), Altura (m, aceita "1,74"), Pressão (texto livre + data automática);
  - **Alergias:** lista editável, com substância e reação, "+ Adicionar alergia" e remover (×);
  - **Condições:** lista editável, com nome, tipo (condição/cirurgia/vacina) e desde, "+ Adicionar" e remover;
  - **Contato de emergência:** nome, relação e telefone;
  - rodapé "Cancelar" / "Salvar".
- **Celular:** tela "Editar perfil" (TopNav "Cancelar · Editar perfil · Salvar"), os mesmos campos em uma coluna, no estilo dos formulários mobile (M06/M18).
- **Lógica:** um hook `useFormPerfil(pessoa, onSalvo)` em `src/data/formularios.ts`, compartilhado pelas duas telas. `salvar()` emite só os campos alterados. Validação: nome obrigatório; nascimento com `lerNascimento`; peso e altura numéricos no formato BR.

## Verificação

- Testes (Vitest): reducer `editarPessoa` (patch, remover foto, não altera `id`/`souEu`), diff dos campos alterados, conversão de peso/altura BR.
- Função de redução da imagem testada com um canvas falso, ou separada em função pura para o cálculo do recorte (`recorteQuadrado(w, h)`).
- Navegador: trocar foto, editar e salvar no desktop e no celular; recarregar com `?persistir=1` e conferir que voltou; backup e restaurar mantêm a foto.
