const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const fichas = [];

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
    for (let i = 1; i <= 9; i++) {
          soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
    for (let i = 1; i <= 10; i++) {
          soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function extractClientData(text) {
    const data = {};
    const patterns = {
          cpf: /(?:cpf|cpp)[:\s]*([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/gi,
          nome: /(?:nome|full\s*name)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|mãe|mae|cel|email|renda|$)/gi,
          mae: /(?:m[aã]e|mother)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|nome|cel|email|renda|$)/gi,
          celular: /(?:cel|celular|phone)[:\s]*\(?([0-9]{2})\)?[\s-]?([0-9]{4,5})-?([0-9]{4})/gi,
          email: /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
          renda: /(?:renda|income)[:\s]*[R$\s]*([\d.,]+)/gi
    };

  let match = text.match(patterns.cpf);
    if (match) {
          const cpfLimpo = match[0].replace(/[^\d]/g, '');
          data.cpf = cpfLimpo;
          data.cpfValido = validarCPF(cpfLimpo);
    }

  match = text.match(patterns.nome);
    if (match) {
          data.nome = match[0].replace(/^(?:nome|full\s*name)[:\s]*/i, '').trim().toUpperCase();
    }

  match = text.match(patterns.mae);
    if (match) {
          data.mae = match[0].replace(/^(?:m[aã]e|mother)[:\s]*/i, '').trim().toUpperCase();
    }

  match = text.match(patterns.celular);
    if (match) {
          const groups = /\(?([0-9]{2})\)?[\s-]?([0-9]{4,5})-?([0-9]{4})/.exec(match[0]);
          if (groups) {
                  data.celular = groups[1] + groups[2] + groups[3];
          }
    }

  match = text.match(patterns.email);
    if (match) {
          data.email = match[0].toLowerCase();
    }

  match = text.match(patterns.renda);
    if (match) {
          const rendaStr = match[0].replace(/^(?:renda|income)[:\s]*/i, '').replace(/R\$\s*/i, '').replace(/\.(?=\d{3}[,.])/g, '').replace(/,/g, '.');
          data.renda = parseFloat(rendaStr).toFixed(2);
    }

  return data;
}

function validateClient(data) {
    const required = ['cpf', 'nome', 'mae', 'celular', 'email', 'renda'];
    const missing = required.filter(field => !data[field]);
    return {
          valid: missing.length === 0 && data.cpfValido !== false,
          missing: missing,
          cpfValid: data.cpfValido
    };
}

async function submitToFandi(clientData) {
    return new Promise((resolve) => {
          try {
                  const fandi_id = `PROP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
                  const ficha = {
                            fandi_id,
                            cpf: clientData.cpf,
                            nome: clientData.nome,
                            mae: clientData.mae,
                            celular: clientData.celular,
                            email: clientData.email,
                            renda: clientData.renda,
                            status: 'enviado',
                            timestamp: new Date().toISOString()
                  };
                  fichas.push(ficha);
                  resolve({
                            success: true,
                            fandi_id,
                            message: 'Ficha enviada com sucesso! ✅',
                            ficha_numero: fichas.length
                  });
          } catch (error) {
                  resolve({
                            success: false,
                            message: `Erro ao enviar: ${error.message}`,
                            error: error.message
                  });
          }
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/extract', (req, res) => {
    try {
          const { text } = req.body;
          if (!text) {
                  return res.status(400).json({ error: 'Texto não fornecido', success: false });
          }
          const extracted = extractClientData(text);
          const validation = validateClient(extracted);
          res.json({
                  data: extracted,
                  validation: validation,
                  message: validation.valid ? '✅ Todos os dados extraídos!' : `⚠️ Faltam: ${validation.missing.join(', ')}`
          });
    } catch (error) {
          res.status(500).json({ error: 'Erro ao processar', message: error.message });
    }
});

app.post('/api/submit-fandi', async (req, res) => {
    try {
          const { cpf, nome, mae, celular, email, renda } = req.body;
          const clientData = { cpf, nome, mae, celular, email, renda };
          const validation = validateClient(clientData);
          if (!validation.valid) {
                  return res.status(400).json({
                            success: false,
                            message: `Faltam: ${validation.missing.join(', ')}`,
                            missing: validation.missing
                  });
          }
          const result = await submitToFandi(clientData);
          res.json(result);
    } catch (error) {
          res.status(500).json({ success: false, message: 'Erro na submissão', error: error.message });
    }
});

app.get('/api/fichas', (req, res) => {
    res.json({ total: fichas.length, fichas: fichas });
});

app.get('/api/status/:fandi_id', (req, res) => {
    const ficha = fichas.find(f => f.fandi_id === req.params.fandi_id);
    if (!ficha) {
          return res.status(404).json({ success: false, message: 'Ficha não encontrada' });
    }
    res.json({ success: true, ficha: ficha });
});

app.listen(PORT, () => {
    console.log(`🚀 TDrive Pro v2.0 em http://localhost:${PORT}`);
    console.log(`📊 API: /api/fichas - GET /api/status/:id`);
});

module.exports = app;
