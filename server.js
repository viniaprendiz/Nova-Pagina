// TDrive Pro v6.0 - Fandi + Status + Email (sem envio automatico de email)
const express = require('express');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'fichas.json');

app.use(express.json());

function loadFichas() {
    try {
          return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
          return {};
    }
}
function saveFichas(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
let fichas = loadFichas();

const EMAIL_DESTINATARIOS = [
    'marcelo.sinhorine@tdrive.com.br',
    'douglas.pinto@tdrive.com.br',
    'eli.psilva@tdrive.com.br',
    'feitoyota@automob.com.br'
  ];

app.post('/api/submit-fandi', async (req, res) => {
    const dados = req.body;
    if (!dados.cpf || !dados.name) {
          return res.json({ success: false, message: 'CPF ou Nome faltando' });
    }
    const fandi_id = 'PROP-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    fichas[fandi_id] = Object.assign({}, dados, { fandi_id: fandi_id, criadoEm: new Date().toISOString(), status: 'enviando' });
    saveFichas(fichas);
    res.json({ success: true, fandi_id: fandi_id, message: 'Ficha recebida, enviando ao Fandi...' });
    processarFicha(fandi_id, dados);
});

async function processarFicha(fandi_id, dados) {
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
          fichas[fandi_id].status = 'enviada';
          fichas[fandi_id].fandiUrl = urlFinal;
          saveFichas(fichas);
          console.log('[PUPPETEER] Ficha enviada:', fandi_id, urlFinal);
    } catch (err) {
          fichas[fandi_id].status = 'erro';
          fichas[fandi_id].erro = err.message;
          saveFichas(fichas);
          console.error('[ERRO]', fandi_id, err.message);
    } finally {
          if (browser) await browser.close();
    }
}

app.get('/api/fichas', function(req, res) {
    const lista = Object.values(fichas).sort(function(a, b){ return new Date(b.criadoEm) - new Date(a.criadoEm); });
          res.json({ success: true, total: lista.length, fichas: lista });
});

app.get('/api/status/:fandi_id', function(req, res) {
    const ficha = fichas[req.params.fandi_id];
    if (!ficha) return res.json({ success: false, message: 'Nao encontrada' });
    res.json({ success: true, ficha: ficha });
});

app.get('/', function(req, res) {
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
          '</style></head><body>',
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
          '  function pega(regex) { var m = texto.match(regex); return m ? m[1].trim() : ""; }',
          '  return {',
          '    cpf: pega(/cpf\\s*:\\s*([\\d.\\-]+)/i),',
          '    name: pega(/nome\\s*:\\s*([^\\n]+)/i),',
          '    mother: pega(/m[ãa]e\\s*:\\s*([^\\n]+)/i),',
          '    phone: pega(/telefone\\s*:\\s*([^\\n]+)/i),',
          '    salary: pega(/sal[áa]rio\\s*:\\s*([^\\n]+)/i),',
          '    cep: pega(/cep\\s*:\\s*([^\\n]+)/i),',
          '    address: pega(/endere[çc]o\\s*:\\s*([^\\n]+)/i),',
          '    neighborhood: pega(/bairro\\s*:\\s*([^\\n]+)/i)',
          '  };',
          '}',
          'function enviar() {',
          '  var texto = document.getElementById("dados").value;',
          '  var dados = extrair(texto);',
          '  var res = document.getElementById("resultado");',
          '  res.className = "carregando";',
          '  res.textContent = "Enviando ficha ao Fandi...";',
          '  fetch("/api/submit-fandi", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(dados) })',
          '    .then(function(r){ return r.json(); })',
          '    .then(function(j){',
          '      if (!j.success) throw new Error(j.message);',
          '      res.className = "sucesso";',
          '      res.textContent = j.message + " (ID: " + j.fandi_id + ")";',
          '      document.getElementById("dados").value = "";',
          '      pollStatus(j.fandi_id);',
          '      carregarLista();',
          '    })',
          '    .catch(function(e){',
          '      res.className = "erro";',
          '      res.textContent = "Erro: " + e.message;',
          '    });',
          '}',
          'function pollStatus(id) {',
          '  var iv = setInterval(function(){',
          '    fetch("/api/status/" + id).then(function(r){ return r.json(); }).then(function(j){',
          '      if (j.success && j.ficha.status !== "enviando") {',
          '        clearInterval(iv);',
          '        carregarLista();',
          '      }',
          '    });',
          '  }, 3000);',
          '  setTimeout(function(){ clearInterval(iv); }, 90000);',
          '}',
          'function linkEmail(ficha) {',
          '  var assunto = encodeURIComponent("Sequenciar ficha");',
          '  var corpo = encodeURIComponent("CPF: " + (ficha.cpf||"") + "\\nNome completo: " + (ficha.name||""));',
          '  var to = DESTINATARIOS.join(",");',
          '  return "https://outlook.office.com/mail/deeplink/compose?to=" + to + "&subject=" + assunto + "&body=" + corpo;',
          '}',
          'function carregarLista() {',
          '  fetch("/api/fichas").then(function(r){ return r.json(); }).then(function(j){',
          '    var div = document.getElementById("lista");',
          '    if (!j.fichas.length) { div.innerHTML = ""; return; }',
          '    var html = "";',
          '    for (var i=0;i<j.fichas.length;i++) {',
          '      var f = j.fichas[i];',
          '      html += \'<div class="ficha"><div class="info"><strong>\' + (f.name||"(sem nome)") + \'</strong><span>CPF: \' + (f.cpf||"-") + " - " + new Date(f.criadoEm).toLocaleString("pt-BR") + \'</span></div><span class="badge \' + f.status + \'">\' + f.status + \'</span><div class="acoes"><a class="\' + (f.fandiUrl ? "" : "desabilitado") + \'" href="\' + (f.fandiUrl||"#") + \'" target="_blank">Ver no Fandi</a><a href="\' + linkEmail(f) + \'" target="_blank">Ver Email</a></div></div>\';',
          '    }',
          '    div.innerHTML = html;',
          '  });',
          '}',
          'carregarLista();',
          'setInterval(carregarLista, 15000);',
          '</script>',
          '</body></html>'
        ].join("\n");
}

app.listen(PORT, function() {
    console.log('TDrive Pro rodando na porta ' + PORT);
});
