/* ============================================================
   TDRIVE PRO - agente.js  (v11.0 - 26/07/2026)
   Interpretador do texto ditado -> os 8 campos da ficha.

   REGRAS DE SEGURANCA (nao mudar):
   - Nenhuma chave de API escrita aqui. Tudo vem de process.env.
   - Este modulo NAO envia ficha para o Fandi. Ele so LE o texto e
     devolve os campos para o Vinicios confirmar na tela.
   - Funciona SEM chave nenhuma (extrator local por regex).
     Se ANTHROPIC_API_KEY existir, usa a Claude API para entender
     frase solta, e o extrator local vira rede de seguranca.
   ============================================================ */

const CAMPOS = ['cpf', 'name', 'mother', 'phone', 'salary', 'cep', 'address', 'neighborhood'];

const ROTULOS = {
  cpf: 'CPF',
  name: 'Nome',
  mother: 'Mae',
  phone: 'Telefone',
  salary: 'Salario',
  cep: 'CEP',
  address: 'Endereco',
  neighborhood: 'Bairro'
};

// Rotulos que a pessoa fala. A ordem da alternativa importa: o mais longo vem antes.
const MARCAS = [
  { campo: 'cpf',          re: /\bcpf\b/i },
  { campo: 'name',         re: /\bnome(?:\s+completo)?\b/i },
  { campo: 'mother',       re: /\b(?:nome\s+da\s+m[aã]e|m[aã]e|filia[cç][aã]o)\b/i },
  { campo: 'phone',        re: /\b(?:telefone|celular|fone|whatsapp|whats)\b/i },
  { campo: 'salary',       re: /\b(?:sal[aá]rio|salario|renda|ganha)\b/i },
  { campo: 'cep',          re: /\bcep\b/i },
  { campo: 'address',      re: /\b(?:endere[cç]o|rua|avenida)\b/i },
  { campo: 'neighborhood', re: /\bbairro\b/i }
];

function digitos(s) {
  return (s || '').toString().replace(/\D+/g, '');
}

