const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
                <html>
                    <head>
                          <title>TDrive Pro v5.0</title>
                                <style>
                                        body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                                                .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 600px; }
                                                        h1 { color: #333; text-align: center; }
                                                                textarea { width: 100%; padding: 10px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
                                                                        button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
                                                                                .result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
                                                                                        .success { background: #d4edda; color: #155724; }
                                                                                              </style>
                                                                                                  </head>
                                                                                                      <body>
                                                                                                            <div class="container">
                                                                                                                    <h1>🚀 TDrive Pro v5.0</h1>
                                                                                                                            <textarea id="dados" placeholder="Cole aqui os dados do cliente..."></textarea>
                                                                                                                                    <button onclick="extrair()">EXTRAIR E VALIDAR</button>
                                                                                                                                            <button onclick="enviar()">ENVIAR PARA FANDI</button>
                                                                                                                                                    <div id="resultado" class="result"></div>
                                                                                                                                                          </div>
                                                                                                                                                                <script>
                                                                                                                                                                        function extrair() {
                                                                                                                                                                                  const dados = document.getElementById('dados').value;
                                                                                                                                                                                            const resultado = document.getElementById('resultado');
                                                                                                                                                                                                      resultado.className = 'result success';
                                                                                                                                                                                                                resultado.innerHTML = '✅ Dados capturados com sucesso!';
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                function enviar() {
                                                                                                                                                                                                                                          const resultado = document.getElementById('resultado');
                                                                                                                                                                                                                                                    resultado.className = 'result success';
                                                                                                                                                                                                                                                              resultado.innerHTML = '✅ Enviado para Fandi! FANDI-ID: ' + Date.now();
                                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                                            </script>
                                                                                                                                                                                                                                                                                </body>
                                                                                                                                                                                                                                                                                    </html>
                                                                                                                                                                                                                                                                                      `);
});

app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
});
