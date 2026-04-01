const express = require('express');
const router = express.Router();
const { executarCotacao } = require('../scrapers/cotacao');

/**
 * POST /api/scraper/executar
 * Dispara a cotacao completa de todos os produtos e fornecedores.
 * Pode levar varios minutos dependendo da quantidade de produtos.
 */
router.post('/executar', async (req, res) => {
  try {
    console.log('[API] Cotacao iniciada via endpoint...');

    // Responde imediatamente com 202 Accepted
    res.status(202).json({
      message: 'Cotacao iniciada em segundo plano. Acompanhe os logs do servidor.',
      iniciado_em: new Date().toISOString(),
    });

    // Executa em background (nao bloqueia a resposta)
    executarCotacao()
      .then(resultado => {
        console.log('[API] Cotacao em background concluida:', JSON.stringify({
          geradas: resultado.geradas,
          erros: resultado.erros,
          duracao: resultado.duracao_segundos + 's',
        }));
      })
      .catch(err => {
        console.error('[API] Erro na cotacao em background:', err.message);
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scraper/executar-sincrono
 * Versao sincrona — aguarda a conclusao e retorna o relatorio completo.
 * Use apenas para testes com poucos produtos (pode demorar muito).
 */
router.post('/executar-sincrono', async (req, res) => {
  try {
    const { produtos } = req.body; // Ex: ["oleo de soja", "arroz"]
    console.log('[API] Cotacao sincrona iniciada...');

    const resultado = await executarCotacao(
      produtos ? { produtosTeste: produtos } : {}
    );

    res.json({
      message: 'Cotacao concluida',
      geradas: resultado.geradas,
      erros: resultado.erros,
      duracao_segundos: resultado.duracao_segundos,
      relatorio: resultado.relatorio,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
