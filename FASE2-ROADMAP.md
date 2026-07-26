# FASE 2: GANHAR DINHEIRO

## Status
✅ Fase 1 (Setup) completa
🚀 Fase 2 (Monetização) inicia AGORA

## O que falta fazer

### 1. Dashboard Tempo Real (3h)
- npm install express cors
- - Criar /src/routes/dashboard.js
  - - GET /api/stats → retorna {leads, conversions, revenue}
    - - Frontend simples em /public/dashboard.html
     
      - ### 2. N8N Automação (4h)
      - - Setup em n8n.cloud (FREE)
        - - Workflow: Syonet → ChatGPT → WhatsApp → FANDI → Stripe
          - - Lead entra sozinho, sai convertido
           
            - ### 3. Stripe (2h)
            - - Criar conta em stripe.com
              - - Add API keys no .env
                - - npm install stripe
                  - - POST /api/checkout → cria sessão Stripe
                   
                    - ### 4. Landing Page (1h)
                    - - Copiar /public/index.html
                      - - Adicionar botão "Testar Grátis"
                        - - Link para Stripe checkout
                         
                          - ### 5. Primeiro Cliente (2h)
                          - - Testar fluxo completo
                            - - 1 dealership piloto
                              - - Coletar feedback
                               
                                - ## Timeline
                                - **Hoje**: Items 1-3 (9 horas)
                                - **Amanhã**: Items 4-5 (4 horas)
                                - **Resultado**: R$ 500-1k entrada em 48h
                               
                                - ## Commands
                                - ```
                                  npm run start  # Inicia servidor
                                  npm run maestral  # Auto-cleanup
                                  ```

                                  ## Próximo: Me chama quando terminar Phase 1 localmente!
                                  
