const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function extractClientData(text) {
  const data = {};
  const patterns = {
    cpf: /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/gi,
    nome: /(?:nome[:\s]*)([a-záàâãéèêíïóôõöúçñ\s]+?)(?=\n|$|cpf|m[aã]e|cel|email|renda)/gi,
    mae: /(?:m[aã]e[:\s]*)([a-záàâãéèêíïóôõöúçñ\s]+?)(?=\n|$|cpf|nome|cel|email|renda)/gi,
    celular: /(?:cel|celular)[:\s]*(\d{11})/gi,
    email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    renda: /(?:renda)[:\s]*(\d+[.,]\d{2})/gi
  };

  const cpfMatch = text.match(patterns.cpf);
  if (cpfMatch) data.cpf = cpfMatch[0].replace(/[^\d]/g, '');

  const nomeMatch = text.match(patterns.nome);
  if (nomeMatch) data.nome = nomeMatch[0].trim().toUpperCase();

  const maeMatch = text.match(patterns.mae);
  if (maeMatch) data.mae = maeMatch[0].trim().toUpperCase();

  const celMatch = text.match(patterns.celular);
  if (celMatch) data.celular = celMatch[0].replace(/[^\d]/g, '');

  const emailMatch = text.match(patterns.email);
  if (emailMatch) data.email = emailMatch[0].toLowerCase();

  const rendaMatch = text.match(patterns.renda);
  if (rendaMatch) data.renda = rendaMatch[0];

  return data;
}

function validateClient(data) {
  const required = ['cpf', 'nome', 'mae', 'celular', 'email', 'renda'];
  const missing = required.filter(field => !data[field]);
  return { valid: missing.length === 0, missing };
}

app.post('/api/extract', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto não fornecido' });

    const extracted = extractClientData(text);
    const validation = validateClient(extracted);

    res.json({
      data: extracted,
      validation: validation,
      message: validation.valid ? 'Sucesso!' : `Faltam: ${validation.missing.join(', ')}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/submit-fandi', (req, res) => {
  try {
    const clientData = req.body;
    const fandi_id = 'PROP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    console.log('Cliente enviado:', { nome: clientData.nome, cpf: clientData.cpf, fandi_id });

    res.json({ success: true, fandi_id: fandi_id, message: 'Enviado com sucesso!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TDrive Pro rodando em http://localhost:${PORT}`);
});
