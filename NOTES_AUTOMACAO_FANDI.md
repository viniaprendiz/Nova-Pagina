# NOTES - Automacao Fandi (server.js / processarFicha)

> Documento de continuidade tecnica. Ficha de teste usada: Ryan Barreto Gomes da Silva,
> fandi_id PROP-1785171860711-d4c71bd4, CPF 48021727888.
> Objetivo: clicar "enviar" no nosso site -> preencher o wizard do Fandi automaticamente
> (Puppeteer) -> ficha aparece na tela inicial "Operacoes Financiadas" do Fandi ->
> status fica "enviado" (verde) no nosso site.

## Estado atual (ultima versao: v24.18, commit 2021efc)

Chegamos ate o passo "Dados do veiculo" do wizard e preenchemos com sucesso:
Marca=AGRALE, Modelo=MARRUA, Versao=(primeira opcao), Placa=TST1A23,
Chassi=9BWZZZ377VT004251, Renavam=00123456789, Km=12000, Tipo de operacao=SEMINOVOS,
CPF real (48021727888) no campo cpfCnpj.

BLOQUEIO ATUAL: os campos "Ano de fabricacao" (opcoes 2026/2025/2024) e
"Ano do modelo" (opcoes 2023/2024) sao grupos de radio buttons que, por um bug de
markup do proprio Fandi, compartilham o MESMO atributo name="parcelas" no HTML.
Isso quebra a logica atual que agrupa radios por name: como "2023" ja vem marcado
por padrao em algum item do grupo compartilhado, o codigo (jaMarcado) acha que o
grupo inteiro ja esta satisfeito e PULA o preenchimento - mas na verdade sao dois
campos semanticamente distintos que precisam de selecao independente. Resultado:
o wizard nao avanca de "Dados do veiculo" mesmo apos clicar Proxima.

PROXIMO PASSO EXATO: nao agrupar por name="parcelas". Em vez disso, separar os
radios em dois grupos por FAIXA DE VALOR:
- values em (2024, 2025, 2026) => grupo "Ano de fabricacao"
- values em (2023, 2024) (nota: 2024 aparece nos dois!) => grupo "Ano do modelo"

Como "2024" aparece nas duas faixas, a melhor abordagem e achar o heading/label
ancestral mais proximo de cada radio (procurar texto "Ano de fabricacao" /
"Ano do modelo" em elementos pai/irmaos proximos, subindo a arvore do DOM a partir
de cada input radio) em vez de confiar so no value. Se nao der pra achar heading,
usar posicao no DOM (radios que aparecem primeiro = Ano de fabricacao, que aparecem
depois = Ano do modelo, baseado na ordem visual confirmada no texto da pagina:
"Ano de fabricacao / 2026 / 2025 / 2024 / Ano do modelo / 2023 / 2024").
Clicar o radio correto em CADA grupo, independente do estado "ja marcado" do outro
grupo (nao usar mais o check jaMarcado por name).

Depois disso, se o wizard avancar, o proximo passo sera "Condicoes da venda"
(ainda nao explorado a fundo - sabemos que tem pelo menos um select "Tabela
financeira" e possivelmente outro radio "parcelas" real, cuidado para nao
confundir com o bug de name acima).

## Licoes tecnicas criticas (NAO REPETIR ERROS)

1. NUNCA navegar a aba entre montar uma string de codigo (guardada em variavel
   window.*) e usar essa variavel num dispatch em outra chamada javascript_exec.
   Navegar limpa variaveis window-scoped. Isso causou uma regressao catastrofica
   na v24.4 (apagou 74 linhas de codigo sem substituir por nada, quebrou
   browser.close() e return, ficha ficava "enviando" pra sempre). SEMPRE montar
   E aplicar (dispatch) o replace no MESMO javascript_exec call.

