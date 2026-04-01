/**
 * logger.js
 * Registra execucoes de cotacao na tabela logs_cotacao do Supabase.
 *
 * Ciclo de vida de um log:
 *   1. iniciarLog()      → cria registro com status 'em_andamento'
 *   2. concluirLog()     → atualiza com resultados e status 'concluido'
 *   3. registrarErro()   → atualiza com mensagem de erro e status 'erro'
 */

const supabase = require('../supabase/client');

/**
 * Cria um novo registro de log no inicio de uma cotacao.
 *
 * @param {'agendador'|'manual'} origem
 * @returns {string} id do log criado
 */
async function iniciarLog(origem = 'agendador') {
  const { data, error } = await supabase
    .from('logs_cotacao')
    .insert({
      origem,
      status: 'em_andamento',
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Logger] Erro ao criar log:', error.message);
    return null;
  }

  console.log(`[Logger] Log iniciado: ${data.id} (origem: ${origem})`);
  return data.id;
}

/**
 * Atualiza o log ao concluir a cotacao com sucesso.
 *
 * @param {string} logId
 * @param {object} resultado - retorno de executarCotacao()
 * @param {string|null} pdfUrl
 * @param {boolean} sheetsAtualizado
 */
async function concluirLog(logId, resultado, pdfUrl = null, sheetsAtualizado = false) {
  if (!logId) return;

  const { error } = await supabase
    .from('logs_cotacao')
    .update({
      status:            'concluido',
      concluido_em:      new Date().toISOString(),
      produtos_cotados:  resultado.geradas,
      erros:             resultado.erros,
      duracao_segundos:  resultado.duracao_segundos,
      pdf_url:           pdfUrl,
      sheets_atualizado: sheetsAtualizado,
      detalhes:          resultado.relatorio ?? null,
    })
    .eq('id', logId);

  if (error) {
    console.error('[Logger] Erro ao concluir log:', error.message);
  } else {
    console.log(`[Logger] Log concluido: ${logId}`);
  }
}

/**
 * Atualiza o log quando ocorre um erro fatal.
 *
 * @param {string} logId
 * @param {string} mensagem
 */
async function registrarErro(logId, mensagem) {
  if (!logId) return;

  const { error } = await supabase
    .from('logs_cotacao')
    .update({
      status:        'erro',
      concluido_em:  new Date().toISOString(),
      mensagem_erro: mensagem,
    })
    .eq('id', logId);

  if (error) {
    console.error('[Logger] Erro ao registrar falha no log:', error.message);
  } else {
    console.log(`[Logger] Erro registrado no log: ${logId}`);
  }
}

/**
 * Busca os ultimos N logs de cotacao (para exibir no painel).
 *
 * @param {number} limite
 * @returns {Array}
 */
async function buscarLogs(limite = 20) {
  const { data, error } = await supabase
    .from('logs_cotacao')
    .select('id, iniciado_em, concluido_em, origem, status, produtos_cotados, erros, duracao_segundos, pdf_url, sheets_atualizado')
    .order('iniciado_em', { ascending: false })
    .limit(limite);

  if (error) throw new Error(`Erro ao buscar logs: ${error.message}`);
  return data || [];
}

module.exports = { iniciarLog, concluirLog, registrarErro, buscarLogs };
