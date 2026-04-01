/**
 * routes/cotacao.js
 * Endpoint manual para disparar o ciclo completo de cotacao pelo painel.
 *
 * POST /api/cotacao/executar
 *   → roda cotacao + PDF + Sheets + log (origem: 'manual')
 *   → retorna resultado completo ao terminar (sincrono)
 *
 * GET /api/cotacao/logs
 *   → retorna os ultimos 20 logs de cotacao para o painel
 */

const express = require('express');
const router = express.Router();
const { cicloCompleto } = require('../scheduler');
const { buscarLogs } = require('../services/logger');

/**
 * POST /api/cotacao/executar
 * Disparo manual do ciclo completo (scraping + PDF + Sheets + log).
 * Resposta sincrona — aguarda a conclusao do ciclo.
 */
router.post('/executar', async (req, res) => {
  console.log('[API] Disparo manual de cotacao recebido.');

  try {
    const { resultado, pdfUrl, sheetsAtualizado } = await cicloCompleto('manual');

    res.json({
      ok: true,
      mensagem: 'Cotacao concluida com sucesso.',
      geradas: resultado.geradas,
      erros: resultado.erros,
      duracao_segundos: resultado.duracao_segundos,
      pdf_url: pdfUrl,
      sheets_atualizado: sheetsAtualizado,
      relatorio: resultado.relatorio,
    });
  } catch (err) {
    console.error('[API] Erro no disparo manual:', err.message);
    res.status(500).json({
      ok: false,
      mensagem: 'Erro ao executar cotacao.',
      erro: err.message,
    });
  }
});

/**
 * GET /api/cotacao/logs
 * Retorna os ultimos logs de cotacao para exibir no painel.
 *
 * Query params:
 *   limite (opcional, default: 20)
 */
router.get('/logs', async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 20, 100);
    const logs = await buscarLogs(limite);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