function limpar(s) {
  return (s || '').toString()
    .replace(/^[\s:;.,\-]+/, '')
    .replace(/[\s:;.,\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MINUSCULAS = ['de', 'da', 'das', 'do', 'dos', 'e'];

function tituloCase(s) {
  return limpar(s).toLowerCase().split(' ').map(function (p) {
    if (!p) return p;
    if (MINUSCULAS.indexOf(p) >= 0) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}

function formatarCpf(s) {
  const d = digitos(s);
  if (d.length !== 11) return limpar(s);
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

function formatarTelefone(s) {
  const d = digitos(s);
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return limpar(s);
}

function formatarCep(s) {
  const d = digitos(s);
  if (d.length === 8) return d.slice(0, 5) + '-' + d.slice(5);
  return limpar(s);
}

// "5 mil" -> 5000 | "R$ 3.200,00" -> 3200 | "dois mil e quinhentos" nao trata (falar numero)
function formatarSalario(s) {
  const bruto = limpar(s).toLowerCase();
  if (!bruto) return '';
  // entende "4 mil", "4,5 mil" e tambem "4 mil e 500"
  const mil = /(\d+(?:[.,]\d+)?)\s*mil(?:\s*e\s*(\d+))?/.exec(bruto);
  if (mil) {
    const n = parseFloat(mil[1].replace(',', '.'));
    const resto = mil[2] ? parseInt(mil[2], 10) : 0;
    if (!isNaN(n)) return String(Math.round(n * 1000) + (isNaN(resto) ? 0 : resto));
  }
  const so = bruto.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n2 = parseFloat(so);
  if (!isNaN(n2)) return String(Math.round(n2));
  return '';
}

function acharMarcas(t) {
  const achados = [];
  MARCAS.forEach(function (m) {
    const re = new RegExp(m.re.source, 'gi');
    let r;
    while ((r = re.exec(t)) !== null) {
      achados.push({ campo: m.campo, ini: r.index, fim: r.index + r[0].length });
      if (r.index === re.lastIndex) re.lastIndex++;
    }
  });
  achados.sort(function (a, b) { return a.ini - b.ini; });

  // "nome da mae" nao pode virar o campo Nome
  const semConflito = achados.filter(function (a) {
    if (a.campo !== 'name') return true;
    return !achados.some(function (b) {
      return b.campo === 'mother' && a.ini >= b.ini && a.fim <= b.fim;
    });
  });

  // so a primeira aparicao de cada campo conta
  const vistos = {};
  return semConflito.filter(function (a) {
    if (vistos[a.campo]) return false;
    vistos[a.campo] = true;
    return true;
  });
}

function fatiar(t) {
  const marcas = acharMarcas(t);
  const partes = {};
  marcas.forEach(function (m, i) {
    const fim = (i + 1 < marcas.length) ? marcas[i + 1].ini : t.length;
    partes[m.campo] = t.slice(m.fim, fim);
  });
  return partes;
}

function extrairLocal(texto) {
  const t = (texto || '').toString().replace(/\s+/g, ' ').trim();
  const p = fatiar(t);
  const dados = {};
  CAMPOS.forEach(function (c) { dados[c] = ''; });

  if (p.cpf) dados.cpf = formatarCpf(p.cpf);
  if (p.name) dados.name = tituloCase(p.name);
  if (p.mother) dados.mother = tituloCase(p.mother);
  if (p.phone) dados.phone = formatarTelefone(p.phone);
  if (p.salary) dados.salary = formatarSalario(p.salary);
  if (p.cep) dados.cep = formatarCep(p.cep);
  if (p.address) dados.address = limpar(p.address);
  if (p.neighborhood) dados.neighborhood = tituloCase(p.neighborhood);

  // rede de seguranca: CPF e CEP soltos no texto, sem rotulo
  if (!dados.cpf) {
    const m = /\b\d{3}\D?\d{3}\D?\d{3}\D?\d{2}\b/.exec(t);
    if (m) dados.cpf = formatarCpf(m[0]);
  }
  if (!dados.cep) {
    const m = /\b\d{5}\D?\d{3}\b/.exec(t);
    if (m) dados.cep = formatarCep(m[0]);
  }
  return dados;
}

const MODELO = process.env.CLAUDE_MODELO || 'claude-sonnet-4-5';

async function pedirParaClaude(texto) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return { ok: false, motivo: 'sem-chave' };
  if (typeof fetch !== 'function') return { ok: false, motivo: 'node-antigo' };

  const instrucao = [
    'Voce recebe a transcricao de um audio de um vendedor de carros no Brasil.',
    'Extraia os dados do cliente e responda SOMENTE com um JSON valido, sem nenhum comentario,',
    'exatamente neste formato:',
    '{"cpf":"","name":"","mother":"","phone":"","salary":"","cep":"","address":"","neighborhood":""}',
    'Regras: cpf no formato 000.000.000-00; phone no formato (00) 00000-0000;',
    'cep no formato 00000-000; salary somente numeros inteiros em reais;',
    'name e mother com a primeira letra de cada palavra em maiuscula;',
    'address e a rua com numero; neighborhood e o bairro;',
    'campo que nao aparecer no texto deve vir como string vazia.',
    'NAO invente nenhum dado.',
    'Transcricao:',
    texto
  ].join('\n');

  try {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 700,
        messages: [{ role: 'user', content: instrucao }]
      })
    });
    const corpo = await resposta.json();
    if (!resposta.ok) {
      const msg = (corpo && corpo.error && corpo.error.message) || ('HTTP ' + resposta.status);
      return { ok: false, motivo: 'api-recusou', detalhe: msg };
    }
    const txt = (corpo.content || []).map(function (p) { return p.text || ''; }).join(' ');
    const ini = txt.indexOf('{');
    const fim = txt.lastIndexOf('}');
    if (ini < 0 || fim <= ini) return { ok: false, motivo: 'resposta-estranha' };
    const json = JSON.parse(txt.slice(ini, fim + 1));
    const dados = {};
    CAMPOS.forEach(function (c) {
      dados[c] = (typeof json[c] === 'string') ? json[c].trim() : '';
    });
    return { ok: true, dados: dados };
  } catch (e) {
    return { ok: false, motivo: 'erro', detalhe: e.message };
  }
}

async function interpretar(texto) {
  const limpo = (texto || '').toString().trim();
  if (!limpo) {
    return { success: false, message: 'Nao chegou nenhum texto. Fala de novo ou digita.' };
  }
  if (limpo.length > 4000) {
    return { success: false, message: 'Texto muito longo. Limite de 4000 caracteres.' };
  }

  const local = extrairLocal(limpo);
  let dados = local;
  let fonte = 'local';
  let aviso = '';

  const ia = await pedirParaClaude(limpo);
  if (ia.ok) {
    fonte = 'claude';
    dados = {};
    CAMPOS.forEach(function (c) { dados[c] = ia.dados[c] || local[c] || ''; });
  } else if (ia.motivo === 'sem-chave') {
    aviso = 'Para ficar ainda mais esperto com frase solta, crie a variavel ANTHROPIC_API_KEY no Render.';
  } else {
    aviso = 'A Claude API nao respondeu (' + (ia.detalhe || ia.motivo) + '). Usei o modo local.';
  }

  const faltando = CAMPOS.filter(function (c) { return !dados[c]; }).map(function (c) { return ROTULOS[c]; });
  const textoFicha = CAMPOS.map(function (c) { return ROTULOS[c] + ': ' + (dados[c] || ''); }).join('\n');

  return {
    success: true,
    fonte: fonte,
    aviso: aviso,
    dados: dados,
    faltando: faltando,
    completo: faltando.length === 0,
    textoFicha: textoFicha,
    proximoPasso: 'Confira na tela e clique para enviar. O agente NUNCA envia sozinho.'
  };
}

module.exports = {
  interpretar: interpretar,
  extrairLocal: extrairLocal,
  CAMPOS: CAMPOS,
  ROTULOS: ROTULOS
};
