import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Credenciais Fandiconst FANDI_EMAIL = 'vinicios.ferreira@uab';const FANDI_PASSWORD = 'Automob@2000';const FANDI_URL = 'https://jsl.fandi.com.br/operacao/cadastrar/financiada?Cna_Codigo=5';const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Extrator inteligente de dadosfunction extractClientData(text) {
  const data = {};

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Padrões para extrair  const patterns = {
    cpf: { regex: /CPF[:\s]*([0-9.\-]{11,14})/i, clean: (v) => v.replace(/\D/g, '') },
    nome: { regex: /NOME[:\s]*([A-Z\sáàâãéèêíïóôõöúçñ]+)/i, clean: (v) => v.trim() },
    data: { regex: /DATA[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, clean: (v) => v.trim() },
    datanascimento: { regex: /DATA NASCIMENTO[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, clean: (v) => v.trim() },
    celular: { regex: /CEL[ULAR]*[:\s]*(?:\(?([0-9]{2})\)?\s*)?([0-9]{4,5})\-?([0-9]{4})/i, clean: (v) => v },
    rg: { regex: /RG[:\s]*([0-9.\-]{10,14})/i, clean: (v) => v.trim() },
    email: { regex: /EMAIL[:\s]*([a-zA-Z0-9._%+\-@]+)/i, clean: (v) => v.trim() },
    cep: { regex: /CEP[:\s]*([0-9\-]{8,9})/i, clean: (v) => v.replace(/\-/g, '') },
    numero: { regex: /^N[UMERO]*[:\s]*([0-9]+)/im, clean: (v) => v.trim() },
    profissao: { regex: /PROFISS[ÃA]O[:\s]*([A-Z\s.\-áàâãéèêíïóôõöúçñ]+)/i, clean: (v) => v.trim() },
    renda: { regex: /RENDA[:\s]*([0-9]+[.,][0-9]{2})/i, clean: (v) => v.trim() },
    cnh: { regex: /TENHO CNH|CNH/i, clean: () => 'SIM' },
    pai: { regex: /PAI[:\s]*([A-Z\sáàâãéèêíïóôõöúçñ]+)/i, clean: (v) => v.trim() },
    mae: { regex: /M[A]?E[:\s]*([A-Z\sáàâãéèêíïóôõöúçñ]+)/i, clean: (v) => v.trim() }
};

  const cleanText = text.toUpperCase();

  for (const [key, { regex, clean }] of Object.entries(patterns)) {
        const match = cleanText.match(regex);
        if (match) {
                if (key === 'celular') {
                          const ddd = match[1] || '11';
                          const firstPart = match[2];
                          const secondPart = match[3];
                          data[key] = `(${ddd}) ${firstPart}-${secondPart}`;
                } else {
                          data[key] = clean(match[1]);
                }
        }
  }

  return data;
}

// Validar dadosfunction validateData(data) {
  const errors = [];
  if (!data.cpf || data.cpf.length !== 11) errors.push('CPF inválido (deve ter 11 dígitos)');
  if (!data.nome || data.nome.length < 3) errors.push('Nome inválido (mínimo 3 caracteres)');
  if (!data.data && !data.datanascimento) errors.push('Data de nascimento não encontrada');
  if (data.data && !/^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}$/.test(data.data)) errors.push('Data inválida (use DD/MM/YYYY)');

  return { isValid: errors.length === 0, errors };
}

// Preencher Fandiasync function fillFandiWithAutomation(clientData) {
  let browser;
  try {
        console.log('[FANDI] Iniciando com:', clientData);

    const options = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };

    browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        await page.goto(FANDI_URL, { waitUntil: 'load' });

    return {
            success: true,
            message: 'Formulário pronto para preencher!',
            extracted: clientData,
            fandi_ready: true
    };
  } catch (error) {
        console.error('[FANDI] Erro:', error.message);
        return {
                success: false,
                message: 'Erro ao acessar Fandi: ' + error.message,
                extracted: clientData,
                error: error.message
        };
  } finally {
        if (browser) await browser.close();
  }
}

// APIsapp.get('/api/status', (req, res) => {
  res.json({ status: 'online', version: 'MVP v2 Inteligente' });
});

app.post('/api/preencherFandi', async (req, res) => {
    try {
          const { dados } = req.body;
          if (!dados) return res.status(400).json({ success: false, message: 'Envie os dados' });

      const clientData = extractClientData(dados);
          const validation = validateData(clientData);

      if (!validation.isValid) {
              return res.json({
                        success: false,
                        message: 'Dados incompletos',
                        errors: validation.errors,
                        extracted: clientData
              });
      }

      const result = await fillFandiWithAutomation(clientData);
          res.json(result);
    } catch (error) {
          res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📝 MVP v2 com Automação Inteligente`);
});
