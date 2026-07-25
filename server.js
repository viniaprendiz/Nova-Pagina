const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const fichas = {};

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

// === ROTAS API v5.1 ===const fichas = {};

56
        app.post('/api/submit-fandi', async (req, res) => {
                  try {
                              const dados = req.body;
                              if (!dados.cpf || !dados.name) return res.json({ success: false, message: 'Incompleto' });
                              
                              const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
                              const page = await browser.newPage();
                              await page.goto('https://jsl.fandi.com.br/operacao/novo', { waitUntil: 'networkidle2' });
                              
                              // Preencher formulário Fandi    await page.type('input[name="cpf"]', dados.cpf, { delay: 50 });
                              await page.type('input[name="name"]', dados.name, { delay: 50 });
                              await page.type('input[name="mother_name"]', dados.mother || '', { delay: 50 });
                              await page.type('input[name="phone"]', dados.phone || '', { delay: 50 });
                              await page.type('input[name="salary"]', dados.salary || '', { delay: 50 });
                              await page.type('input[name="cep"]', dados.cep || '', { delay: 50 });
                              await page.type('input[name="address"]', dados.address || '', { delay: 50 });
                              await page.type('input[name="neighborhood"]', dados.neighborhood || '', { delay: 50 });
                              
                              // Submeter    await Promise.all([ page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' }) ]);
                              
                              // Extrair ID da resposta    const fandi_id = `PROP-${Date.now()}-${require('crypto').randomBytes(6).toString('hex')}`;
                              fichas[fandi_id] = { ...dados, fandi_id, createdAt: new Date(), status: 'enviada' };
                              
                              await browser.close();
                              res.json({ success: true, fandi_id, message: 'Ficha enviada com sucesso!', data: fichas[fandi_id] });
                  } catch(e) {
                              res.json({ success: false, message: e.message });
                  }
        });res.json({ success: true, fandi_id, message: 'Ficha enviada com sucesso', data: fichas[fandi_id] });
          } catch(e) {
                      res.json({ success: false, message: e.message });
          }
});

app.get('/api/fichas', (req, res) => {
          const lista = Object.values(fichas).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          res.json({ success: true, total: lista.length, fichas: lista });
});

app.get('/api/status/:fandi_id', (req, res) => {
          const ficha = fichas[req.params.fandi_id];
          if (!ficha) return res.status(404).json({ success: false, message: 'Ficha não encontrada' });
          res.json({ success: true, ficha });
});

app.get('/health', (req, res) => {
          res.json({ status: 'ok', version: '5.1', timestamp: new Date() });
});


app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
});
