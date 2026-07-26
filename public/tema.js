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
