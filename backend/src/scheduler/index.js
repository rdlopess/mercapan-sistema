/**
 * scheduler/index.js
 * Agenda o ciclo completo de cotacao toda segunda-feira as 7h (Brasilia).
 *
 * Ciclo completo:
 *   1. Cria registro de log (status: em_andamento)
 *   2. Executa cotacao (scraping + tabela_semanal)
 *   3. Busca tabela_semanal gerada
 *   4. Gera PDF e faz upload para Supabase Storage
 *   5. Atualiza planilha Google Sheets
 *   6. Finaliza log com status concluido
 *   Em caso de erro: registra status erro no log
 */

const cron = require('node-cron');
const supabase = require('../supabase/client');
const { executarCotacao } = require('../scrapers/cotacao');
const { iniciarLog, concluirLog, registrarErro } = require('../services/logger');
const { gerarEFazerUploadPdf } = require('../services/pdfGenerator');
const { atualizarPlanilha } = require('../services/googleSheets');

/**
 * Busca a tabela_semanal do Supabase para a semana informada.
 *
 * @param {string} semana - YYYY-MM-DD
 * @returns {Array}
 */
async function buscarTabelaSemanal(semana) {
  const { data, error } = await supabase
    .from('tabela_semanal')
    .select(`
      *,
      produtos  ( nome, categoria, unidade ),
      fornecedores ( nome )
    `)
    .eq('semana', semana);

  if (error) throw new Error(`Erro ao buscar tabela_semanal: ${error.message}`);
  return data || [];
}

/**
 * Executa o ciclo completo: cotacao + PDF + Sheets + log.
 *
 * @param {'agendador'|'manual'} origem
 * @returns {object} resultado com url do PDF e status do Sheets
 */
async function cicloCompleto(origem = 'agendador') {
  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`\n[Agendador] Iniciando ciclo completo (${origem}) — semana: ${hoje}`);

  const logId = await iniciarLog(origem);

  try {
    // 1. Cotacao (scraping + gravacao na tabela_semanal)
    const resultado = await executarCotacao();
    console.log(`[Agendador] Cotacao: ${resultado.geradas} geradas | ${resultado.erros} erros`);

    // 2. Buscar tabela_semanal recem-gerada
    const tabelaSemanal = await buscarTabelaSemanal(hoje);

    // 3. Gerar PDF e enviar ao Supabase Storage
    let pdfUrl = null;
    try {
      const { url, tamanhoBytes } = await gerarEFazerUploadPdf(tabelaSemanal, hoje);
      pdfUrl = url;
      console.log(`[Agendador] PDF gerado (${(tamanhoBytes / 1024).toFixed(1)} KB): ${url}`);
    } catch (errPdf) {
      console.error('[Agendador] Falha ao gerar PDF (nao fatal):', errPdf.message);
    }

    // 4. Atualizar Google Sheets
    let sheetsAtualizado = false;
    try {
      await atualizarPlanilha(tabelaSemanal, hoje);
      sheetsAtualizado = true;
      console.log('[Agendador] Google Sheets atualizado com sucesso.');
    } catch (errSheets) {
      console.error('[Agendador] Falha ao atualizar Google Sheets (nao fatal):', errSheets.message);
    }

    // 5. Finalizar log
    await concluirLog(logId, resultado, pdfUrl, sheetsAtualizado);

    console.log(`[Agendador] Ciclo concluido. PDF: ${pdfUrl ? 'OK' : 'falhou'} | Sheets: ${sheetsAtualizado ? 'OK' : 'falhou'}`);

    return { resultado, pdfUrl, sheetsAtualizado };

  } catch (err) {
    console.error('[Agendador] Erro fatal no ciclo:', err.message);
    await registrarErro(logId, err.message);
    throw err;
  }
}

// -------------------------------------------------------
// Agendamento: toda segunda-feira as 7h (horario de Brasilia)
// -------------------------------------------------------
cron.schedule('0 7 * * 1', () => cicloCompleto('agendador'), {
  timezone: 'America/Sao_Paulo',
});

console.log('[Agendador] Ativo: ciclo completo toda segunda-feira as 7h (America/Sao_Paulo)');
console.log('[Agendador] Etapas: cotacao → PDF (Supabase Storage) → Google Sheets → log');

module.exports = { cicloCompleto };
