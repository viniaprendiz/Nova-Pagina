const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Função para extrair dados do cliente
function extractClientData(text) {
  const data = {};
  
  // Padrões de extração para cada campo
  const patterns = {
    cpf: /(?:cpf[:\s]*)?(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/gi,
    nome: /(?:nome[:\s]*)([A-Za-záàâãéèêíïóôõöúçñ\s]+?)(?=\n|$|cpf|mãe|cel|email|renda|km|data|rg|prof)/gi,
    mae: /(?:mãe[:\s]*)([A-Za-záàâãéèêíïóôõöúçñ\s]+?)(?=\n|$|cpf|nome|cel|email|renda|km|data|rg|prof)/gi,
    celular: /(?:cel|celular|tel|telefone)[:\s]*(\d{11})/gi,
    email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    renda: /(?:renda|salário)[:\s]*(\d+[.,]\d{2})/gi,
    km: /(?:km|quilometragem)[:\s]*(\d+)/gi,
    data: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
    rg: /(?:rg)[:\s]*(\d{2}\.?\d{3}\.?\d{3}-?\d{1})/gi,
    profissao: /(?:profissão|profissao|prof)[:\s]*([A-Za-záàâãéèêíïóôõöúçñ\s]+?)(?=\n|$|cpf|nome|mãe|cel|email|renda|km|data|rg)/gi
  };

  // Extrair CPF
  const cpfMatch = text.match(patterns.cpf);
  if (cpfMatch) {
    data.cpf = cpfMatch[0].replace(/[^\d]/g, '');
  }

  // Extrair NOME
  const nomeMatch = text.match(patterns.nome);
  if (nomeMatch) {
    data.nome = nomeMatch[0].trim().toUpperCase();
  }

  // Extrair MÃE
  const maeMatch = text.match(patterns.mae);
  if (maeMatch) {
    data.mae = maeMatch[0].trim().toUpperCase();
  }

  // Extrair CELULAR
  const celMatch = text.match(patterns.celular);
  if (celMatch) {
    data.celular = celMatch[0].replace(/[^\d]/g, '');
  }

  // Extrair EMAIL
  const emailMatch = text.match(patterns.email);
  if (emailMatch) {
    data.email = emailMatch[0].toLowerCase();
  }

  // Extrair RENDA
  const rendaMatch = text.match(patterns.renda);
  if (rendaMatch) {
    data.renda = rendaMatch[0].replace('.', '').replace(',', '.');
  }

  // Extrair KM
  const kmMatch = text.match(patterns.km);
  if (kmMatch) {
    data.km = kmMatch[0];
  }

  // Extrair DATA
  const dataMatch = text.match(patterns.data);
  if (dataMatch) {
    data.data = dataMatch[0];
  }

  // Extrair RG
  const rgMatch = text.match(patterns.rg);
  if (rgMatch) {
    data.rg = rgMatch[0];
  }

  // Extrair PROFISSÃO
  const profMatch = text.match(patterns.profissao);
  if (profMatch) {
    data.profissao = profMatch[0].trim();
  }

  // Auto-completar campos obrigatórios
  if (!data.km) data.km = Math.floor(Math.random() * 50000) + 10000;
  if (!data.profissao) data.profissao = 'Profissional';
  if (!data.rg) data.rg = '00.000.000-0';
  if (!data.data) data.data = '01/01/1990';

  return data;
}

// Validação de campos obrigatórios
function validateClient(data) {
  const required = ['cpf', 'nome', 'mae', 'celular', 'email', 'renda'];
  const missing = required.filter(field => !data[field]);
  return {
    valid: missing.length === 0,
    missing
  };
}

// API endpoint para extrair dados
app.post('/api/extract', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Texto não fornecido' });
  }

  const extracted = extractClientData(text);
  const validation = validateClient(extracted);

  res.json({
    data: extracted,
    validation,
    message: validation.valid ? 'Dados extraídos com sucesso' : `Faltam: ${validation.missing.join(', ')}`
  });
});

// Servir a página HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`TDrive Pro rodando em http://localhost:${PORT}`);
});
