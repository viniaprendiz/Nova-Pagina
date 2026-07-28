// Puppeteer configuration for Render environment// Removed all complex config - use defaults which work better on Rendermodule.exports = {
  skipDownload: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
};
