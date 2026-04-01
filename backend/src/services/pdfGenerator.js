/**
 * pdfGenerator.js
 * Gera o PDF do catalogo semanal usando Playwright (headless Chromium)
 * e faz upload para o Supabase Storage.
 *
 * Estrategia:
 *   1. Monta um HTML completo do catalogo diretamente em Node.js
 *      (nao depende do frontend estar rodando)
 *   2. Playwright abre esse HTML e exporta como PDF
 *   3. O PDF e enviado ao bucket "catalogos" no Supabase Storage
 *   4. Retorna a URL publica do arquivo
 */

const { chromium } = require('playwright');
const supabase = require('../supabase/client');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'catalogos';

/**
 * Gera o HTML do catalogo a partir dos dados da tabela semanal.
 *
 * @param {Array}  tabelaSemanal - linhas com joins (produtos, fornecedores)
 * @param {string} semana        - YYYY-MM-DD
 * @returns {string} HTML completo
 */
function gerarHtml(tabelaSemanal, semana) {
  const dataFormatada = semana
    ? new Date(semana + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Agrupar por categoria
  const porCategoria = {};
  tabelaSemanal.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  const linhasHtml = Object.entries(porCategoria).sort().map(([cat, itens]) => {
    const rows = itens.map(t => `
      <tr>
        <td>${t.produtos?.nome || ''}</td>
        <td style="text-align:center">${t.produtos?.unidade || 'UN'}</td>
        <td>${t.fornecedores?.nome || ''}</td>
        <td style="text-align:right">R$ ${Number(t.preco_venda).toFixed(2)}</td>
      </tr>`).join('');

    return `
      <tr class="cat-header">
        <td colspan="4">${cat.toUpperCase()}</td>
      </tr>
      ${rows}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;
           border-bottom: 3px solid #1e3a5f; padding-bottom:12px; }
  header .logo { font-size:22px; font-weight:bold; color:#1e3a5f; }
  header .logo span { color:#d4a017; }
  header .info { text-align:right; color:#555; font-size:10px; }
  header .info p { margin:2px 0; }
  h1 { font-size:13px; color:#1e3a5f; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e3a5f; color:#fff; padding:7px 10px; text-align:left;
       font-size:10px; text-transform:uppercase; letter-spacing:0.5px; }
  td { padding:6px 10px; border-bottom:1px solid #f0f0f0; }
  tr:hover td { background:#f8f9ff; }
  tr.cat-header td { background:#d4a017; color:#fff; font-weight:bold;
                     font-size:10px; letter-spacing:1px; padding:5px 10px; }
  td:last-child { font-weight:bold; color:#1e3a5f; font-size:12px; }
  footer { margin-top:24px; text-align:center; font-size:9px; color:#aaa;
           border-top:1px solid #eee; padding-top:10px; }
</style>
</head>
<body>
<header>
  <div class="logo">MERCA<span>PAN</span><br/><small style="font-size:11px;font-weight:normal;color:#555">Distribuidora</small></div>
  <div class="info">
    <p><strong>Tabela de Precos — Semana de ${dataFormatada}</strong></p>
    <p>${tabelaSemanal.length} produto(s) | Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <p style="color:#d4a017">Precos sujeitos a disponibilidade de estoque</p>
  </div>
</header>

<table>
  <thead>
    <tr>
      <th>Produto</th>
      <th style="text-align:center">UN</th>
      <th>Fornecedor</th>
      <th style="text-align:right">Preco Venda</th>
    </tr>
  </thead>
  <tbody>
    ${linhasHtml}
  </tbody>
</table>

<footer>
  Mercapan Distribuidora &bull; Tabela valida para a semana de ${dataFormatada}
</footer>
</body>
</html>`;
}

/**
 * Faz upload do buffer do PDF para o Supabase Storage.
 *
 * @param {Buffer} pdfBuffer
 * @param {string} nomeArquivo - ex: "catalogo-2024-11-04.pdf"
 * @returns {string} URL publica do arquivo
 */
async function uploadPdf(pdfBuffer, nomeArquivo) {
  const caminho = `semanas/${nomeArquivo}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,           // substitui se ja existir
    });

  if (error) throw new Error(`Erro ao fazer upload do PDF: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(caminho);

  console.log(`[PDF] Upload concluido: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Gera o PDF do catalogo e salva no Supabase Storage.
 *
 * @param {Array}  tabelaSemanal
 * @param {string} semana - YYYY-MM-DD
 * @returns {{ url: string, tamanhoBytes: number }}
 */
async function gerarEFazerUploadPdf(tabelaSemanal, semana) {
  if (!tabelaSemanal || tabelaSemanal.length === 0) {
    throw new Error('Tabela semanal vazia — nao e possivel gerar PDF');
  }

  console.log('[PDF] Iniciando geracao do catalogo...');

  const html = gerarHtml(tabelaSemanal, semana);
  const nomeArquivo = `catalogo-${semana || new Date().toISOString().split('T')[0]}.pdf`;

  // Abre Chromium headless e gera o PDF
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let pdfBuffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });

    console.log(`[PDF] Gerado (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  } finally {
    await browser.close();
  }

  // Upload para Supabase Storage
  const url = await uploadPdf(Buffer.from(pdfBuffer), nomeArquivo);

  return { url, tamanhoBytes: pdfBuffer.length };
}

module.exports = { gerarEFazerUploadPdf };
