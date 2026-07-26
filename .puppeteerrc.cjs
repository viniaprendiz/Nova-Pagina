// Configuracao do navegador automatizado (Puppeteer)
// CORRIGIDO EM 26/07/2026 - ver causa raiz no cerebro
//
// O arquivo anterior tinha 3 defeitos que impediam qualquer ficha de subir:
//  1. skipChromiumDownload: true  -> o Chrome NUNCA era baixado no build
//  2. executablePath: 'a' || 'b'  -> em JS isso sempre devolve 'a', entao ficava
//     travado em /usr/bin/chromium-browser, caminho que NAO existe no Render
//  3. downloadHost -> opcao antiga, ignorada pelo puppeteer 22
//
// Agora: o Chrome e baixado no build para dentro da pasta do projeto,
// que e a unica forma de ele continuar existindo quando o servidor sobe.

const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer')
};
