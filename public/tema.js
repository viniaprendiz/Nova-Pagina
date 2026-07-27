// Tema claro/escuro + PIN de acesso - TDrive PRO
// Carregado em todas as paginas. Guarda a preferencia no proprio aparelho.
(function () {
  var K = "tdrive_tema";
  var atual = localStorage.getItem(K) || "escuro";
  function aplicar(t) {
    document.documentElement.setAttribute("data-tema", t);
    localStorage.setItem(K, t);
    var b = document.getElementById("btnTema");
    if (b) b.textContent = t === "claro" ? "Modo escuro" : "Modo claro";
  }
  aplicar(atual);
  function montar() {
    if (document.getElementById("btnTema")) return;
    var b = document.createElement("button");
    b.id = "btnTema";
    b.className = "btnTema";
    b.type = "button";
    b.onclick = function () {
      aplicar(document.documentElement.getAttribute("data-tema") === "claro" ? "escuro" : "claro");
    };
    document.body.appendChild(b);
    aplicar(localStorage.getItem(K) || "escuro");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  // ---- Abas de navegacao: uma lista so para todo o site ----
  var ABAS = [
    ["/", "Ficha"],
    ["/crm.html", "Clientes"],
["/loja.html", "Vitrine"],
    ["/leads.html", "Leads"],
  ["/simulador.html", "Simulador"],
    ["/consorcio.html", "Consorcio"],
    ["/voz.html", "Ditar"],
    ["/painel.html", "Painel"],
    ["/roadmap.html", "Ideias"]
  ];
  function montarAbas() {
    var caixas = document.querySelectorAll(".abas");
    if (!caixas.length) return;
    var aqui = location.pathname.replace(/(index|app)\.html$/, "");
    var html = ABAS.map(function (a) {
      var on = (a[0] === aqui) ? ' class="on"' : "";
      return '<a href="' + a[0] + '"' + on + '>' + a[1] + '</a>';
    }).join("");
    for (var i = 0; i < caixas.length; i++) caixas[i].innerHTML = html;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarAbas);
  else montarAbas();

  // ---- PIN de acesso (so entra em acao se o servidor exigir) ----
  var PK = "tdrive_pin";
  window.tdrivePin = function () { return localStorage.getItem(PK) || ""; };
  window.tdriveHeaders = function (extra) {
    var h = extra || {};
    var p = window.tdrivePin();
    if (p) h["x-tdrive-pin"] = p;
    return h;
  };
  window.tdrivePedirPin = function () {
    var p = prompt("Esta area esta protegida. Digite o PIN de acesso:");
    if (p) { localStorage.setItem(PK, p); location.reload(); }
  };
  window.tdriveFetch = function (url, opcoes) {
    opcoes = opcoes || {};
    opcoes.headers = window.tdriveHeaders(opcoes.headers || {});
    return fetch(url, opcoes).then(function (r) {
      if (r.status === 401) { window.tdrivePedirPin(); throw new Error("Acesso protegido"); }
      return r.json();
    });
  };
})();

// ---- v13.1: menu responsivo (hamburger no celular) + botao Entrar ----
(function () {
  function estilo() {
    if (document.getElementById("cssMenuTdrive")) return;
    var s = document.createElement("style");
    s.id = "cssMenuTdrive";
    s.textContent = [
      ".abas{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".abas button{padding:8px 14px;border-radius:999px;border:1px solid var(--linha,#243352);background:var(--card,#121c30);color:var(--tx,#e8eefc);cursor:pointer;font:inherit;font-size:14px}",
      ".abas button.btnEntrar{margin-left:auto;font-weight:700;border-color:var(--ac,#3b82f6)}",
      ".abas button.btnMenu{display:none}",
      "@media (max-width:700px){",
      "  .abas{flex-wrap:wrap}",
      "  .abas button.btnMenu{display:inline-block}",
      "  .abas.fechado a{display:none}",
      "  .abas a{flex:1 1 100%}",
      "  .abas button.btnEntrar{margin-left:8px}",
      "}",
      ".jEntrar{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}",
      ".jEntrar>div{background:var(--card,#121c30);color:var(--tx,#e8eefc);border:1px solid var(--linha,#243352);border-radius:14px;padding:18px;max-width:420px;width:100%}",
      ".jEntrar h3{margin:0 0 8px}",
      ".jEntrar p{margin:0 0 10px;font-size:14px;opacity:.9}"
    ].join("");
    document.head.appendChild(s);
  }
  function janelaEntrar() {
var fundo = document.createElement("div");
fundo.className = "jEntrar";
fundo.innerHTML = '<div><h3>Entrar</h3>' +
'<p>Escolha o tipo de acesso:</p>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
'<button id="bVendedor" style="flex:1;min-width:150px">Sou vendedor</button>' +
'<button id="bAdmin" style="flex:1;min-width:150px">Sou o dono</button>' +
'</div>' +
'<p style="font-size:12px;opacity:.8">Ferramentas internas antigas (fichas, leads, estoque) ainda usam o PIN de acesso.</p>' +
'<p id="estadoPin">Verificando se o servidor esta protegido...</p>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="bPin">Digitar PIN</button><button id="bFechar">Fechar</button></div></div>';
document.body.appendChild(fundo);
fundo.addEventListener("click", function (e) { if (e.target === fundo) fundo.remove(); });
fundo.querySelector("#bFechar").onclick = function () { fundo.remove(); };
fundo.querySelector("#bPin").onclick = function () { if (window.tdrivePedirPin) window.tdrivePedirPin(); };
fundo.querySelector("#bVendedor").onclick = function () { location.href = "/vendedor/login"; };
fundo.querySelector("#bAdmin").onclick = function () { location.href = "/admin/login"; };
fetch("/api/config", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
var el = fundo.querySelector("#estadoPin");
if (!el) return;
el.textContent = c.protegido
? "Servidor protegido por PIN: SIM. As ferramentas antigas pedem o PIN."
: "Atencao: o servidor ainda NAO esta protegido por PIN. Crie a variavel TDRIVE_PIN no Render para trancar a lista de fichas.";
}).catch(function () {});
}

function montarMenu() {
    estilo();
    var caixas = document.querySelectorAll(".abas");
    for (var i = 0; i < caixas.length; i++) {
      var c = caixas[i];
      if (c.querySelector(".btnMenu")) continue;
      var b = document.createElement("button");
      b.type = "button"; b.className = "btnMenu"; b.textContent = "Menu";
      b.onclick = (function (caixa) { return function () { caixa.classList.toggle("fechado"); }; })(c);
      c.insertBefore(b, c.firstChild);
      c.classList.add("fechado");
      var e = document.createElement("button");
      e.type = "button"; e.className = "btnEntrar"; e.textContent = "Entrar";
      e.onclick = janelaEntrar;
      c.appendChild(e);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarMenu);
  else montarMenu();
  setTimeout(montarMenu, 600);
})();
