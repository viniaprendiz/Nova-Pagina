// TDrive Pro v5.1 - Routes Upgrade// POST /api/submit-fandi// GET /api/status/:id// GET /api/fichas// GET /healthconst express = require('express');
const crypto = require('crypto');
const app = module.exports = express();

const fichas = {};

app.post('/api/submit-fandi', (req, res) => {
  try {
      const dados = req.body;
          if (!dados.cpf || !dados.name) {
                return res.json({ success: false, message: 'Dados incompletos' });
                    }
                        const fandi_id = `PROP-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
                            console.log('[FANDI]', { fandi_id, cpf: dados.cpf, name: dados.name });
                                fichas[fandi_id] = { ...dados, fandi_id, createdAt: new Date(), status: 'enviada' };
                                    res.json({ success: true, fandi_id, message: 'Ficha enviada', data: fichas[fandi_id] });
                                      } catch(e) {
                                          res.json({ success: false, message: e.message });
                                            }
                                            });

                                            app.get('/api/status/:fandi_id', (req, res) => {
                                              const ficha = fichas[req.params.fandi_id];
                                                if (!ficha) return res.status(404).json({ success: false, message: 'Não encontrada' });
                                                  res.json({ success: true, ficha });
                                                  });

                                                  app.get('/api/fichas', (req, res) => {
                                                    const lista = Object.values(fichas).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                                                      res.json({ success: true, total: lista.length, fichas: lista });
                                                      });

                                                      app.get('/health', (req, res) => {
                                                        res.json({ status: 'ok', version: '5.1', timestamp: new Date() });
                                                        });