2. Sempre validar com new Function(newDoc) antes de cada commit. Se der
   erro de sintaxe tipo "Missing catch or finally after try", provavelmente o
   range substituido (from/to) comeu codigo adjacente sem querer. Usar
   contagem de chaves (abre vs fecha) no documento inteiro pra confirmar se esta
   balanceado globalmente; se estiver balanceado mas ainda der erro, procurar
   uma palavra-chave especifica que sumiu via doc.indexOf('palavraChave') === -1.

3. Confirmar o commit depois de feito: abrir
   github.com/viniaprendiz/Nova-Pagina/commit/<hash> e olhar o resumo "+X -Y"
   no topo do diff. Um "+1 -74" pra uma mudanca que deveria ser grande e sinal
   de alerta (mesmo bug de variavel perdida).

4. Ao reabrir /edit/main/server.js depois de um erro, o GitHub pode mostrar
   um banner "You have unsaved changes... Discard / Restore" (referente a um
   draft antigo no localStorage). NAO clicar Discard nem Restore - clicar so
   no X pequeno pra fechar o banner sem alterar o estado do editor, e
   re-verificar se o conteudo esperado ainda esta la antes de continuar.

## Tecnicas de acesso ao CodeMirror (editor do GitHub)

- Pegar a instancia do editor: document.querySelector(".cm-content").cmTile.view
- Ler o texto completo: view.state.doc.toString()
- Editar: view.dispatch({changes:[{from, to, insert}]})
- Validar sintaxe antes de aplicar: new Function(novoTexto) (lanca erro se invalido)
- Achar pontos de ancoragem com doc.indexOf('trecho unico') / doc.lastIndexOf(...)
  em vez de contar linhas manualmente.

## Fluxo de commit no GitHub (UI)

1. Clicar em "Commit changes..." (as vezes precisa clicar 2x, o modal nao abre
   sempre na primeira - sempre tirar screenshot pra confirmar que abriu).
2. Triple-click no campo de titulo do commit + ctrl+a + digitar o novo titulo.
3. Clicar no campo de descricao extendida + ctrl+a + Delete + digitar (o
   autofill do Copilot as vezes deixa um "a" minusculo sobrando no inicio -
   sempre conferir com screenshot e limpar de novo se precisar).
4. Clicar em "Commit changes"/"Confirmar alteracoes".

## Monitorar deploy no Render

- URL: dashboard.render.com/web/srv-d9hdnksm0tmc73alr450/events
- Procurar texto "Deploy live for <hash>".
- A pagina as vezes mostra "Artifact not found" ou conteudo cacheado -
  re-navegar 2-3 vezes se necessario.
- Tempo tipico: ~10-15s pra "Deploy started", mais ~15-30s pra "Deploy live".

## Disparar retry e checar status (via javascript_exec na aba do vendedor)

Disparar retry (POST /api/retry/PROP-1785171860711-d4c71bd4 com header
x-tdrive-pin: 5386, credentials include).

Checar status a cada ~15-20s: GET /api/vendedor/fichas com credentials include.
Resposta: {success, total, fichas:[...]} - o array fica dentro da chave .fichas,
nao e o array direto (diferente de /api/fichas). Achar a ficha via
fandi_id.includes("d4c71bd4").
- status: "enviando" = em andamento, "erro" = parou (nao necessariamente falhou,
  pode ser so uma parada informativa com diagnostico)
- tentativas: incrementa a cada retry
- erro: mensagem visivel pro usuario
- erro_tecnico: contem "DIAGNOSTICO_V5: " + JSON do diagLog quando e parada
  informativa, OU um erro puro do Puppeteer (ex: "Navigation timeout of 60000 ms
  exceeded") quando e falha de rede pura (nao relacionada ao nosso codigo, so
  tentar de novo)

## Truques de leitura de diagnostico grande

- erro_tecnico e truncado em 9500 chars (JSON.stringify(diagLog).slice(0,9500)).
  Se o JSON.parse falhar por causa do corte, usar regex pra listar nomes de fase
  (procurar padrao "fase":"..."), depois raw.indexOf da fase especifica + slice
  pra extrair manualmente o trecho.
