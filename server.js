const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
// ROTA: Status do servidor
// ============================================================
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor Fandi Automação rodando!',
    timestamp: new Date()
  });
});

// ============================================================
// ROTA: Preencher Fandi automaticamente
// ============================================================
app.post('/api/preencherFandi', async (req, res) => {
  const { cpf, nome, data_nascimento, celular, valor, km } = req.body;

  try {
    console.log('📋 Iniciando automação Fandi...');
    console.log(`Cliente: ${nome} (${cpf})`);

    // Abrir navegador headless
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Acessar Fandi
    console.log('🌐 Acessando Fandi...');
    await page.goto('https://jsl.fandi.com.br/operacao/cadastrar/financiada?Cna_Codigo=5&embed=fandi-one', {
      waitUntil: 'networkidle2'
    });

    // Etapa 1: Departamento
    console.log('📝 Etapa 1: Selecionando departamento...');
    const selects = await page.$$('select');
    if (selects.length > 0) {
      await page.select('select', 'SEMINOVOS');
      await page.waitForTimeout(1000);
    }

    // Clica próxima
    console.log('➡️  Avançando para Etapa 2...');
    const buttons = await page.$$('button');
    for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Próxima')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Etapa 2: Dados Cliente
    console.log('👤 Etapa 2: Preenchendo dados do cliente...');
    const inputs = await page.$$('input');
    for (let input of inputs) {
      const placeholder = await page.evaluate(el => el.placeholder, input);
      
      if (placeholder.includes('CPF')) {
        await input.type(cpf, { delay: 50 });
        await page.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })), input);
      }
      if (placeholder.includes('Nome')) {
        await input.type(nome, { delay: 50 });
      }
      if (placeholder.includes('dd/mm')) {
        await input.type(data_nascimento, { delay: 50 });
      }
      if (placeholder.includes('00)')) {
        await input.type(celular, { delay: 50 });
      }
    }
    await page.waitForTimeout(1000);

    // Próxima
    console.log('➡️  Avançando para Etapa 3...');
    for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Próxima')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Etapa 3: Dados Veículo
    console.log('🚗 Etapa 3: Preenchendo dados do veículo...');
    const inputs2 = await page.$$('input');
    for (let input of inputs2) {
      const placeholder = await page.evaluate(el => el.placeholder, input);
      
      if (placeholder.includes('0,00')) {
        await input.type(valor, { delay: 50 });
      }
      if (placeholder.includes('km') || placeholder.includes('59')) {
        await input.type(km, { delay: 50 });
      }
    }
    await page.waitForTimeout(1000);

    // Próxima
    console.log('➡️  Avançando para Etapa 4...');
    for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Próxima')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Etapa 4: Enviar
    console.log('📤 Etapa 4: Enviando ficha...');
    await page.waitForTimeout(2000);
    
    for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Enviar')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({ path: 'resultado_final.png' });

    await browser.close();

    console.log('✅ Automação concluída com sucesso!');
    res.json({
      status: 'sucesso',
      message: 'Ficha preenchida com sucesso!',
      cliente: nome,
      cpf: cpf
    });

  } catch (error) {
    console.error('❌ Erro durante automação:', error.message);
    res.status(500).json({
      status: 'erro',
      message: error.message
    });
  }
});

// ============================================================
// ROTA: Testar conexão com Fandi
// ============================================================
app.post('/api/testarFandi', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://jsl.fandi.com.br/operacao/cadastrar/financiada?Cna_Codigo=5', {
      waitUntil: 'networkidle2'
    });

    const title = await page.title();
    await browser.close();

    res.json({
      status: 'conectado',
      message: 'Fandi acessível!',
      title: title
    });

  } catch (error) {
    res.status(500).json({
      status: 'erro',
      message: 'Não conseguiu acessar Fandi'
    });
  }
});

// ============================================================
// Iniciar servidor
// ============================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   SERVIDOR TDRIVE AUTOMAÇÃO ATIVO      ║
║   Porta: ${PORT}                          ║
║   URL: http://localhost:${PORT}       ║
╚════════════════════════════════════════╝
  `);
});
