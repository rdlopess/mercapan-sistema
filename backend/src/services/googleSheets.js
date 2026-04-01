/**
 * googleSheets.js
 * Atualiza a planilha "Mercapan - Tabela Semanal" no Google Sheets
 * com os precos da cotacao semanal.
 *
 * Autenticacao: Service Account (JSON key via variaveis de ambiente).
 * Nao e necessario OAuth — o Service Account tem acesso direto.
 */

const { google } = require('googleapis');

/**
 * Cria o cliente autenticado do Google Sheets via Service Account.
 */
function criarCliente() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const chave  = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !chave) {
    throw new Error(
      'Variaveis GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY nao configuradas no .env'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      // As quebras de linha da chave privada ficam escapadas no .env como \n
      private_key: chave.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Atualiza a planilha com os dados da tabela semanal.
 *
 * Estrutura da aba "Tabela Semanal":
 *   Linha 1: cabecalho
 *   Linha 2+: um produto por linha
 *
 * Colunas: Produto | Categoria | Unidade | Fornecedor | Menor Preco | Margem% | Preco Venda | Semana
 *
 * @param {Array} tabelaSemanal - array de linhas da tabela_semanal (com joins)
 * @param {string} semana       - data no formato YYYY-MM-DD
 * @returns {{ linhasEscritas: number }}
 */
async function atualizarPlanilha(tabelaSemanal, semana) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    throw new Error('Variavel GOOGLE_SHEETS_ID nao configurada no .env');
  }

  console.log(`[GoogleSheets] Atualizando planilha: ${spreadsheetId}`);

  const sheets = criarCliente();
  const abaAlvo = 'Tabela Semanal';

  // -------------------------------------------------------
  // 1. Garantir que a aba existe; se nao, criar
  // -------------------------------------------------------
  const { data: spreadsheet } = await sheets.spreadsheets.get({ spreadsheetId });
  const abaExiste = spreadsheet.sheets.some(s => s.properties.title === abaAlvo);

  if (!abaExiste) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: abaAlvo },
          },
        }],
      },
    });
    console.log(`[GoogleSheets] Aba "${abaAlvo}" criada.`);
  }

  // -------------------------------------------------------
  // 2. Montar os dados para escrita
  // -------------------------------------------------------
  const dataFormatada = semana
    ? new Date(semana + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const cabecalho = [
    'Produto', 'Categoria', 'Unidade', 'Fornecedor Vencedor',
    'Menor Preco (R$)', 'Margem (%)', 'Preco Venda (R$)', 'Semana',
  ];

  const linhas = tabelaSemanal.map(t => [
    t.produtos?.nome          || '',
    t.produtos?.categoria     || '',
    t.produtos?.unidade       || 'UN',
    t.fornecedores?.nome      || '',
    Number(t.menor_preco).toFixed(2),
    Number(t.margem).toFixed(1) + '%',
    Number(t.preco_venda).toFixed(2),
    dataFormatada,
  ]);

  const valores = [cabecalho, ...linhas];

  // -------------------------------------------------------
  // 3. Limpar a aba e escrever os novos dados
  // -------------------------------------------------------
  const intervalo = `${abaAlvo}!A1`;

  // Limpa conteudo existente
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${abaAlvo}!A:Z`,
  });

  // Escreve novos dados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: intervalo,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: valores },
  });

  // -------------------------------------------------------
  // 4. Formatar cabecalho em negrito e congelar linha 1
  // -------------------------------------------------------
  const { data: sheetInfo } = await sheets.spreadsheets.get({ spreadsheetId });
  const abaId = sheetInfo.sheets.find(s => s.properties.title === abaAlvo)?.properties?.sheetId;

  if (abaId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Negrito no cabecalho
          {
            repeatCell: {
              range: { sheetId: abaId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.118, green: 0.228, blue: 0.373 }, // #1e3a5f
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,foregroundColor)',
            },
          },
          // Congelar linha 1
          {
            updateSheetProperties: {
              properties: {
                sheetId: abaId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Auto-redimensionar colunas
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: abaId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 8,
              },
            },
          },
        ],
      },
    });
  }

  console.log(`[GoogleSheets] ${linhas.length} linha(s) escritas com sucesso.`);
  return { linhasEscritas: linhas.length };
}

module.exports = { atualizarPlanilha };