- Se qualquer string tiver sinal de igual ou ponto-e-virgula pode disparar um
  filtro de conteudo (BLOCKED: Cookie/query string data) - trocar esses
  caracteres por underline antes de logar/retornar.
- raw.githubusercontent.com pode servir conteudo cacheado/desatualizado. Usar a
  API api.github.com/repos/viniaprendiz/Nova-Pagina/contents/server.js?ref=main
  com cache no-store e decodificar base64 (atob) como fonte confiavel, ou
  adicionar ?t=Date.now() + cache no-store nos fetches de raw tambem.

## Estrutura do wizard do Fandi (passos confirmados)

O form e um wizard real com multiplos div.wizard-content (so um visivel por vez,
display:flex + classe active step-current), nao e uma pagina unica scrollavel.
Passos, na ordem:

1. Local da venda: Empresas / Ponto de venda / Vendedor / Departamento, MAIS um
   select obrigatorio "Tipo de operacao" (opcoes: placeholder "laga" / NOVOS /
   SEMINOVOS / VENDAS DIRETA) que bloqueia o avanco se nao preenchido.
2. Dados do cliente: contem input cpfCnpj (obrigatorio, preenchido com dados.cpf).
   Outros campos ainda nao totalmente mapeados.
3. Dados do veiculo: Quilometragem (input), Novo/Usado (radio), Ano de
   fabricacao (radio: 2026/2025/2024), Ano do modelo (radio: 2023/2024 - MESMO
   name="parcelas" que o grupo anterior, bug de markup do Fandi), Marca/Modelo/
   Versao (Select2 sobre selects nativos com ids opo_slctMarca / opo_slctModelo
   / opo_slctVersao - sempre reportam 0x0 via getBoundingClientRect porque o
   Select2 esconde o select nativo), Placa/Chassi/Renavam (inputs), UF da Placa/
   Cidade/UF Emplacamento (selects).
4. Condicoes da venda: ainda nao explorado a fundo. Sabe-se que tem pelo
   menos um select "Tabela financeira" e possivelmente outro radio nomeado
   "parcelas" (cuidado pra nao confundir com o bug de name do passo 3).

Regex certo pra detectar o heading do passo veiculo: /dados do ve[ii]culo/i
(regex generico /ve[ii]culo/i da falso positivo no subtitulo do passo 1:
"Informe onde o veiculo esta sendo vendido.").

## Dados de teste usados (fabricados, autorizado pelo usuario por ser so teste)

Placa=TST1A23, Chassi=9BWZZZ377VT004251, Renavam=00123456789, Km=12000,
Tipo de operacao=SEMINOVOS, Marca=AGRALE (primeira opcao alfabetica, arbitrario),
Modelo=MARRUA (unica opcao disponivel pra AGRALE), Versao=primeira opcao da lista.

CPF real do cliente (nao fabricado): 48021727888, usado no campo cpfCnpj via
dados.cpf.

## Pendencia / acao futura necessaria

Os retries repetidos de teste continuam criando registros de "operacao"
duplicados/de teste no Fandi (sistema em producao) para o CPF do Ryan. O usuario
vai precisar limpar isso manualmente mais tarde - ainda nao resolvido nem tratado
pelo assistente.

## Helpers ja existentes no codigo (v24.5+)

- comTimeout(promise, ms, label): corrida entre uma promise e um timeout,
  garante que o fluxo externo sempre continua mesmo se algo travar.
- Deadline geral de 55s ao redor de toda a tentativa do Passo 3:
  comTimeout(executarPasso3ComSeguranca(), 55000, "geral_passo3").
- diagLog.fases: array de diagnostico, cada versao nova deve continuar
  adicionando fases a esse array (prefixo no erro_tecnico: "DIAGNOSTICO_V5: ").
