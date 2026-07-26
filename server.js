// TDrive Pro v6.2 - Fandi + Status (Postgres) + Email + Validacao + Anti-duplicidade
const express = require('express');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { Pool } = require('pg');

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

app.get('/', function (req, res) {
      res.send(renderPage());
});
function renderPage() {
      const destinatariosJson = JSON.stringify(EMAIL_DESTINATARIOS);
      return [
            '<!DOCTYPE html>',
            '<html lang="pt-BR"><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>TDrive Pro - Fandi</title>',
            '<style>',
            '* { margin:0; padding:0; box-sizing:border-box; font-family: system-ui, sans-serif; }',
            'body { background: linear-gradient(135deg,#667eea,#764ba2); min-height:100vh; padding:30px 15px; }',
            'main { background:#fff; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,.15); padding:30px; max-width:700px; margin:0 auto 30px; }',
            'h1 { text-align:center; color:#333; margin-bottom:20px; font-size:1.4em; }',
            'textarea { width:100%; height:140px; border:2px solid #ddd; border-radius:6px; padding:10px; margin-bottom:15px; font-size:14px; }',
            'button.principal { background:#667eea; color:#fff; border:none; border-radius:6px; padding:12px 24px; cursor:pointer; width:100%; font-size:15px; }',
            'button.principal:hover { background:#764ba2; }',
            '#resultado { margin-top:15px; padding:12px; border-radius:6px; display:none; font-size:14px; }',
            '#resultado.carregando { background:#fff3cd; color:#856404; display:block; }',
            '#resultado.sucesso { background:#d4edda; color:#155724; display:block; }',
            '#resultado.erro { background:#f8d7da; color:#721c24; display:block; }',
            '.lista { max-width:700px; margin:0 auto; }',
            '.vazio { text-align:center; color:#eee; font-size:14px; padding:20px; }',
            '.ficha { background:#fff; border-radius:8px; padding:15px 18px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,.08); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }',
            '.ficha .info { flex:1; min-width:200px; }',
            '.ficha .info strong { display:block; font-size:15px; color:#333; }',
            '.ficha .info span { font-size:13px; color:#777; }',
            '.badge { padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; }',
            '.badge.enviando { background:#fff3cd; color:#856404; }',
            '.badge.enviada { background:#d4edda; color:#155724; }',
            '.badge.erro { background:#f8d7da; color:#721c24; }',
            '.acoes a { font-size:13px; padding:6px 10px; border-radius:5px; border:1px solid #667eea; background:#fff; color:#667eea; text-decoration:none; margin-left:6px; }',
            '.acoes a.desabilitado { opacity:.4; pointer-events:none; }',
            '.abas { max-width:700px; margin:0 auto 15px; display:flex; gap:8px; }',
            '.abas a { flex:1; text-align:center; padding:10px; border-radius:8px 8px 0 0; background:rgba(255,255,255,.25); color:#fff; text-decoration:none; font-size:14px; font-weight:600; }',
            '.abas a.ativa { background:#fff; color:#5a3d9a; }',
            '</style></head><body>',
            '<div class="abas"><a href="/" class="ativa">Enviar Ficha</a><a href="/simulador.html">Simulador</a></div>',
            '<main>',
            '<h1>TDrive Pro - Envio de Ficha ao Fandi</h1>',
            '<textarea id="dados" placeholder="Cole os dados do cliente aqui (CPF, Nome, Mae, Telefone, Salario, CEP, Endereco, Bairro)..."></textarea>',
            '<button class="principal" onclick="enviar()">ENVIAR PARA FANDI</button>',
            '<div id="resultado"></div>',
            '</main>',
            '<div class="lista" id="lista"></div>',
            '<script>',
            'var DESTINATARIOS = ' + destinatariosJson + ';',
            'function extrair(texto) {',
            ' function pega(regex) { var m = texto.match(regex); return m ? m[1].trim() : ""; }',
            ' return {',
            ' cpf: pega(/cpf\\s*:\\s*([\\d.\\-]+)/i),',
            ' name: pega(/nome\\s*:\\s*([^\\n]+)/i),',
            ' mother: pega(/m[ãa]e\\s*:\\s*([^\\n]+)/i),',
            ' phone: pega(/telefone\\s*:\\s*([^\\n]+)/i),',
            ' salary: pega(/sal[áa]rio\\s*:\\s*([^\\n]+)/i),',
            ' cep: pega(/cep\\s*:\\s*([^\\n]+)/i),',
            ' address: pega(/endere[çc]o\\s*:\\s*([^\\n]+)/i),',
            ' neighborhood: pega(/bairro\\s*:\\s*([^\\n]+)/i)',
            ' };',
            '}',
            'function validar(dados) {',
            ' var faltando = [];',
            ' var cpfDigitos = (dados.cpf||"").replace(/\\D/g,"");',
            ' if (!dados.name) faltando.push("Nome");',
            ' if (!dados.cpf) { faltando.push("CPF"); }',
            ' else if (cpfDigitos.length !== 11) { faltando.push("CPF valido (encontrado " + cpfDigitos.length + " digitos)"); }',
            ' return faltando;',
            '}',
            'function enviar() {',
            ' var texto = document.getElementById("dados").value;',
            ' var dados = extrair(texto);',
            ' var res = document.getElementById("resultado");',
            ' var faltando = validar(dados);',
            ' if (faltando.length) {',
            ' res.className = "erro";',
            ' res.textContent = "Confira os dados colados. Faltando ou invalido: " + faltando.join(", ");',
            ' return;',
            ' }',
            ' res.className = "carregando";',
            ' res.textContent = "Enviando ficha ao Fandi...";',
            ' fetch("/api/submit-fandi", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(dados) })',
            ' .then(function(r){ return r.json(); })',
            ' .then(function(j){',
            ' if (!j.success) throw new Error(j.message);',
            ' res.className = "sucesso";',
            ' res.textContent = j.message + " (ID: " + j.fandi_id + ")";',
            ' document.getElementById("dados").value = "";',
            ' pollStatus(j.fandi_id);',
            ' carregarLista();',
            ' })',
            ' .catch(function(e){',
            ' res.className = "erro";',
            ' res.textContent = "Erro: " + e.message;',
            ' });',
            '}',
            'function pollStatus(id) {',
            ' var iv = setInterval(function(){',
            ' fetch("/api/status/" + id).then(function(r){ return r.json(); }).then(function(j){',
            ' if (j.success && j.ficha.status !== "enviando") {',
            ' clearInterval(iv);',
            ' carregarLista();',
            ' }',
            ' });',
            ' }, 3000);',
            ' setTimeout(function(){ clearInterval(iv); }, 90000);',
            '}',
            'function linkEmail(ficha) {',
            ' var assunto = encodeURIComponent("Sequenciar ficha");',
            ' var corpo = encodeURIComponent("CPF: " + (ficha.cpf||"") + "\\nNome completo: " + (ficha.name||""));',
            ' var to = DESTINATARIOS.join(",");',
            ' return "https://outlook.office.com/mail/deeplink/compose?to=" + to + "&subject=" + assunto + "&body=" + corpo;',
            '}',
            'function carregarLista() {',
            ' fetch("/api/fichas").then(function(r){ return r.json(); }).then(function(j){',
            ' var div = document.getElementById("lista");',
            ' if (!j.fichas.length) { div.innerHTML = "<div class=\\"vazio\\">Nenhuma ficha enviada ainda.</div>"; return; }',
            ' var html = "";',
            ' for (var i=0;i<j.fichas.length;i++) {',
            ' var f = j.fichas[i];',

            ' html += \'<div class="ficha"><div class="info"><strong>\' + (f.name||"(sem nome)") + \'</strong><span>CPF: \' + (f.cpf||"-") + " - " + new Date(f.criadoEm).toLocaleString("pt-BR") + \'</span></div><span class="badge \' + f.status + \'">\' + f.status + \'</span><div class="acoes"><a class="\' + (f.fandiUrl ? "" : "desabilitado") + \'" href="\' + (f.fandiUrl||"#") + \'" target="_blank">Ver no Fandi</a><a href="\' + linkEmail(f) + \'" target="_blank">Ver Email</a></div></div>\';',
            ' }',
            ' div.innerHTML = html;',
            ' });',
            '}',
            'carregarLista();',
            'setInterval(carregarLista, 15000);',
            '</script>',
            '</body></html>'
            ].join("\n");
}

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
