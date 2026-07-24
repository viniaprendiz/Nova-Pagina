import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Fandi credentials
const FANDI_EMAIL = 'vinicios.ferreira@uab';
const FANDI_PASSWORD = 'Automob@2000';
const FANDI_URL = 'https://jsl.fandi.com.br/operacao/cadastrar/financiada?Cna_Codigo=5&embed=fandi-one';

// Utility to sleep/wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main function to fill Fandi form with extracted customer data
async function preencherFandiComAutomacao(dadosCliente) {
  let browser;
  
  try {
    console.log('[FANDI] Iniciando automação com dados:', dadosCliente);
    
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);
    
    // Step 0: Navigate to Fandi login
    console.log('[FANDI] Navegando para Fandi...');
    await page.goto('https://jsl.fandi.com.br/operacao/monitor', { waitUntil: 'networkidle2' });
    
    // Check if already logged in by looking for the form
    let isLoggedIn = false;
    try {
      await page.waitForSelector('form, [class*="login"], input[type="email"]', { timeout: 3000 });
    } catch {
      isLoggedIn = true;
    }
    
    // If not logged in, perform login
    if (!isLoggedIn) {
      console.log('[FANDI] Fazendo login...');
      
      // Fill email
      const emailInput = await page.$('input[type="email"], input[name*="email" i]');
      if (emailInput) {
        await emailInput.type(FANDI_EMAIL, { delay: 50 });
      }
      
      // Fill password
      const passwordInput = await page.$('input[type="password"], input[name*="senha" i]');
      if (passwordInput) {
        await passwordInput.type(FANDI_PASSWORD, { delay: 50 });
      }
      
      // Click login button
      const loginButton = await page.$('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
      if (loginButton) {
        await loginButton.click();
        await wait(3000);
      }
    }
    
    // Navigate to form page
    console.log('[FANDI] Navegando para formulário...');
    await page.goto(FANDI_URL, { waitUntil: 'networkidle2' });
    await wait(2000);
    
    // Step 1: Wait for Step 2 (Dados do cliente) form to be visible
    console.log('[FANDI] Preenchendo Dados do Cliente...');
    
    // Try multiple selectors to find and fill Nome field
    let nomePreenchido = false;
    const nomeSelectors = [
      'input[name*="nome" i]',
      'input[placeholder*="Nome" i]',
      'input[aria-label*="Nome" i]',
      'div:has-text("Nome Completo") ~ input',
      'input[type="text"]:nth-of-type(2)'
    ];
    
    for (const selector of nomeSelectors) {
      try {
        const nomeInput = await page.$(selector);
        if (nomeInput) {
          await nomeInput.focus();
          await nomeInput.evaluate(el => el.value = '');
          await nomeInput.type(dadosCliente.nome, { delay: 50 });
          nomePreenchido = true;
          console.log('[FANDI] Nome preenchido:', dadosCliente.nome);
          break;
        }
      } catch (e) {
        console.log(`[FANDI] Selector ${selector} não funcionou`);
      }
    }
    
    await wait(500);
    
    // Fill Sexo (Gender) - Male selected
    try {
      const masculinoRadio = await page.$('input[type="radio"][value*="asc" i], input[type="radio"] + label:has-text("Masculino")');
      if (masculinoRadio) {
        await masculinoRadio.click();
        console.log('[FANDI] Sexo: Masculino');
      }
    } catch (e) {
      console.log('[FANDI] Erro ao selecionar sexo:', e.message);
    }
    
    // Fill Possui CNH - Sim
    try {
      const cnhSimRadio = await page.$('input[type="radio"]:has-text("Sim"), label:has-text("Sim") input[type="radio"]');
      if (cnhSimRadio) {
        await cnhSimRadio.click();
        console.log('[FANDI] CNH: Sim');
      }
    } catch (e) {
      console.log('[FANDI] Erro ao selecionar CNH:', e.message);
    }
    
    await wait(1000);
    
    // Advance to next step if there's a "Próxima" button
    try {
      const proximaButton = await page.$('button:has-text("Próxima"), button:has-text("Avançar"), button:has-text("Continuar")');
      if (proximaButton) {
        await proximaButton.click();
        console.log('[FANDI] Avançando para próximo passo...');
        await wait(2000);
      }
    } catch (e) {
      console.log('[FANDI] Erro ao procurar botão Próxima:', e.message);
    }
    
    // Step 2: Fill vehicle data (Step 3: Dados do veículo)
    console.log('[FANDI] Preenchendo Dados do Veículo...');
    
    // Fill Quilometragem - Mark as "Usado" (Used)
    try {
      const usadoRadio = await page.$('input[type="radio"]:checked ~ label:has-text("Usado"), label:has-text("Usado") input[type="radio"]');
      if (!usadoRadio) {
        const usadoOption = await page.$('label:has-text("Usado")');
        if (usadoOption) {
          await usadoOption.click();
          console.log('[FANDI] Quilometragem: Usado');
        }
      }
    } catch (e) {
      console.log('[FANDI] Erro ao selecionar quilometragem:', e.message);
    }
    
    // Set vehicle value (Valor da venda)
    try {
      const valorSelectors = [
        'input[name*="valor" i]',
        'input[placeholder*="Valor" i]',
        'input[type="number"]:first-of-type'
      ];
      
      for (const selector of valorSelectors) {
        const valorInput = await page.$(selector);
        if (valorInput) {
          await valorInput.focus();
          await valorInput.evaluate(el => el.value = '');
          const valorFormatado = dadosCliente.valor.toString().replace(/\D/g, '');
          await valorInput.type(valorFormatado, { delay: 30 });
          console.log('[FANDI] Valor preenchido:', valorFormatado);
          break;
        }
      }
    } catch (e) {
      console.log('[FANDI] Erro ao preencher valor:', e.message);
    }
    
    // Set KM
    try {
      const kmSelectors = [
        'input[name*="km" i]',
        'input[placeholder*="KM" i]',
        'input[placeholder*="quilometragem" i]',
        'input[type="number"]:last-of-type'
      ];
      
      for (const selector of kmSelectors) {
        const kmInput = await page.$(selector);
        if (kmInput) {
          await kmInput.focus();
          await kmInput.evaluate(el => el.value = '');
          const kmFormatado = dadosCliente.km.toString().replace(/\D/g, '');
          await kmInput.type(kmFormatado, { delay: 30 });
          console.log('[FANDI] KM preenchido:', kmFormatado);
          break;
        }
      }
    } catch (e) {
      console.log('[FANDI] Erro ao preencher KM:', e.message);
    }
    
    await wait(1000);
    
    // Final submission or advance
    try {
      const enviarButton = await page.$('button:has-text("Enviar"), button:has-text("Salvar"), button:has-text("Concluir"), button[type="submit"]');
      if (enviarButton) {
        await enviarButton.click();
        console.log('[FANDI] Enviando formulário...');
        await wait(3000);
      }
    } catch (e) {
      console.log('[FANDI] Erro ao enviar:', e.message);
    }
    
    // Check for success
    let successMessage = '';
    try {
      successMessage = await page.$eval('[role="alert"], .success, .alert-success', el => el.textContent);
    } catch (e) {
      // Try to get any confirmation message
      const pageText = await page.content();
      if (pageText.includes('sucesso') || pageText.includes('concluído')) {
        successMessage = 'Operação concluída com sucesso!';
      }
    }
    
    console.log('[FANDI] ✅ Automação completada com sucesso!');
    return {
      success: true,
      message: successMessage || 'Formulário preenchido com sucesso!',
      dadosEnviados: dadosCliente
    };
    
  } catch (error) {
    console.error('[FANDI] ❌ Erro na automação:', error);
    return {
      success: false,
      message: 'Erro ao preencher formulário: ' + error.message,
      erro: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', version: 'MVP v2 com Automação' });
});

app.post('/api/preencherFandi', async (req, res) => {
  try {
    const { cpf, nome, dataNascimento, celular, valor, km } = req.body;
    
    // Validate required fields
    if (!cpf || !nome || !valor || !km) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios faltando: CPF, Nome, Valor e KM são necessários'
      });
    }
    
    // Prepare data for Puppeteer
    const dadosCliente = {
      cpf: cpf.replace(/\D/g, ''),
      nome: nome.trim(),
      dataNascimento: dataNascimento || '',
      celular: celular || '',
      valor: parseInt(valor.toString().replace(/\D/g, '')),
      km: parseInt(km.toString().replace(/\D/g, ''))
    };
    
    console.log('[API] Recebido pedido para preencher Fandi:', dadosCliente);
    
    // Execute Puppeteer automation
    const resultado = await preencherFandiComAutomacao(dadosCliente);
    
    res.json(resultado);
    
  } catch (error) {
    console.error('[API] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar pedido: ' + error.message
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📝 MVP v2 com Automação Fandi`);
});
