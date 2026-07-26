// TDrive Pro v12.2 - Fandi + Postgres + Email + Demo + Diagnostico + Trava de acesso
// Correcao 26/07/2026: o Chrome do robo nao existia no servidor (ver .puppeteerrc.cjs)
const express = require('express');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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
await pool.query('ALTER TABLE fichas ADD COLUMN IF NOT EXISTS erro_tecnico TEXT');
await pool.query('ALTER TABLE fichas ADD COLUMN IF NOT EXISTS tentativas INT DEFAULT 0');
await pool.query('CREATE TABLE IF NOT EXISTS loja (id INT PRIMARY KEY, dados TEXT, atualizado_em TIMESTAMPTZ DEFAULT NOW())');
}

const agente = require('./agente');
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
// ---------- TRAVA DE ACESSO ----------
// Se a variavel TDRIVE_PIN existir no Render, a lista de fichas so responde com o PIN.
// Se nao existir, o sistema continua aberto (como antes) e avisa em vermelho na tela.
const PIN = process.env.TDRIVE_PIN || '';
function exigePin(req, res, next) {
if (!PIN) return next();
const enviado = req.get('x-tdrive-pin') || '';
if (enviado === PIN) return next();
return res.status(401).json({ success: false, semPermissao: true, message: 'Acesso protegido. Informe o PIN.' });
}

// ---------- NAVEGADOR ----------
function caminhoChrome() {
if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
try { return puppeteer.executablePath(); } catch (e) { return null; }
}

async function abrirNavegador() {
const opcoes = {
headless: 'new',
args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--disable-extensions','--disable-background-networking'],
timeout: 60000
};
const caminho = caminhoChrome();
if (caminho && fs.existsSync(caminho)) opcoes.executablePath = caminho;
return puppeteer.launch(opcoes);
}

// ---------- MENSAGEM DE ERRO EM PORTUGUES ----------
function erroAmigavel(msg) {
const m = String(msg || '');
  if (/CAMPO_CPF_NAO_APARECEU/.test(m))
    return 'A tela de cadastro do Fandi nao abriu para o robo (provavelmente pediu login ou mudou de endereco). A ficha esta salva aqui: use Copiar dados e Abrir Fandi. O detalhe do que o robo viu esta no diagnostico.';
  if (/LOGIN_NECESSARIO/.test(m))
    return 'O Fandi pediu login e o robo do servidor nao tem acesso a sua conta. A ficha esta salva aqui: clique em Copiar dados e Abrir Fandi para subir em 30 segundos.';
if (/no executable was found|Could not find Chrome|Browser was not found/i.test(m))
return 'O navegador automatico nao esta instalado no servidor. A ficha foi salva aqui, mas nao subiu no Fandi. Suba manualmente por enquanto.';
if (/Navigation timeout|TimeoutError|timeout of|waiting for/i.test(m))
return 'O Fandi demorou demais para responder. Clique em Tentar de novo daqui a alguns minutos.';
if (/net::|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(m))
return 'Nao consegui alcancar o site do Fandi agora. Pode ser instabilidade da rede.';
if (/Botao submit|selector/i.test(m))
return 'A tela de cadastro do Fandi mudou de lugar. O robo precisa ser reajustado.';
if (/Target closed|Protocol error|out of memory|Killed/i.test(m))
return 'O servidor ficou sem memoria no meio do envio. Tente de novo; se repetir, o plano gratuito nao aguenta o robo.';
return 'Falha ao enviar a ficha ao Fandi. Detalhe tecnico guardado no diagnostico.';
}

