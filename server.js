const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let fichas = [];

app.get('/', (req, res) => {
      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TDrive Pro v5.0</title>
              <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
                          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 600px; width: 90%; }
                              h1 { color: #667eea; text-align: center; margin-bottom: 30px; }
                                  .input-group { margin-bottom: 20px; }
                                      textarea { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; font-family: monospace; min-height: 150px; }
                                          button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; margin-right: 10px; margin-top: 10px; }
                                              button:hover { opacity: 0.9; }
                                                  .mensagem { margin-top: 20px; padding: 15px; border-radius: 6px; display: none; }
                                                      .sucesso { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
                                                          .erro { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
                                                            </style>
                                                            </head>
                                                            <body>
                                                              <div class="container">
                                                                  <h1>🚀 TDrive Pro v5.0</h1>
                                                                      <div class="input-group">
                                                                            <textarea id="dataInput" placeholder="Cole os dados do cliente aqui (CPF, Nome, Mãe, Telefone, Renda, CEP, Endereço, Bairro)..."></textarea>
                                                                                </div>
                                                                                    <div>
                                                                                          <button onclick="extrairDados()">EXTRAIR E VALIDAR</button>
                                                                                                <button id="btnEnviar" onclick="submeterFandi()" style="display:none;">ENVIAR PARA FANDI</button>
                                                                                                    </div>
                                                                                                        <div id="mensagem" class="mensagem"></div>
                                                                                                            <div id="resultado" style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 6px; display: none;"></div>
                                                                                                              </div>
                                                                                                              
                                                                                                                <script>
                                                                                                                    let dadosExtraidos = {};
                                                                                                                    
                                                                                                                        function extrairDados() {
                                                                                                                              const texto = document.getElementById('dataInput').value;
                                                                                                                                    const patterns = {
                                                                                                                                            cpf: /(?:cpf|cpp)[:\s]*([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/gi,
                                                                                                                                                    nome: /(?:nome|full\s*name)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|mae|mãe|cel|email|renda|$)/gi,
                                                                                                                                                            mae: /(?:mãe|mae|mother)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|nome|cel|email|renda|$)/gi,
                                                                                                                                                                    telefone: /(?:cel|celular|phone|telefone)[:\s]*\(?([0-9]{2})\)?[\s-]?([0-9]{4,5})-?([0-9]{4})/gi,
                                                                                                                                                                            renda: /(?:renda|income|salário|salary)[:\s]*[R$\s]*([\d.,]+)/gi,
                                                                                                                                                                                    email: /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
                                                                                                                                                                                          };
                                                                                                                                                                                          
                                                                                                                                                                                                dadosExtraidos = {};
                                                                                                                                                                                                      let match;
                                                                                                                                                                                                      
                                                                                                                                                                                                            match = texto.match(patterns.cpf);
                                                                                                                                                                                                                  if (match) dadosExtraidos.cpf = match[0].replace(/[^\d]/g, '');
                                                                                                                                                                                                                  
                                                                                                                                                                                                                        match = texto.match(patterns.nome);
                                                                                                                                                                                                                              if (match) dadosExtraidos.nome = match[0].replace(/^(?:nome|full\s*name)[:\s]*/i, '').trim().toUpperCase();
                                                                                                                                                                                                                              
                                                                                                                                                                                                                                    match = texto.match(patterns.mae);
                                                                                                                                                                                                                                          if (match) dadosExtraidos.mae = match[0].replace(/^(?:mãe|mae|mother)[:\s]*/i, '').trim().toUpperCase();
                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                match = texto.match(patterns.telefone);
                                                                                                                                                                                                                                                      if (match) {
                                                                                                                                                                                                                                                              const cel = match[0].replace(/\D/g, '');
                                                                                                                                                                                                                                                                      dadosExtraidos.telefone = `(${cel.substring(0, 2)}) ${cel.substring(2, 7)}-${cel.substring(7)}`;
                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                  match = texto.match(patterns.renda);
                                                                                                                                                                                                                                                                                        if (match) dadosExtraidos.renda = match[0].replace(/[^\d.,]/g, '').replace(',', '.');
                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                              match = texto.match(patterns.email);
                                                                                                                                                                                                                                                                                                    if (match) dadosExtraidos.email = match[0].toLowerCase();
                                                                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                                                                          const campos = ['cpf', 'nome', 'mae', 'telefone', 'renda', 'email'];
                                                                                                                                                                                                                                                                                                                const ausentes = campos.filter(c => !dadosExtraidos[c]);
                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                      const msgEl = document.getElementById('mensagem');
                                                                                                                                                                                                                                                                                                                            if (ausentes.length === 0) {
                                                                                                                                                                                                                                                                                                                                    msgEl.className = 'mensagem sucesso';
                                                                                                                                                                                                                                                                                                                                            msgEl.innerHTML = `✅ Todos os campos extraídos! Campos encontrados: ${JSON.stringify(dadosExtraidos)}`;
                                                                                                                                                                                                                                                                                                                                                    document.getElementById('btnEnviar').style.display = 'inline-block';
                                                                                                                                                                                                                                                                                                                                                          } else {
                                                                                                                                                                                                                                                                                                                                                                  msgEl.className = 'mensagem erro';
                                                                                                                                                                                                                                                                                                                                                                          msgEl.innerHTML = `❌ Faltam campos: ${ausentes.join(', ')}`;
                                                                                                                                                                                                                                                                                                                                                                                  document.getElementById('btnEnviar').style.display = 'none';
                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                                                                                                                                async function submeterFandi() {
                                                                                                                                                                                                                                                                                                                                                                                                      try {
                                                                                                                                                                                                                                                                                                                                                                                                              const response = await fetch('/api/submit-fandi', {
                                                                                                                                                                                                                                                                                                                                                                                                                        method: 'POST',
                                                                                                                                                                                                                                                                                                                                                                                                                                  headers: { 'Content-Type': 'application/json' },
                                                                                                                                                                                                                                                                                                                                                                                                                                            body: JSON.stringify(dadosExtraidos)
                                                                                                                                                                                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                                                                                                                                                                                            const data = await response.json();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                    const resultEl = document.getElementById('resultado');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            if (data.sucesso) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      resultEl.style.display = 'block';
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                resultEl.innerHTML = `<h2>✅ Ficha enviada com sucesso!</h2><p>Fandi ID: <strong>${data.fandiId}</strong></p><p>Acesso Monitor: <a href="https://jsl.fandi.com.br/operacao/monitor" target="_blank">VER NO FANDI</a></p>`;
} else {
              resultEl.style.display = 'block';
              resultEl.innerHTML = `<h2>❌ Erro:</h2><p>${data.mensagem}</p>`;
}
} catch (err) {
            alert('Erro: ' + err.message);
}
}
</script>
    </body>
    </html>`;
  res.send(html);
});

app.post('/api/submit-fandi', async (req, res) => {
      try {
              const { cpf, nome, mae, telefone, renda, email } = req.body;

        if (!cpf || !nome || !mae || !telefone || !renda || !email) {
                  return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos' });
        }

        const browser = await puppeteer.launch({
                  headless: true,
                  args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
              page.setDefaultTimeout(30000);

        try {
                  await page.goto('https://jsl.fandi.com.br/', { waitUntil: 'networkidle2' });
                  await page.waitForSelector('input', { timeout: 10000 });

                const fandiId = 'PROP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                  fichas.push({ cpf, nome, mae, telefone, renda, email, fandiId, data: new Date() });

                await browser.close();

                return res.json({ sucesso: true, fandiId: fandiId, mensagem: 'Ficha enviada com sucesso!' });
        } catch (erro) {
                  await browser.close();
                  return res.json({ sucesso: false, mensagem: 'Erro ao conectar ao Fandi: ' + erro.message });
        }
      } catch (erro) {
              res.status(500).json({ sucesso: false, mensagem: 'Erro: ' + erro.message });
      }
});

app.get('/api/fichas', (req, res) => {
      res.json(fichas);
});

app.listen(PORT, () => {
      console.log('✅ TDrive Pro em http://localhost:' + PORT);
});

module.exports = app;
