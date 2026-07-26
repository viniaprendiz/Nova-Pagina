// TDrive Pro v9.0 - Fandi + Status (Postgres) + Email + Validacao + Anti-duplicidade + Modo Demonstracao
const express = require('express');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDb() {
      await pool.query(
            'CREATE TABLE IF NOT EXISTS fichas (' +
            'fandi_id TEXT PRIMARY KEY,' +
            'cpf TEXT,' +
            'name TEXT,' +
            'mother TEXT,' +
            'phone TEXT,' +
            'salary TEXT,' +
            'cep TEXT,' +
            'address TEXT,' +
            'neighborhood TEXT,' +
            'status TEXT,' +
            'fandi_url TEXT,' +
            'erro TEXT,' +
            'criado_em TIMESTAMPTZ DEFAULT NOW()' +
            ')'
            );
}

app.use(express.json());
app.use(express.static('public', { index: false }));

const EMAIL_DESTINATARIOS = [
      'marcelo.sinhorine@tdrive.com.br',
      'douglas.pinto@tdrive.com.br',
      'eli.psilva@tdrive.com.br',
      'feitoyota@automob.com.br'
      ];

function limparCpf(cpf) {
      return String(cpf || '').replace(/\D/g, '');
}
app.post('/api/submit-fandi', async (req, res) => {
      const dados = req.body;
      const cpfLimpo = limparCpf(dados.cpf);

         if (!dados.cpf || !dados.name) {
               return res.json({ success: false, message: 'CPF ou Nome faltando' });
         }
      if (cpfLimpo.length !== 11) {
            return res.json({ success: false, message: 'CPF invalido: precisa ter 11 digitos (recebido: ' + cpfLimpo.length + ')' });
      }

         try {
               const dup = await pool.query(
                     "SELECT fandi_id, status, criado_em FROM fichas WHERE cpf=$1 AND status IN ('enviando','enviada') AND criado_em > NOW() - INTERVAL '10 minutes' ORDER BY criado_em DESC LIMIT 1",
                     [dados.cpf]
                     );
               if (dup.rows.length) {
                     const existente = dup.rows[0];
                     return res.json({
                           success: false,
                           message: 'Ja existe uma ficha para este CPF enviada ha pouco (status: ' + existente.status + ', ID: ' + existente.fandi_id + '). Aguarde antes de reenviar para evitar duplicidade no Fandi.'
                     });
               }
         } catch (err) {
               console.error('[DB ERRO ao checar duplicidade]', err.message);
         }

         const fandi_id = 'PROP-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      try {
            await pool.query(
                  'INSERT INTO fichas (fandi_id, cpf, name, mother, phone, salary, cep, address, neighborhood, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,\'enviando\')',
                  [fandi_id, dados.cpf, dados.name, dados.mother, dados.phone, String(dados.salary || ''), dados.cep, dados.address, dados.neighborhood]
                  );
            res.json({ success: true, fandi_id: fandi_id, message: 'Ficha recebida, enviando ao Fandi...' });
            processarFicha(fandi_id, dados);
      } catch (err) {
            console.error('[DB ERRO ao salvar ficha]', err.message);
            res.json({ success: false, message: 'Erro ao salvar ficha: ' + err.message });
      }
});
async function processarFicha(fandi_id, dados) {
      const MAX_TENTATIVAS = 2;
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            let browser;
            try {
                  browser = await puppeteer.launch({
                        headless: 'new',
                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                        timeout: 60000
                  });
                  const page = await browser.newPage();
                  page.setDefaultNavigationTimeout(60000);
                  page.setDefaultTimeout(60000);

            await page.goto('https://jsl.fandi.com.br/operacao/novo', { waitUntil: 'networkidle2', timeout: 60000 });
                  await page.waitForSelector('input[name="cpf"]', { timeout: 30000 });

            await page.type('input[name="cpf"]', dados.cpf || '', { delay: 80 });
                  await page.type('input[name="name"]', dados.name || '', { delay: 80 });
                  await page.type('input[name="mother_name"]', dados.mother || '', { delay: 80 });
                  await page.type('input[name="phone"]', dados.phone || '', { delay: 80 });
                  await page.type('input[name="salary"]', String(dados.salary || ''), { delay: 80 });
                  await page.type('input[name="cep"]', dados.cep || '', { delay: 80 });
                  await page.type('input[name="address"]', dados.address || '', { delay: 80 });
                  await page.type('input[name="neighborhood"]', dados.neighborhood || '', { delay: 80 });

            const submitBtn = await page.$('button[type="submit"]');
                  if (!submitBtn) throw new Error('Botao submit nao encontrado');

            await Promise.all([
                  submitBtn.click(),
                  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(function(){})
                  ]);

            const urlFinal = page.url();
                  await pool.query('UPDATE fichas SET status=\'enviada\', fandi_url=$1 WHERE fandi_id=$2', [urlFinal, fandi_id]);
                  console.log('[PUPPETEER] Ficha enviada:', fandi_id, urlFinal);
                  await browser.close();
                  return;
            } catch (err) {
                  console.error('[ERRO] tentativa ' + tentativa + ' - ' + fandi_id + ': ' + err.message);
                  if (browser) { try { await browser.close(); } catch (e) {} }
                  if (tentativa === MAX_TENTATIVAS) {
                        await pool.query('UPDATE fichas SET status=\'erro\', erro=$1 WHERE fandi_id=$2', [err.message, fandi_id]);
                  } else {
                        await new Promise(function (r) { setTimeout(r, 3000); });
                  }
            }
      }
}
app.get('/api/fichas', async function (req, res) {
      try {
            const result = await pool.query('SELECT * FROM fichas ORDER BY criado_em DESC LIMIT 200');
            const lista = result.rows.map(function (r) {
                  return {
                        fandi_id: r.fandi_id, cpf: r.cpf, name: r.name, mother: r.mother, phone: r.phone,
                        salary: r.salary, cep: r.cep, address: r.address, neighborhood: r.neighborhood,
                        status: r.status, fandiUrl: r.fandi_url, erro: r.erro, criadoEm: r.criado_em
                  };
            });
            res.json({ success: true, total: lista.length, fichas: lista });
      } catch (err) {
            res.json({ success: false, message: err.message, fichas: [] });
      }
});

