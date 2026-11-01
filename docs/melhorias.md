# Lista de melhorias (aberta em 30/10/2026)

Vou anotando aqui até você dizer que acabou. Depois atacamos em blocos.

## Pedidos seus

1. **Condições com sugestões.** Ao digitar, sugerir uma lista de condições comuns em pt-BR: hipertensão, diabetes tipo 2, hipotireoidismo, asma, colesterol alto, ansiedade, depressão, enxaqueca etc. Continua sendo possível escrever qualquer outra. A lista vale também para cirurgias e alergias (substâncias comuns), e o tipo Condição / Cirurgia / Vacina vira um seletor claro.
2. **Máscara de telefone.** Enquanto a pessoa digita, o número fica `(21) 99154-9211` (celular) ou `(21) 3456-7890` (fixo), e só os dígitos são guardados. Vale para todos os campos de telefone: contato de emergência, veterinário, clínica 24 h e plano.
3. **Agenda com Google ou com o plano / Rede D'Or.** A regra do app é não falar com servidor nenhum, então a sincronização ao vivo com o Google exigiria liberar acesso à rede e login no Google. Preciso da sua decisão. As opções que respeitam a regra:
   - **Importar `.ics`:** o Google Agenda exporta, e e-mails de confirmação costumam trazer o convite como anexo.
   - **Exportar consultas para `.ics`:** para elas aparecerem no Google ou no Outlook.
   - **Rede D'Or e planos:** não conheço integração aberta. O caminho seria importar o convite ou o e-mail de confirmação.
4. **"Adicionar plano" não faz nada.** São dois botões em Planos de saúde (desktop) sem ação, e não existe evento `addPlano`. Falta o formulário de plano: operadora, produto, carteirinha, validade, ANS, telefone, foto da carteirinha frente e verso, e o titular ou dependente.
5. **Poucas categorias de exame.** Expandir para:
   - Sangue
   - Urina
   - Fezes
   - Imagem (raio-x, ultrassom, tomografia, ressonância)
   - Coração (ECG, eco, holter, MAPA)
   - Hormônios
   - Ginecológico / Urológico
   - Oftalmológico
   - Dermatológico
   - Vacinação / sorologia
   - Laudo / atestado
   - Outro

## Achados da revisão

### Funções que parecem prontas mas não funcionam

6. **Exames sem arquivo.** As "páginas" do exame são só um contador. Não dá para anexar foto nem PDF, e "Abrir PDF/foto" e "Exportar" não fazem nada. Este é o maior buraco do app. Proposta:
   - escolher arquivos ou tirar foto (no celular);
   - guardar tudo cifrado, no mesmo esquema da foto de perfil, ou em arquivo cifrado separado se for grande;
   - visualizar e exportar.
7. **Receita.** "Fotografar receita" e "Ver receita" (Remédios, no celular) não fazem nada. Usar o mesmo anexo do exame.
8. **Carteirinha.** "Fotografar carteirinha" (Família, no celular) não faz nada.

### Editar e apagar

9. **Editar** remédio (dose, horários, estoque), consulta (remarcar, cancelar), exame e plano. Hoje só o perfil é editável (já estava nos próximos marcos).
10. **Apagar** registro: hoje não existe em nada. Seria um evento novo que anula o anterior, com confirmação e "Desfazer". Inclui remover pessoa ou pet.
11. **Consulta que já passou:** registrar o que aconteceu (diagnóstico, pedidos, retorno em X meses) e criar o retorno direto dali.

### O que falta para um arquivo de saúde completo

12. **Medições:** pressão, glicemia, peso e altura (IMC), temperatura e saturação, com gráfico simples ao longo do tempo. Pets já têm pesagem; pessoas não têm nada.
13. **Vacinas de pessoas** como registro próprio (dose, lote, reforço com lembrete). Hoje vacina é só um tipo de "condição".
14. **Busca global** (Ctrl+K no desktop) por remédio, exame, consulta ou pessoa.
15. **Linha do tempo da pessoa:** tudo em ordem cronológica (consultas, exames, início e fim de remédios, vacinas).
16. **Médicos e locais:** cadastro reaproveitável (nome, especialidade, telefone, endereço), escolhido ao marcar consulta.
17. **Remédio "se necessário":** registrar quando tomou e por quê (dor, febre). Hoje ele só aparece na lista.
18. **Adesão:** histórico de doses do mês por pessoa (a base já existe em `historicoAdesao`).

### Históricos e gráficos de progresso

25. **Gráfico de linha simples** (SVG próprio, sem biblioteca, offline), em cada lugar onde há medida ao longo do tempo:
    - **Peso do pet** (já registrado): gráfico na aba Peso e mini-gráfico no resumo, com faixa ideal opcional.
    - **Peso e IMC de pessoas** (novo, com as medições do item 12).
    - **Pressão:** duas linhas (sistólica e diastólica) e faixa de referência 12/8.
    - **Glicemia:** jejum e pós-refeição, com faixa de referência.
    - **Resultados de exames:** guardar os valores de marcadores (colesterol, LDL, TSH, glicose, hemoglobina…) e mostrar a evolução de cada um entre exames. É o mais útil para levar ao médico.
    - **Adesão aos remédios:** % de doses tomadas por semana, por remédio e por pessoa (os dados já existem).
    - **Estoque:** quando acaba, no gráfico de cada remédio (opcional).
    - **Altura das crianças**, se houver dependentes (curva simples).

## Ordem de ataque

Andamento no branch `melhorias`:
- A: feito.
- B: feito.
- C: feito.
- D: feito.
- E: feito. O médico ganhou sugestões a partir das consultas, mas não um cadastro próprio.
- F: feito em parte.
  - Feito: hora certa nos dados de exemplo, faixas de números em Remédios e Agenda, seletor de data nativo e estado vazio de Remédios.
  - Pendente: as outras telas ainda têm o layout antigo, só com raios menores.

- **A. Correções rápidas:** telefone, sugestões de condições, categorias de exame, Adicionar plano.
- **B. Gráficos e históricos:** componente de gráfico, peso do pet, medições de pessoas (peso, pressão, glicemia), adesão.
- **C. Anexos de verdade:** exames, receita, carteirinha.
- **D. Editar e apagar registros.**
- **E. Vacinas de pessoas, valores de exame com gráfico, busca, linha do tempo, médicos, consulta que já passou, `.ics`.**
- **F. Polimento e visual V1 nas outras telas.**

### Polimento

19. **Datas:** seletor de data nos formulários, com validação e sem digitar barra.
20. **Estados vazios:** cada tela com uma explicação e um botão para começar. O desktop mostrava um Início vazio sem orientação.
21. **Outras telas no visual novo (V1):** Agenda, Remédios, Exames, Planos, Pessoa e Privacidade ainda têm o layout antigo.
22. **Teclado no desktop:** Enter salva, Esc fecha (conferir em todos os diálogos), atalhos N para nova consulta etc.
23. **Hora de "Tomada às" nos dados de exemplo:** usa o relógio real (22:09) e não o 14:20 do exemplo.
24. **Doses "se necessário" e pets na tela Remédios do desktop:** conferir os filtros.
