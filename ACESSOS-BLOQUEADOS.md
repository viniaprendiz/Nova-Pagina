# ACESSOS BLOQUEADOS - o caminho certo

Atualizado: 26/07/2026

## Por que este arquivo existe

Tres sistemas hoje travam a automacao: **NBS** (so responde no wifi da loja),
**Syonet** (so abre em certa faixa de horario) e o **banco Toyota** (nao tem
integracao liberada pra vendedor).

Nenhum desses tres e problema tecnico. Sao **regras que a empresa configurou de
proposito**: restricao de rede, janela de horario e contrato de integracao.

Por isso a regra do projeto:

> O assistente NAO tenta VPN, proxy, tunel, mudanca de fuso, IP falso nem qualquer
> jeitinho pra driblar essas travas. Nao vale arriscar o emprego do Vinicios por
> uma automacao. O caminho e o formal, por escrito, com o TI.

Se der ruim num acesso burlado, a conversa nao vai ser sobre automacao: vai ser
sobre acesso indevido a sistema da empresa. O prejuizo e muito maior que o ganho.

## Situacao de cada um

### NBS - so funciona no wifi da loja
- Sintoma: fora da rede interna, nao abre. Antes abria.
- Causa provavel: a empresa fechou o acesso externo (o sistema responde num IP interno).
- Caminho certo: pedir ao TI acesso remoto autorizado (VPN corporativa fornecida por
  eles, publicacao segura ou terminal remoto). Quem libera e o TI, com o de-acordo do gerente.

### Syonet - so abre em certo horario
- Sintoma: fora da janela nao entra. Alguns vendedores conseguem em horario maior.
- Causa provavel: isso e **perfil de usuario**, nao rede. Se colega entra e voce nao,
  o perfil dele tem janela diferente.
- Caminho certo: pedir revisao do seu perfil de acesso, citando que colegas da mesma
  funcao tem janela maior.

### Banco Toyota - integracao
- Integracao com banco exige contrato e credencial institucional.
- Nao existe caminho de vendedor sozinho. Tem que subir pela gerencia/diretoria.
- Enquanto nao existir: o robo do Fandi ja resolve a parte da ficha.

## Texto pronto pro TI (VOCE envia, revise antes)

Assunto: Solicitacao de acesso - NBS remoto e ajuste de janela no Syonet

Ola, tudo bem?

Sou Vinicios Caleiras, consultor de vendas da TDrive (Aricanduva).

Preciso de duas liberacoes para conseguir atender cliente fora do balcao:

1) NBS: hoje o sistema so abre quando estou na rede interna da loja. Ha algum acesso
remoto autorizado (VPN da empresa ou publicacao segura) que eu possa usar? Uso para
consultar estoque e status de veiculo quando estou com o cliente em outro ambiente.

2) Syonet: meu usuario so entra em uma faixa de horario. Colegas da mesma funcao
conseguem acessar em horario mais amplo. Da para revisar o meu perfil de acesso para
a mesma janela deles?

O objetivo e responder o cliente mais rapido e nao perder venda por tempo de resposta.
Se precisar de aprovacao do gerente da loja, me avisa que eu levo o pedido pra ele.

Obrigado!
Vinicios Caleiras - Consultor de vendas TDrive Aricanduva

## Enquanto nao libera: o que ja resolve

- **Syonet**: em vez de puxar lead por API, use o **importador do CRM**
  (/crm.html). Voce exporta ou copia a lista de leads, cola no campo e ele
  transforma em cards com telefone, nome, modelo e pontuacao automatica.
- **NBS**: consulta de estoque continua manual na loja, mas o CRM guarda o que
  o cliente quer, entao voce consulta uma vez e ja sai com tudo anotado.
- **Banco Toyota**: o Fandi ja cobre o financiamento, e o retorno do banco aparece
  na propria tela de fichas.

## Regra final

Automacao boa e a que voce pode mostrar pro seu gerente sem medo. Se precisa
esconder, nao entra neste projeto.