async function processarFicha(fandi_id, dados) {
      const MAX_TENTATIVAS = 2;
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            let browser;
            try {
                  browser = await abrirNavegador();
                  const page = await browser.newPage();
                  page.setDefaultNavigationTimeout(60000);
                  page.setDefaultTimeout(60000);

            await page.goto('https://jsl.fandi.com.br/operacao/novo', { waitUntil: 'networkidle2', timeout: 60000 });
                  // 26/07/2026 - CAUSA RAIZ DO BUG DA FICHA (Joelma):
            // o Fandi exige LOGIN do vendedor. O robo do servidor nao tem (e nao deve ter)
            // a senha guardada, entao ele caia na tela de login e ficava esperando 60s por
            // um campo que nunca aparece. Agora detecta e avisa na hora, em portugues.
            const precisaLogin = await page.evaluate(function () {
              return !!document.querySelector('input[type="password"]') ||
                /login|entrar|autentica/i.test(location.pathname + location.search);
            });
            if (precisaLogin) throw new Error('LOGIN_NECESSARIO: o Fandi pediu login e o robo nao tem acesso a conta.');

      try {
              await page.waitForSelector('input[name="cpf"]', { timeout: 30000 });
            } catch (eCampo) {
              // 26/07/2026: se o campo nao aparece, guarda O QUE O ROBO VIU (endereco, titulo,
              // nomes dos campos, se tem campo de senha). Assim ninguem fica no escuro depois.
              const oQueVi = await page.evaluate(function () {
                const nomes = Array.prototype.slice.call(document.querySelectorAll('input,select'))
                  .map(function (c) { return c.getAttribute('name') || c.getAttribute('id') || c.type || '?'; })
                  .slice(0, 25);
                return { titulo: document.title, endereco: location.href, temCampoSenha: !!document.querySelector('input[type="password"]'), campos: nomes };
              }).catch(function () { return null; });
              throw new Error('CAMPO_CPF_NAO_APARECEU. O robo viu: ' + JSON.stringify(oQueVi));
            }

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
                        await pool.query('UPDATE fichas SET status=\'erro\', erro=$1, erro_tecnico=$2 WHERE fandi_id=$3', [erroAmigavel(err.message), err.message, fandi_id]);
                  } else {
                        await new Promise(function (r) { setTimeout(r, 3000); });
                  }
            }
      }
}
app.get('/api/fichas', exigePin, async function (req, res) {
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

app.get('/api/status/:fandi_id', exigePin, async function (req, res) {
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
res.json({ destinatarios: EMAIL_DESTINATARIOS, versao: '12.2', protegido: !!PIN });
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

// ---------- DIAGNOSTICO ----------
app.get('/api/diagnostico', exigePin, async function (req, res) {
const info = { versao: '12.2', protegido: !!PIN, chrome: {}, banco: {}, erros: [] };
try {
const c = caminhoChrome();
info.chrome.caminho = c;
info.chrome.existe = !!(c && fs.existsSync(c));
} catch (e) { info.chrome.existe = false; info.chrome.detalhe = e.message; }
try {
const r = await pool.query('SELECT status, COUNT(*)::int AS total FROM fichas GROUP BY status');
info.banco.porStatus = {};
r.rows.forEach(function (x) { info.banco.porStatus[x.status] = x.total; });
const e = await pool.query("SELECT fandi_id, name, erro, erro_tecnico, criado_em FROM fichas WHERE status='erro' ORDER BY criado_em DESC LIMIT 10");
info.erros = e.rows;
info.banco.ok = true;
} catch (err) { info.banco.ok = false; info.banco.detalhe = err.message; }
res.json({ success: true, diagnostico: info });
});

// ---------- TENTAR DE NOVO ----------
app.post('/api/retry/:fandi_id', exigePin, async function (req, res) {
try {
const r = await pool.query('SELECT * FROM fichas WHERE fandi_id=$1', [req.params.fandi_id]);
if (!r.rows.length) return res.json({ success: false, message: 'Ficha nao encontrada' });
const f = r.rows[0];
if (f.status === 'demo') return res.json({ success: false, message: 'Ficha de demonstracao nao vai ao Fandi.' });
await pool.query("UPDATE fichas SET status='enviando', erro=NULL, erro_tecnico=NULL, tentativas=COALESCE(tentativas,0)+1 WHERE fandi_id=$1", [f.fandi_id]);
res.json({ success: true, message: 'Tentando de novo...' });
processarFicha(f.fandi_id, {
cpf: f.cpf, name: f.name, mother: f.mother, phone: f.phone,
salary: f.salary, cep: f.cep, address: f.address, neighborhood: f.neighborhood
});
} catch (err) {
res.json({ success: false, message: err.message });
}
});

// ---------- AGENTE DE VOZ: SO INTERPRETA, NUNCA ENVIA ----------
// Recebe o texto ditado em /voz.html e devolve os 8 campos separados.
// Nao grava nada no banco e nao fala com o Fandi. O envio continua
// dependendo de um clique humano na tela de ficha.
app.post('/api/agente', async function (req, res) {
  try {
    const texto = (req.body && req.body.texto) || '';
    const resultado = await agente.interpretar(texto);
    return res.json(resultado);
  } catch (e) {
    return res.json({ success: false, message: 'Erro no agente: ' + e.message });
  }
});

// ---------- VITRINE / ESTOQUE DA LOJA (v12.0) ----------
// Leitura PUBLICA: o cliente abre o link da vitrine e ve os carros.
// Gravacao passa pelo exigePin: quando a variavel TDRIVE_PIN existir no Render,
// so quem tem o PIN consegue mexer no estoque.
// Aqui NAO entra dado de cliente: so carro, preco e o contato da loja.
var lojaMemoria = null;

app.get('/api/loja', async function (req, res) {
  try {
    var r = await pool.query('SELECT dados, atualizado_em FROM loja WHERE id = 1');
    if (r.rows.length) {
      return res.json({ success: true, fonte: 'banco', atualizado_em: r.rows[0].atualizado_em, dados: JSON.parse(r.rows[0].dados) });
    }
    return res.json({ success: true, fonte: 'vazio', dados: lojaMemoria });
  } catch (e) {
    return res.json({ success: true, fonte: 'memoria', aviso: e.message, dados: lojaMemoria });
  }
});

app.post('/api/loja', exigePin, async function (req, res) {
  var dados = req.body && req.body.dados;
  if (!dados || typeof dados !== 'object') {
    return res.status(400).json({ success: false, message: 'Nada para salvar.' });
  }
  var texto = JSON.stringify(dados);
  if (texto.length > 400000) {
    return res.status(413).json({ success: false, message: 'Estoque muito grande. Tire fotos gigantes ou carros antigos.' });
  }
  lojaMemoria = dados;
  try {
    await pool.query('INSERT INTO loja (id, dados, atualizado_em) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET dados = $1, atualizado_em = NOW()', [texto]);
    return res.json({ success: true, salvo: 'banco' });
  } catch (e) {
    return res.json({ success: true, salvo: 'memoria', aviso: 'Salvei so na memoria do servidor (o banco recusou): ' + e.message });
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
