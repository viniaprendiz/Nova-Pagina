# VOZ E CELULAR - o que da, o que nao da, e o caminho

> Criado em 26/07/2026, a pedido do Vinicios:
> "poder conversar com voce atraves do meu celular... mandar apenas um audio,
> esse audio ser transcrito nesse chat, e ainda escolher Opus 5, Sonnet ou Haiku,
> tudo automatico."

Vou separar em tres partes: **o que ja resolvi e esta no ar**, **o que existe pronto no mundo
e voce so precisa ligar**, e **o que eu nao consigo fazer e por que**.

---

## 1. O QUE JA ESTA NO AR (feito hoje)

### /voz.html - ditado direto no navegador do celular

Abra **paginaexemplo.onrender.com/voz.html** no Chrome do Android:

- toca no botao grande, fala, e o texto aparece transcrito na hora;
- da para editar, copiar, salvar como nota no proprio aparelho;
- botao para jogar direto no WhatsApp ou no email;
- botao "Colar modelo em branco" que ja monta o formato de ficha
  (CPF / Nome / Mae / Telefone / Salario / CEP / Endereco / Bairro),
  o mesmo formato que a tela de fichas entende. Voce dita, copia e cola na ficha.

Detalhes tecnicos: usa a API de reconhecimento de fala do proprio navegador
(`SpeechRecognition`), em pt-BR, modo continuo. Zero custo, zero servidor, zero biblioteca.
As notas ficam so no seu aparelho (localStorage), nao sobem para lugar nenhum.

Limitacoes honestas:
- funciona bem no **Chrome do Android**;
- no **iPhone/Safari** essa API nao existe. Alternativa no iPhone: tocar na caixa de texto e
  usar o **microfone do proprio teclado**, que faz a mesma transcricao;
- precisa de internet e da permissao de microfone liberada para o site;
- nome proprio e CPF falado sai com erro as vezes. Sempre confira antes de enviar ficha.

### Atalho na tela inicial do celular
No Chrome do celular: menu (tres pontinhos) > "Adicionar a tela inicial".
Fica com cara de aplicativo, abre em um toque.

---

## 2. O QUE JA EXISTE PRONTO E RESOLVE O SEU PEDIDO PRINCIPAL

Seu pedido de "mandar audio do celular e cair como texto na conversa, podendo escolher
Opus, Sonnet ou Haiku" **ja existe oficialmente**: e o **aplicativo do Claude no celular**
(Android e iPhone).

Dentro do app voce:
- segura o botao de microfone e fala, ele transcreve;
- escolhe o modelo (Opus / Sonnet / Haiku) no seletor de modelo da conversa;
- continua a mesma conta, entao o historico acompanha.

**Recomendacao:** instale o app do Claude no seu celular e faca login com a sua conta.
Isso resolve 100% do pedido, hoje, sem gambiarra e sem custo extra de infra.
Eu nao instalo nem faco login por voce - conta e login sao coisas suas.

---

## 3. O QUE EU NAO VOU FAZER (e o motivo, sem enrolacao)

**Nao vou construir um "chat com o Claude" dentro do seu site.**
Para isso eu precisaria de uma chave de API sua guardada no servidor. Isso significa:
- guardar credencial sua em um repositorio **publico** (o Nova-Pagina e publico hoje);
- conta com cobranca por uso, que roda sem voce ver;
- risco de alguem achar a chave e gastar no seu nome.

Nao vale a pena para resolver algo que o aplicativo oficial ja faz de graca.

**Se um dia voce quiser mesmo um assistente proprio no site**, o caminho seguro seria:
1. repositorio **privado**;
2. chave de API guardada como variavel de ambiente no Render, **nunca no codigo**;
3. login obrigatorio na area, para nao virar chat aberto para o mundo;
4. limite de gasto configurado na conta.
Eu monto a estrutura; a chave e a conta ficam nas suas maos e voce mesmo cola no Render.

---

## 4. IDEIA BOA PARA DEPOIS: recado de voz vira tarefa

Fluxo que da para montar sem chave de API nenhuma:
1. voce dita em /voz.html;
2. clica em "Salvar nota";
3. as notas ficam listadas na propria pagina, com data e hora;
4. quando voce abrir o computador, elas estao la esperando para virar acao.

Melhorias na fila:
- salvar as notas no Postgres em vez de so no aparelho, para aparecer no PC tambem;
- classificar sozinho: se a nota tem CPF, vira ficha; se tem nome de carro, vira anotacao
  de estoque; se tem "ligar", vira lembrete;
- botao "transformar nota em ficha" que ja leva o texto preenchido para a tela de envio.

---

## Resumo em uma linha

Para **ditar e trabalhar**: use `/voz.html` (ja no ar).
Para **conversar comigo por voz escolhendo o modelo**: use o **app oficial do Claude** no celular.
