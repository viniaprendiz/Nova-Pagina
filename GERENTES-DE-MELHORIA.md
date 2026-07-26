# GERENTES DE MELHORIA CONTINUA - TDRIVE PRO

> Criado em 26/07/2026. Este arquivo e o "sistema operacional de pensamento" do projeto.
> Antes e depois de CADA entrega, os cinco gerentes abaixo sao rodados na ordem.
> Cada gerente tem: objetivo, perguntas obrigatorias, criterio de aprovacao e fila atual.

---

## Como o ciclo roda

1. **Entrada** - chega uma ideia (do Vinicios, do Humberto, da loja) ou um problema.
2. **Gerente de Objetivo** decide se entra na fila e com que prioridade.
3. **Gerente de Design** e **Gerente de Velocidade** definem COMO construir.
4. Constroi, commita, deploya, testa no ar.
5. **Gerente de Automacao** pergunta o que dessa entrega pode virar botao/rotina.
6. **Gerente do Cerebro** registra causa, solucao e armadilha no cerebro.
7. Volta ao passo 1.

Regra de ouro: **nenhuma entrega termina sem estar visivel e testavel no ar.**
Codigo que so existe no repositorio nao conta como entrega.

---

## 1. GERENTE DE OBJETIVO

**Objetivo:** garantir que o esforco vira carro vendido.

Perguntas obrigatorias:
- Isso ajuda a vender mais carro nesta semana, neste mes ou so "algum dia"?
- Quem usa isso? Vinicios, Humberto, a loja inteira ou o cliente final?
- Quantos minutos por dia isso economiza? Quantos leads a mais isso gera?
- Se eu so pudesse entregar UMA coisa hoje, seria essa?

Criterio de aprovacao: a tarefa precisa ter um beneficiario com nome e um ganho mensuravel
(minutos economizados, fichas a mais, leads a mais, erro a menos).

Fila atual (26/07/2026):
1. Fluxo Fandi ponta a ponta visivel (Ver no Fandi + Ver Email) - **alto**
2. Simulador na mao do Humberto - **feito, so falta ele usar**
3. Tela de fichas com o mesmo visual do simulador - **medio**
4. Ditado por voz no celular - **medio**
5. Area de assinaturas / funil - **baixo, depende de gateway**

---

## 2. GERENTE DE DESIGN

**Objetivo:** a tela tem que ser entendida em 3 segundos, por qualquer vendedor, no celular.

Perguntas obrigatorias:
- Qual e a UNICA coisa que a pessoa precisa ver primeiro nessa tela?
- Funciona num celular de 360px de largura?
- O contraste aguenta a luz do salao de vendas?
- Da para usar so com o polegar?
- A cor esta dizendo alguma coisa ou e so enfeite?

Padrao visual oficial (usar em tudo):
| Papel | Cor |
|---|---|
| Fundo | \#0b1220 -> \#0e1626 |
| Cartao | \#121c30 |
| Linha/borda | \#243352 |
| Texto | \#e8eefc |
| Texto secundario | \#93a4c4 |
| Acao / destaque | \#3b82f6 |
| Ruim | \#ef4444 |
| Atencao | \#f59e0b |
| Bom | \#22c55e |

Regras: cantos 14-16px, botao com no minimo 40px de altura, fonte do sistema,
nada de icone sem rotulo, nada de texto cinza sobre cinza.

---

## 3. GERENTE DE VELOCIDADE

**Objetivo:** abrir rapido no 4G da loja, sem framework, sem espera.

Perguntas obrigatorias:
- Quantas requisicoes essa tela faz? Da para fazer menos?
- Precisa mesmo de biblioteca externa? (resposta padrao: nao)
- O calculo pode ser feito no navegador em vez de ir no servidor?
- A pagina abre util antes de qualquer dado chegar?

Estado atual:
- Todas as paginas sao HTML/CSS/JS puro, zero dependencia de CDN.
- O simulador calcula tudo local, nao chama servidor nenhum.
- **Armadilha conhecida:** o plano gratuito do Render hiberna. O primeiro acesso do dia
  pode demorar ~50 segundos. Solucao futura: plano pago ou um ping agendado.
- **Armadilha conhecida:** existe um `public/index.html` vazio de 1 byte. Por isso o
  servidor usa `express.static("public", { index: false })`. Se alguem tirar esse
  `index: false`, a pagina principal quebra e passa a servir arquivo vazio.

---

## 4. GERENTE DE AUTOMACAO

**Objetivo:** tudo que se repete mais de 3 vezes por semana vira botao.

Perguntas obrigatorias:
- Qual parte disso o humano ainda faz na mao?
- Da para transformar em 1 clique? Em 0 clique?
- O que pode dar errado se rodar sozinho? Tem como desfazer?
- Isso respeita as regras da empresa e das plataformas?

Limites que NAO se cruzam (decisao permanente):
- Email nunca sai sozinho. O sistema deixa pronto, o humano confere e envia.
- Nada de disparo em massa por WhatsApp nao oficial (risco de banimento).
- Nada de contornar restricao de rede ou de horario definida pela empresa
  (NBS por IP interno, Syonet das 12h as 21h). O caminho e pedir acesso oficial.
- Senha nao entra em automacao. Integracao se faz com API, token de servico ou
  usuario de integracao criado pelo TI.

---

## 5. GERENTE DO CEREBRO

**Objetivo:** nada se perde e cada erro so acontece uma vez.

Perguntas obrigatorias:
- O que aprendi hoje que meu eu de amanha nao pode esquecer?
- Qual foi a causa raiz, nao so o sintoma?
- Qual armadilha um futuro ajudante cairia?
- Onde isso fica registrado e como se acha depois?

Formato obrigatorio de registro no cerebro:
```
### [DATA] - [TITULO DO PROBLEMA OU ENTREGA]
Contexto: o que estava acontecendo
Causa raiz: por que aconteceu
Solucao: o que foi feito, passo a passo
Armadilha: o que quase deu errado / o que nao repetir
Onde ficou: arquivo, commit, URL
```

Evolucao planejada do cerebro: sair de "um arquivo de texto gigante" para um painel
navegavel dentro do proprio site (abas Fichas, Estoque/Campanhas, Leads, Memoria),
lendo o conteudo do gist e mostrando organizado por data e por tema.

---

## Placar (atualizar a cada sessao)

| Data | Entregas | Problemas resolvidos | Onde |
|---|---|---|---|
| 25/07/2026 | validacao de CPF, anti-duplicidade, empty state | 6 | commit 4659dd2 |
| 25/07/2026 | campanhas de WhatsApp modelos 5 e 6 | - | commit 1f82f3b |
| 25/07/2026 | guia de integracao segura | - | commit 990e9a2 |
| 25/07/2026 | simulador v1 + abas | 1 | commits d7ae066 / 7b2332d |
| 26/07/2026 | simulador v2 (regua por perfil de CPF) | - | commit 931164e |
| 26/07/2026 | painel do que ja funciona | - | public/painel.html |
| 26/07/2026 | este manifesto | - | GERENTES-DE-MELHORIA.md |
