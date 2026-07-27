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

  // ---- Abas de navegacao: uma lista so para todo o site, filtrada pelo papel ----
  var ABAS_BASE = [
    ["/", "Ficha"],
    ["/crm.html", "Clientes"],
    ["/loja.html", "Vitrine"],
    ["/leads.html", "Leads"],
    ["/simulador.html", "Simulador"],
    ["/consorcio.html", "Consorcio"],
    ["/voz.html", "Ditar"],
    ["/padrao-clientes.html", "Padrao"],
    ["/painel.html", "Painel"],
    ["/roadmap.html", "Ideias"]
  ];
  var SO_DONO = ["/roadmap.html"];
  var DONO_E_GESTOR = ["/painel.html"];
  function abasPermitidas(role) {
    return ABAS_BASE.filter(function (a) {
      if (SO_DONO.indexOf(a[0]) !== -1) return role === "admin";
      if (DONO_E_GESTOR.indexOf(a[0]) !== -1) return role === "admin" || role === "gestor";
      return !!role;
    });
  }
  function montarAbas(role) {
    window.__tdriveRole = role;
    if (window.__tdriveMontarMenu) window.__tdriveMontarMenu();
    var caixas = document.querySelectorAll(".abas");
    if (!caixas.length) return;
    var aqui = location.pathname.replace(/(index|app)\.html$/, "");
    var lista = abasPermitidas(role);
    var html = lista.map(function (a) {
      var on = (a[0] === aqui) ? ' class="on"' : "";
      return '<a href="' + a[0] + '"' + on + '>' + a[1] + '</a>';
    }).join("");
    for (var i = 0; i < caixas.length; i++) caixas[i].innerHTML = html;
  }
  function iniciarAbas() {
    fetch("/api/me").then(function (r) { return r.json(); }).then(function (j) {
      montarAbas(j && j.usuario ? j.usuario.role : null);
    }).catch(function () { montarAbas(null); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarAbas);
  else iniciarAbas();

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
    if (document.getElementById('cssMenuTdrive')) return;
    var s = document.createElement('style');
    s.id = 'cssMenuTdrive';
    s.textContent = [
      '.abas{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.abas button{padding:8px 14px;border-radius:999px;border:1px solid var(--linha,#243352);background:var(--card,#121c30);color:var(--tx,#e8eefc);cursor:pointer;font:inherit;font-size:14px}',
      '.abas .btnEntrar{margin-left:auto;font-weight:700;border-color:var(--ac,#3b82f6);text-decoration:none;display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid var(--linha,#243352);background:var(--card,#121c30);color:var(--tx,#e8eefc);font-size:14px}',
      '.abas button.btnMenu{display:none}',
      '@media (max-width:700px){',
      '  .abas{flex-wrap:wrap}',
      '  .abas button.btnMenu{display:inline-block}',
      '  .abas.fechado a:not(.btnEntrar){display:none}',
      '  .abas a{flex:1 1 100%}',
      '  .abas .btnEntrar{margin-left:8px;flex:0 0 auto}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function montarMenu() {
    estilo();
    var caixas = document.querySelectorAll('.abas');
    for (var i = 0; i < caixas.length; i++) {
      var c = caixas[i];
      var temLinks = c.querySelectorAll('a').length > 0;
      if (temLinks && !c.querySelector('.btnMenu')) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btnMenu'; b.textContent = 'Menu';
        b.onclick = (function (caixa) { return function () { caixa.classList.toggle('fechado'); }; })(c);
        c.insertBefore(b, c.firstChild);
        c.classList.add('fechado');
      }
      var jaTemEntrar = c.querySelector('.btnEntrar');
      var precisaEntrar = !window.__tdriveRole;
      if (precisaEntrar && !jaTemEntrar) {
        var e = document.createElement('a');
        e.className = 'btnEntrar';
        e.href = '/entrar.html';
        e.textContent = 'Entrar';
        c.appendChild(e);
      } else if (!precisaEntrar && jaTemEntrar) {
        jaTemEntrar.remove();
      }
    }
  }
  window.__tdriveMontarMenu = montarMenu;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarMenu);
  else montarMenu();
  setTimeout(montarMenu, 600);
})();
