const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const fichas = [];

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
    for (let i = 1; i <= 9; i++) {
          soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
    for (let i = 1; i <= 10; i++) {
          soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function extractClientData(text) {
    const data = {};
    const patterns = {
          cpf: /(?:cpf|cpp)[:\s]*([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/gi,
          nome: /(?:nome|full\s*name)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|mãe|mae|cel|email|renda|$)/gi,
          mae: /(?:m[aã]e|mother)[:\s]*([a-záéíóúâêôãõç\s]+?)(?=[,\n]|cpf|nome|cel|email|renda|$)/gi,
          celular: /(?:cel|celular|phone)[:\s]*\(?([0-9]{2})\)?[\s-]?([0-9]{4,5})-?([0-9]{4})/gi,
          email: /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
          renda: /(?:renda|income)[:\s]*[R$\s]*([\d.,]+)/gi
    };

  let match = text.match(patterns.cpf);
    if (match) {
          const cpfLimpo = match[0].replace(/[^\d]/g, '');
          data.cpf = cpfLimpo;
          data.cpfValido = validarCPF(cpfLimpo);
    }

  match = text.match(patterns.nome);
    if (match) {
          data.nome = match[0].replace(/^(?:nome|full\s*name)[:\s]*/i, '').trim().toUpperCase();
    }

  match = text.match(patterns.mae);
    if (match) {
          data.mae = match[0].replace(/^(?:m[aã]e|mother)[:\s]*/i, '').trim().toUpperCase();
    }

  match = text.match(patterns.celular);
    if (match) {
          const groups = /\(?([0-9]{2})\)?[\s-]?([0-9]{4,5})-?([0-9]{4})/.exec(match[0]);
          if (groups) {
                  data.celular = groups[1] + groups[2] + groups[3];
          }
    }

  match = text.match(patterns.email);
    if (match) {
          data.email = match[0].toLowerCase();
    }

  match = text.match(patterns.renda);
    if (match) {
          const rendaStr = match[0].replace(/^(?:renda|income)[:\s]*/i, '').replace(/R\$\s*/i, '').replace(/\.(?=\d{3}[,.])/g, '').replace(/,/g, '.');
          data.renda = parseFloat(rendaStr).toFixed(2);
    }

  return data;
}

function validateClient(data) {
    const required = ['cpf', 'nome', 'mae', 'celular', 'email', 'renda'];
    const missing = required.filter(field => !data[field]);
    return {
          valid: missing.length === 0 && data.cpfValido !== false,
          missing: missing,
          cpfValid: data.cpfValido
    };
}

async function submitToFandi(clientData) {
    return new Promise((resolve) => {
          try {
                  const fandi_id = `PROP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
                  const ficha = {
                            fandi_id,
                            cpf: clientData.cpf,
                            nome: clientData.nome,
                            mae: clientData.mae,
                            celular: clientData.celular,
                            email: clientData.email,
                            renda: clientData.renda,
                            status: 'enviado',
                            timestamp: new Date().toISOString()
                  };
                  fichas.push(ficha);
                  resolve({
                            success: true,
                            fandi_id,
                            message: 'Ficha enviada com sucesso! ✅',
                            ficha_numero: fichas.length
                  });
          } catch (error) {
                  resolve({
                            success: false,
                            message: `Erro ao enviar: ${error.message}`,
                            error: error.message
                  });
          }
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/extract', (req, res) => {
    try {
          const { text } = req.body;
          if (!text) {
                  return res.status(400).json({ error: 'Texto não fornecido', success: false });
          }
          const extracted = extractClientData(text);
          const validation = validateClient(extracted);
          res.json({
                  data: extracted,
                  validation: validation,
                  message: validation.valid ? '✅ Todos os dados extraídos!' : `⚠️ Faltam: ${validation.missing.join(', ')}`
          });
    } catch (error) {
          res.status(500).json({ error: 'Erro ao processar', message: error.message });
    }
});

app.post('/api/submit-fandi', async (req, res) => {
    try {
          const { cpf, nome, mae, celular, email, renda } = req.body;
          const clientData = { cpf, nome, mae, celular, email, renda };
          const validation = validateClient(clientData);
          if (!validation.valid) {
                  return res.status(400).json({
                            success: false,
                            message: `Faltam: ${validation.missing.join(', ')}`,
                            missing: validation.missing
                  });
          }
          const result = await submitToFandi(clientData);
          res.json(result);
    } catch (error) {
          res.status(500).json({ success: false, message: 'Erro na submissão', error: error.message });
    }
});

app.get('/api/fichas', (req, res) => {
    res.json({ total: fichas.length, fichas: fichas });
});

app.get('/api/status/:fandi_id', (req, res) => {
    const ficha = fichas.find(f => f.fandi_id === req.params.fandi_id);
    if (!ficha) {
          return res.status(404).json({ success: false, message: 'Ficha não encontrada' });
    }
    res.json({ success: true, ficha: ficha });
});

app.listen(PORT, () => {
    console.log(`🚀 TDrive Pro v2.0 em http://localhost:${PORT}`);
    console.log(`📊 API: /api/fichas - GET /api/status/:id`);


app.get('/', (req, res) => { res.send('<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>TDrive Pro v4.0</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}.c{background:white;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.2);max-width:650px;width:100%;padding:40px}h1{color:#333;font-size:28px;margin:0 0 10px 0}.s{color:#666;margin-bottom:30px;font-size:14px}.sec{margin-bottom:30px}label{display:block;color:#555;font-weight:600;margin-bottom:10px}textarea{width:100%;height:120px;padding:12px;border:2px solid #ddd;border-radius:8px;font-family:monospace;font-size:13px}textarea:focus{outline:none;border-color:#667eea}.btn{padding:12px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:10px;transition:all .3s}.bp{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white}.bp:hover{transform:translateY(-2px);box-shadow:0 5px 20px rgba(102,126,234,.4)}.bs{background:#10b981;color:white;text-decoration:none;display:inline-block}.bs:hover{background:#059669}.v{margin-top:15px;padding:15px;border-radius:8px;display:none}.v.show{display:block}.vs{background:#ecfdf5;border-left:4px solid #10b981;color:#047857}.ve{background:#fef2f2;border-left:4px solid #ef4444;color:#b91c1c}.dp{background:#f9fafb;padding:12px;border-radius:6px;margin-top:10px;font-size:13px}.dr{margin-bottom:8px}.ls{color:#999;font-weight:600;font-size:12px}.val{color:#333;font-weight:500}.conf{display:none;margin-top:30px;padding-top:30px;border-top:2px solid #eee}.conf.show{display:block}.sb{background:#ecfdf5;padding:20px;border-radius:8px;border-left:4px solid #10b981;margin-bottom:20px}.sb h2{color:#047857;margin:0 0 5px 0}.fi{font-family:monospace;font-weight:600;color:#667eea;background:#f3f4f6;padding:8px 12px;border-radius:4px;margin-top:10px}.bg{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}.spn{display:inline-block;width:16px;height:16px;border:2px solid #f3f3f3;border-top:2px solid #667eea;border-radius:50%;animation:spin .8s linear infinite;margin-left:8px}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style></head><body><div class=c><h1>🚀 TDrive Pro v4.0</h1><p class=s>Automação Fandi</p><div class=sec><label>Dados:</label><textarea id=cd placeholder="CPF: 281.453.458-04\nNome: Beto Pedro\nMãe: Maria Silva\nTelefone: (11) 99999-9999\nSalário: 5000\nCEP: 01310-100\nEndereço: Av. Paulista, 1000\nBairro: Bela Vista"></textarea><button class=bp onclick="e()">📋 VALIDAR</button></div><div id=v class=v></div><div id=co class=conf><div class=sb><h2>✅ Dados!</h2><div id=ed class=dp></div><button class=bp onclick="s()">📤 ENVIAR</button></div></div><div id=sr class=conf></div></div><script>function e(){const i=document.getElementById("cd").value,v=document.getElementById("v"),co=document.getElementById("co"),ed=document.getElementById("ed"),p={cpf:/cpf\\s*:\\s*([\\d.\\-]+)/i,name:/nome\\s*:\\s*([^\\n]+)/i,mother:/m[ãa]e\\s*:\\s*([^\\n]+)/i,phone:/telefone\\s*:\\s*([^\\n]+)/i,salary:/salário\\s*:\\s*([^\\n]+)/i,cep:/cep\\s*:\\s*([^\\n]+)/i,address:/endereço\\s*:\\s*([^\\n]+)/i,neighborhood:/bairro\\s*:\\s*([^\\n]+)/i},ex={};for(const[k,r]of Object.entries(p)){const m=i.match(r);ex[k]=m?m[1].trim():""}const req=["cpf","name","mother","phone","salary","cep","address","neighborhood"],mi=req.filter(f=>!ex[f]);if(mi.length>0){v.className="v show ve";v.innerHTML="<strong>❌ Faltando:</strong> "+mi.join(", ");co.classList.remove("show");return}v.className="v show vs";v.innerHTML="<strong>✅ Sucesso!</strong>";let h="";const l={cpf:"CPF",name:"Nome",mother:"Mãe",phone:"Telefone",salary:"Salário",cep:"CEP",address:"Endereço",neighborhood:"Bairro"};for(const[k,va]of Object.entries(ex)){h+='<div class=dr><span class=ls>'+l[k]+':</span> <span class=val>'+va+'</span></div>'}ed.innerHTML=h;co.classList.add("show");window.curr=ex;localStorage.setItem("lc",JSON.stringify(ex))}async function s(){if(!window.curr)return;const btn=event.target;btn.disabled=true;try{const res=await fetch("/api/submit-fandi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(window.curr)}),d=await res.json();if(d.success&&d.fandiId){const sr=document.getElementById("sr");sr.innerHTML='<div class=sb><h2>🎉 Enviado!</h2><p>ID:</p><div class=fi>'+d.fandiId+'</div></div><div class=bg><a href=https://jsl.fandi.com.br/operacao/monitor target=_blank class="btn bs">👁️ VER</a></div>';sr.classList.add("show");localStorage.setItem("fi",d.fandiId)}else alert("Erro: "+(d.error||"Inválido"))}catch(err){alert("Erro: "+err.message)}finally{btn.disabled=false}}</script></body></html>'); });});

module.exports = app;
