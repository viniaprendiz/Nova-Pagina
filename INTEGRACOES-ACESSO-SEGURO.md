# INTEGRACOES - PLANO DE ACESSO SEGURO (NBS, Syonet, Fandi)

Este documento define COMO cada sistema externo sera integrado, de um jeito seguro.

## Regra de seguranca que o assistente segue (nao muda)
- O assistente NUNCA guarda, digita ou salva senha do Vinicios em codigo, commit, cerebro ou qualquer lugar.
- O login em cada sistema e sempre feito pelo proprio Vinicios. O sistema automatiza o resto DEPOIS que a sessao ja esta autenticada.
- O assistente nao burla restricoes que a propria empresa configurou (horario de acesso, rede interna, etc). Se a restricao atrapalha, quem libera e o administrador do sistema.

## ALERTA DE SEGURANCA (importante)
O Vinicios usa a MESMA senha (Automob@2000) em varios sistemas internos (Fandi, NBS, Syonet). Isso e arriscado: se um sistema vazar, todos ficam expostos - e do outro lado dessas telas estao CPFs e dados de clientes. Recomendacao: trocar a senha e usar senhas diferentes por sistema. (A senha em si NAO fica registrada aqui.)

## 1. FANDI - JA FUNCIONA
- Status: automacao ativa via formulario publico (jsl.fandi.com.br/operacao/novo), sem precisar de senha guardada.
- O site TDrive Pro (paginaexemplo.onrender.com) recebe os dados colados, envia via Puppeteer e devolve o link real da ficha + botao de email pronto (sem enviar).
- Proximo passo opcional: validar os seletores reais do formulario do Fandi com um envio de teste combinado com o Vinicios.

## 2. NBS (CRM Gold) - PRECISA RODAR DENTRO DA REDE DA LOJA
- URL: http://10.100.9.147:8080/crmgold/veiculo.zul
- Isso e um IP INTERNO (rede 10.x.x.x). So responde de dentro do wifi da loja - por isso nao abre de casa.
- O assistente NAO vai tentar contornar isso por VPN/proxy para entrar num sistema interno restrito. Esse tipo de acesso remoto a rede interna precisa ser configurado por quem administra a rede/TI da loja, de forma oficial.
- Caminho correto para automatizar o NBS (girar estoque / carros parados / maior desconto):
  a) Rodar um pequeno coletor DENTRO da rede da loja (ex: um PC da loja ou um mini-servidor local) que o Vinicios autentica.
    b) Esse coletor le a lista de veiculos e envia so os dados de estoque (sem login) para o sistema TDrive Pro na nuvem.
      c) A partir dai o site monta as campanhas (ex: carro ha mais tempo parado = maior desconto) automaticamente.
      - Enquanto isso nao existe: quando estiver na loja, o Vinicios pode copiar a lista de veiculos e colar no sistema (mesmo padrao da ficha do Fandi), que ja da pra montar as campanhas de WhatsApp.

      ## 3. SYONET (leads) - PRECISA LIBERACAO DE HORARIO PELO ADMIN
      - URL: automob.syonet.com
      - Restricao: acesso liberado so 12h-21h, seg a sabado. Essa trava foi configurada pela empresa de proposito.
      - O assistente NAO vai burlar essa janela de horario. Se atrapalha, o caminho e pedir ao administrador do Syonet (TI/Automob) para ampliar o horario da conta do Vinicios.
      - Quando o acesso estiver disponivel e com login feito pelo Vinicios, da para automatizar: capturar leads novos, organizar por prioridade e disparar o proximo contato.

      ## Resumo do que depende do Vinicios (o assistente nao faz por ele)
      - Trocar a senha compartilhada por senhas fortes e diferentes.
      - Pedir a TI da loja para viabilizar acesso oficial ao NBS de fora da rede (se quiser rodar de casa).
      - Pedir ao admin do Syonet para ampliar o horario de acesso, se necessario.
      - Fazer o proprio login em cada sistema quando a integracao entrar em operacao.
      