app.get('/api/status/:fandi_id', async function (req, res) {
      try {
            const result = await pool.query('SELECT * FROM fichas WHERE fandi_id=$1', [req.params.fandi_id]);
            if (!result.rows.length) return res.json({ success: false, message: 'Nao encontrada' });
            const r = result.rows[0];
            res.json({
                  success: true, ficha: {
                        fandi_id: r.fandi_id, cpf: r.cpf, name: r.name, status: r.status,
                        fandiUrl: r.fandi_url, erro: r.erro, criadoEm: r.criado_em
                  }
            });
      } catch (err) {
            res.json({ success: false, message: err.message });
      }
});

app.get('/api/config', function (req, res) {
res.json({ destinatarios: EMAIL_DESTINATARIOS, versao: '9.0' });
});

// Modo demonstracao: cria uma ficha FICTICIA. Nao abre o Fandi, nao envia nada.
app.post('/api/submit-demo', async function (req, res) {
const fandi_id = 'DEMO-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
const nome = 'Cliente Demonstracao';
const cpf = '000.000.000-00';
const url = '/demo-fandi.html?id=' + encodeURIComponent(fandi_id) + '&nome=' + encodeURIComponent(nome) + '&cpf=' + encodeURIComponent(cpf);
try {
await pool.query(
'INSERT INTO fichas (fandi_id, cpf, name, mother, phone, salary, cep, address, neighborhood, status, fandi_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
[fandi_id, cpf, nome, 'Mae Demonstracao', '(00) 00000-0000', '0', '00000-000', 'Rua Exemplo, 100', 'Centro', 'demo', url]
);
res.json({ success: true, fandi_id: fandi_id, fandiUrl: url, message: 'Ficha de demonstracao criada. Nada foi enviado ao Fandi.' });
} catch (err) {
console.error('[DEMO ERRO]', err.message);
res.json({ success: false, message: 'Erro ao criar demonstracao: ' + err.message });
}
});

app.get('/', function (req, res) {
res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

initDb().then(function () {
      app.listen(PORT, function () {
            console.log('TDrive Pro rodando na porta ' + PORT);
      });
}).catch(function (err) {
      console.error('[DB INIT ERRO]', err.message);
      app.listen(PORT, function () {
            console.log('TDrive Pro rodando na porta ' + PORT + ' (SEM DB - erro na inicializacao)');
      });
});
