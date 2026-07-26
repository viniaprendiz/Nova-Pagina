// TDrive Pro v14.0 - Fandi + Postgres + Email + Demo + Diagnostico + Trava de acesso
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
await pool.query(
'CREATE TABLE IF NOT EXISTS leads (' +
'id TEXT PRIMARY KEY,' +
'carro_id TEXT,' +
'modelo TEXT,' +
'preco NUMERIC,' +
'nome TEXT,' +
'telefone TEXT,' +
'entrada NUMERIC,' +
'parcelas INT,' +
'parcela_estimada NUMERIC,' +
'mensagem TEXT,' +
'origem TEXT,' +
'visto BOOLEAN DEFAULT FALSE,' +
'criado_em TIMESTAMPTZ DEFAULT NOW()' +
')'
);
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
// ---------- TRAVA DE ACESSO (v13.2 - agora FECHA quando falta o PIN) ----------
// ATE 26/07/2026 a trava era "aberta por padrao": sem TDRIVE_PIN o /api/fichas
// respondia para qualquer pessoa da internet - e la tem dado de cliente real.
// Um erro de configuracao virava vazamento silencioso.
// AGORA e o contrario: sem PIN configurado, as rotas com dado de cliente NEGAM
// acesso e explicam o que fazer. Erro de configuracao vira erro visivel, nunca vazamento.
const PIN = (process.env.TDRIVE_PIN || '').trim();
// Ajuda a achar variavel criada com nome errado ou no servico errado do Render.
// Mostra so os NOMES parecidos, NUNCA o valor.
const NOMES_PARECIDOS = Object.keys(process.env).filter(function (k) { return /pin|tdrive/i.test(k); });
if (!PIN) {
  console.warn('[SEGURANCA] TDRIVE_PIN nao chegou no servidor. Rotas com dado de cliente estao BLOQUEADAS. Nomes parecidos vistos: ' + JSON.stringify(NOMES_PARECIDOS));
}
function exigePin(req, res, next) {
  if (!PIN) {
    return res.status(503).json({
      success: false,
      semPermissao: true,
      pinAusente: true,
      message: 'Esta rota tem dado de cliente e esta BLOQUEADA porque a variavel TDRIVE_PIN nao chegou no servidor. Confira no Render: servico web Nova-Pagina (nao o banco) > Environment > TDRIVE_PIN > Save changes (o servico reinicia sozinho).',
      variaveisParecidas: NOMES_PARECIDOS
    });
  }
  const enviado = (req.get('x-tdrive-pin') || '').trim();
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
res.json({ destinatarios: EMAIL_DESTINATARIOS, versao: '14.0', protegido: !!PIN, pinAusente: !PIN, variaveisParecidas: NOMES_PARECIDOS });
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
const info = { versao: '14.0', protegido: !!PIN, chrome: {}, banco: {}, erros: [] };
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

// ---------- ESTOQUE OFICIAL T-DRIVE (v13.0) ----------
// Le o site publico da propria rede (www.tdrive.com.br, robots.txt permite) e monta a vitrine.
// Roda SO quando alguem clica no botao - nao fica batendo no site sozinho.
// Aqui NAO entra dado de cliente: so modelo, ano, km, preco, foto e unidade.
var importacao = { rodando: false, feitos: 0, total: 0, encontrados: 0, unidade: '', fim: null, erro: null };
var CABECALHO_ROBO = { 'User-Agent': 'TDrivePro/1.0 (vitrine interna T-Drive Aricanduva)' };

function lerCarroDoHtml(html, url) {
  var mt = html.match(/<title>([^<]*)<\/title>/);
  if (!mt) return null;
  var m = mt[1].match(/^(.+?)\s+(\d{4})\s+por\s+R\$\s*([\d.,]+).*?(T-Drive.*?)\s*$/);
  if (!m) return null;
  var foto = (html.match(/https:\/\/production\.autoforce\.com\/uploads\/used_model\/profile_image\/[^"'\s]+/) || [''])[0];
  var mkm = html.match(/([\d.]+)\s?Km/i);
  var unidade = m[4].trim();
  return {
    id: url.split('/').pop(),
    modelo: m[1].trim(),
    ano: m[2],
    km: mkm ? (Number(mkm[1].replace(/\D/g, '')) || 0) : 0,
    preco: Number(m[3].replace(/\./g, '').replace(',', '.')) || 0,
    cor: '',
    foto: foto,
    obs: unidade,
    status: 'disponivel',
    origem: 'tdrive',
    unidade: unidade,
    link: url
  };
}

async function importarEstoque(unidade) {
  importacao = { rodando: true, feitos: 0, total: 0, encontrados: 0, unidade: unidade, fim: null, erro: null };
  try {
    if (typeof fetch !== 'function') throw new Error('Este Node nao tem fetch (precisa Node 18 ou mais novo).');
    var rs = await fetch('https://www.tdrive.com.br/sitemap.xml', { headers: CABECALHO_ROBO });
    var xml = await rs.text();
    var urls = (xml.match(/<loc>[^<]+<\/loc>/g) || [])
      .map(function (s) { return s.replace(/<\/?loc>/g, ''); })
      .filter(function (u) { return /\/seminovos\/.+/.test(u); });
    importacao.total = urls.length;
    var achados = [];
    for (var i = 0; i < urls.length; i += 4) {
      var lote = urls.slice(i, i + 4);
      var res = await Promise.all(lote.map(async function (u) {
        try {
          var r = await fetch(u, { headers: CABECALHO_ROBO });
          var h = await r.text();
          return lerCarroDoHtml(h, u);
        } catch (e) { return null; }
      }));
      res.forEach(function (c) {
        if (c && (!unidade || c.unidade.toLowerCase().indexOf(unidade.toLowerCase()) > -1)) achados.push(c);
      });
      importacao.feitos += lote.length;
      importacao.encontrados = achados.length;
      await new Promise(function (r) { setTimeout(r, 300); });
    }
    var manuais = [];
    var config = null;
    try {
      var atual = await pool.query('SELECT dados FROM loja WHERE id = 1');
      if (atual.rows.length) {
        var d = JSON.parse(atual.rows[0].dados);
        config = d.config || null;
        manuais = (d.carros || []).filter(function (c) { return c.origem !== 'tdrive'; });
      }
    } catch (e) { console.error('[LOJA] nao li o estoque anterior: ' + e.message); }
    var dados = { carros: manuais.concat(achados), config: config };
    lojaMemoria = dados;
    await pool.query('INSERT INTO loja (id, dados, atualizado_em) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET dados = $1, atualizado_em = NOW()', [JSON.stringify(dados)]);
    importacao.fim = new Date().toISOString();
  } catch (e) {
    importacao.erro = e.message;
    importacao.fim = new Date().toISOString();
  }
  importacao.rodando = false;
}

app.post('/api/loja/importar', exigePin, function (req, res) {
  if (importacao.rodando) return res.json({ success: false, message: 'Ja estou importando. Aguarde terminar.' });
  var unidade = (req.body && req.body.unidade) || 'Aricanduva';
  importarEstoque(unidade);
  res.json({ success: true, message: 'Importando o estoque da unidade ' + unidade + '. Leva de 1 a 3 minutos.' });
});

app.get('/api/loja/importacao', function (req, res) {
  res.json({ success: true, importacao: importacao });
});

// ---------- PAGINA DO CARRO + CAPTURA DE LEAD (v14.0) ----------
// Objetivo direto: o vendedor manda UM link no WhatsApp, o cliente ve o carro
// com foto, preco e parcela estimada, mexe na entrada e deixa o contato.
// O lead cai no banco e aparece em /leads.html (protegido pelo PIN).
// Esta pagina e do CLIENTE FINAL: nao tem login e nao mostra dado de ninguem.
// A pagina e montada no servidor por causa das tags og: sem isso o link colado
// no WhatsApp aparece sem foto e sem preco, e conversa muito menos.

var CSS_CARRO = ":root{--card:#121c30;--card2:#18243d;--line:#243352;--tx:#e8eefc;--tx2:#93a4c4;--ac:#3b82f6;--grn:#22c55e;--yel:#f59e0b}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#0b1220,#0e1626 340px);color:var(--tx);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.wrap{max-width:620px;margin:0 auto;padding:16px 14px 40px}.loja{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--tx2);margin-bottom:10px}.foto{width:100%;aspect-ratio:16/10;border-radius:16px;overflow:hidden;background:var(--card2);display:flex;align-items:center;justify-content:center;color:var(--tx2);font-size:13px}.foto img{width:100%;height:100%;object-fit:cover;display:block}h1{font-size:22px;margin:16px 0 4px;line-height:1.25}.esp{color:var(--tx2);font-size:14px;margin:0 0 10px}.preco{font-size:28px;font-weight:900;color:var(--grn);margin:0 0 4px}.apartir{color:var(--tx2);font-size:14px;margin:0 0 18px}.apartir b{color:var(--tx);font-size:17px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);margin:0 0 12px}label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--tx2);margin:14px 0 6px}label:first-of-type{margin-top:0}input,select{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card2);color:var(--tx);font-size:16px;font-family:inherit}input[type=range]{padding:0;background:transparent;border:0;accent-color:var(--ac)}.parc{font-size:24px;font-weight:900;color:var(--tx);margin:14px 0 0}.bt{display:block;width:100%;text-align:center;padding:15px;border-radius:12px;border:0;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer;margin-top:12px;text-decoration:none}.bt.pri{background:var(--ac);color:#fff}.bt.zap{background:#128c7e;color:#fff}.ok{background:rgba(34,197,94,.12);border-left:3px solid var(--grn);padding:12px;border-radius:8px;font-size:14px;line-height:1.55;margin-top:12px}.er{background:rgba(239,68,68,.12);border-left:3px solid #ef4444;padding:12px;border-radius:8px;font-size:14px;margin-top:12px}.aviso{font-size:12px;color:var(--tx2);line-height:1.6;background:var(--card2);border:1px solid var(--line);border-left:3px solid var(--yel);border-radius:10px;padding:12px;margin-top:16px}.volta{display:inline-block;margin-top:18px;color:var(--tx2);font-size:14px}";
var TAXA_ESTIMADA = Number(process.env.TAXA_MENSAL || 1.99);

function esc(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function brl(n) {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
async function lerLoja() {
  try {
    var r = await pool.query('SELECT dados FROM loja WHERE id = 1');
    if (r.rows.length) return JSON.parse(r.rows[0].dados) || {};
  } catch (e) { console.error('[LOJA] leitura: ' + e.message); }
  return lojaMemoria || {};
}
function acharNaVitrine(lista, id) {
  for (var i = 0; i < lista.length; i++) { if (String(lista[i].id) === String(id)) return lista[i]; }
  return null;
}

function paginaCarro(c, config, url) {
  var titulo = c.modelo + (c.ano ? ' ' + c.ano : '');
  var preco = Number(c.preco) || 0;
  var km = Number(c.km) || 0;
  var loja = (config && config.titulo) || 'T-Drive Auto Shopping Aricanduva';
  var whats = String((config && config.whats) || '').replace(/[^0-9]/g, '');
  var resumo = [c.ano || '', km ? km.toLocaleString('pt-BR') + ' km' : '', preco ? brl(preco) : ''].filter(Boolean).join(' | ');
  var msgZap = 'Oi! Vi o ' + titulo + ' na vitrine e queria saber mais. ' + url;
  var h = [];
  h.push('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">');
  h.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  h.push('<title>' + esc(titulo) + ' - ' + esc(loja) + '</title>');
  h.push('<meta name="description" content="' + esc(resumo) + '">');
  h.push('<meta property="og:type" content="website">');
  h.push('<meta property="og:site_name" content="' + esc(loja) + '">');
  h.push('<meta property="og:title" content="' + esc(titulo) + '">');
  h.push('<meta property="og:description" content="' + esc(resumo) + '">');
  h.push('<meta property="og:url" content="' + esc(url) + '">');
  if (c.foto) h.push('<meta property="og:image" content="' + esc(c.foto) + '">');
  h.push('<meta name="twitter:card" content="summary_large_image">');
  h.push('<style>' + CSS_CARRO + '</style></head><body><div class="wrap">');
  h.push('<div class="loja">' + esc(loja) + '</div>');
  h.push('<div class="foto">' + (c.foto ? '<img src="' + esc(c.foto) + '" alt="' + esc(titulo) + '">' : 'sem foto') + '</div>');
  h.push('<h1>' + esc(titulo) + '</h1>');
  h.push('<p class="esp">' + esc(resumo.replace(/ \| /g, ' - ')) + '</p>');
  if (preco) h.push('<p class="preco">' + brl(preco) + '</p>');
  h.push('<p class="apartir">ou a partir de <b id="resumoParc">-</b> por mes</p>');
  h.push('<div class="card"><h2>Simule sua parcela</h2>');
  h.push('<label>Entrada: <b id="lblEnt" style="color:#e8eefc">-</b></label>');
  h.push('<input type="range" id="ent" min="0" max="80" step="5" value="20">');
  h.push('<label>Em quantas vezes</label>');
  h.push('<select id="prazo"><option>24</option><option>36</option><option selected>48</option><option>60</option></select>');
  h.push('<p class="parc" id="parc">-</p>');
  h.push('</div>');
  h.push('<div class="card" id="boxForm"><h2>Quero esse carro</h2>');
  h.push('<label>Seu nome</label><input id="nome" autocomplete="name" placeholder="Como voce se chama">');
  h.push('<label>Seu WhatsApp com DDD</label><input id="tel" inputmode="numeric" autocomplete="tel" placeholder="11 90000-0000">');
  h.push('<button class="bt pri" id="enviar">ENVIAR PRO VENDEDOR</button>');
  h.push('<div id="resp"></div>');
  h.push('<p class="aviso">Seus dados vao so para o vendedor desta loja, para ele te responder. Nao pedimos CPF nem documento nesta tela.</p>');
  h.push('</div>');
  if (whats) h.push('<a class="bt zap" target="_blank" rel="noopener" href="https://wa.me/55' + whats + '?text=' + encodeURIComponent(msgZap) + '">FALAR AGORA NO WHATSAPP</a>');
  h.push('<div class="aviso"><b>Importante:</b> a parcela mostrada e uma ESTIMATIVA feita com taxa de ' + String(TAXA_ESTIMADA).replace('.', ',') + '% ao mes (tabela Price), so para dar uma ideia. Nao e proposta, nao e aprovacao de credito e nao substitui a analise do banco. Preco, itens e disponibilidade precisam ser confirmados com o vendedor.</div>');
  h.push('<a class="volta" href="/loja.html?v=1">Ver os outros carros</a>');
  h.push('</div><script>');
  h.push('var PRECO=' + preco + ',TAXA=' + TAXA_ESTIMADA + ',ID=' + JSON.stringify(String(c.id)) + ',MODELO=' + JSON.stringify(String(titulo)) + ';');
  h.push('function d(i){return document.getElementById(i)}');
  h.push('function m(n){return "R$ "+(Number(n)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}');
  h.push('var ULT={ent:0,pra:48,par:0};');
  h.push('function calc(){var p=parseInt(d("ent").value,10),n=parseInt(d("prazo").value,10);var e=PRECO*p/100,f=PRECO-e,i=TAXA/100;var v=(f>0&&n>0)?f*i/(1-Math.pow(1+i,-n)):0;d("lblEnt").textContent=p+"% ("+m(e)+")";d("parc").textContent=n+"x de "+m(v);var r=d("resumoParc");if(r)r.textContent=n+"x de "+m(v);ULT={ent:e,pra:n,par:v};}');
  h.push('d("ent").addEventListener("input",calc);d("prazo").addEventListener("change",calc);calc();');
  h.push('d("enviar").onclick=function(){var nome=d("nome").value.trim();var tel=d("tel").value.replace(/[^0-9]/g,"");var r=d("resp");if(nome.length<2){r.innerHTML="<div class=\'er\'>Escreva seu nome, por favor.</div>";return}if(tel.length<10){r.innerHTML="<div class=\'er\'>Preciso do WhatsApp com DDD.</div>";return}this.disabled=true;this.textContent="ENVIANDO...";var b=this;fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({carro_id:ID,modelo:MODELO,preco:PRECO,nome:nome,telefone:tel,entrada:ULT.ent,parcelas:ULT.pra,parcela_estimada:ULT.par})}).then(function(x){return x.json()}).then(function(j){b.disabled=false;b.textContent="ENVIAR PRO VENDEDOR";if(j.success){d("boxForm").innerHTML="<h2>Pronto</h2><div class=\'ok\'>"+j.message+"</div>"}else{r.innerHTML="<div class=\'er\'>"+j.message+"</div>"}}).catch(function(){b.disabled=false;b.textContent="ENVIAR PRO VENDEDOR";r.innerHTML="<div class=\'er\'>Falhou o envio. Tente de novo ou chame no WhatsApp.</div>"})};');
  h.push('<\/script></body></html>');
  return h.join('');
}

app.get('/carro/:id', async function (req, res) {
  var d = await lerLoja();
  var carros = (d && d.carros) || [];
  var c = acharNaVitrine(carros, req.params.id);
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (!c) return res.status(404).send('<!DOCTYPE html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b1220;color:#e8eefc;padding:28px"><h1>Esse carro saiu da vitrine</h1><p><a style="color:#3b82f6" href="/loja.html?v=1">Ver os carros disponiveis</a></p>');
  var url = 'https://' + req.get('host') + '/carro/' + encodeURIComponent(c.id);
  res.send(paginaCarro(c, (d && d.config) || {}, url));
});

// Recebe o contato do cliente. Publico de proposito (e o cliente final que envia),
// com limite simples por IP para nao virar deposito de spam.
var ultimoLead = {};
app.post('/api/lead', async function (req, res) {
  var b = req.body || {};
  var nome = String(b.nome || '').trim().slice(0, 120);
  var telefone = String(b.telefone || '').replace(/[^0-9]/g, '').slice(0, 13);
  if (nome.length < 2) return res.json({ success: false, message: 'Escreva seu nome, por favor.' });
  if (telefone.length < 10) return res.json({ success: false, message: 'Preciso do WhatsApp com DDD.' });
  var ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sem-ip';
  var agora = Date.now();
  if (Object.keys(ultimoLead).length > 500) ultimoLead = {};
  if (ultimoLead[ip] && agora - ultimoLead[ip] < 20000) {
    return res.json({ success: false, message: 'Ja recebi seu contato. O vendedor fala com voce em instantes.' });
  }
  ultimoLead[ip] = agora;
  var id = 'LEAD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  try {
    await pool.query(
      'INSERT INTO leads (id, carro_id, modelo, preco, nome, telefone, entrada, parcelas, parcela_estimada, mensagem, origem) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id, String(b.carro_id || '').slice(0, 140), String(b.modelo || '').slice(0, 160), Number(b.preco) || 0, nome, telefone,
       Number(b.entrada) || 0, parseInt(b.parcelas, 10) || 0, Number(b.parcela_estimada) || 0, String(b.mensagem || '').slice(0, 400), 'vitrine']
    );
    console.log('[LEAD] ' + id + ' - ' + nome + ' - ' + String(b.modelo || ''));
    return res.json({ success: true, message: 'Recebido! O vendedor vai te chamar no WhatsApp.' });
  } catch (e) {
    console.error('[LEAD ERRO] ' + e.message);
    return res.json({ success: false, message: 'Nao consegui salvar agora. Chame direto no WhatsApp, por favor.' });
  }
});

// Leitura dos leads: tem dado de pessoa, entao passa pelo PIN.
app.get('/api/leads', exigePin, async function (req, res) {
  try {
    var r = await pool.query('SELECT * FROM leads ORDER BY criado_em DESC LIMIT 300');
    return res.json({ success: true, total: r.rows.length, leads: r.rows });
  } catch (e) {
    return res.json({ success: false, message: e.message, leads: [] });
  }
});

app.post('/api/leads/:id/visto', exigePin, async function (req, res) {
  try {
    await pool.query('UPDATE leads SET visto = NOT COALESCE(visto,false) WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: false, message: e.message });
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
