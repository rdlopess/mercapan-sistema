/**
 * materialGenerator.js
 * Gera materiais publicitarios profissionais em PDF para a Mercapan.
 *
 * Materiais disponíveis:
 *   - Catálogo Semanal: lista completa de produtos com preços por categoria
 *   - Cartaz Promocional: destaque de até 12 produtos selecionados com foto
 */

const { chromium } = require('playwright');
const supabase = require('../supabase/client');
const fs = require('fs');
const path = require('path');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'catalogos';
const FOTOS_BUCKET = 'fotos-produtos';

// Logo da Mercapan em base64 para embed nos PDFs
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const LOGO_B64 = fs.existsSync(LOGO_PATH)
  ? `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
  : null;

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

function fmtData(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtPreco(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function proximaSexta() {
  const d = new Date();
  const diasAteSexta = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diasAteSexta);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const EMOJI_CATEGORIA = {
  bebidas: '🥤', laticinios: '🧀', embalagens: '📦',
  descartaveis: '🥡', mercearia: '🛒', doces: '🍬',
  higiene: '🧼', congelados: '🧊', outros: '📌',
};

async function urlParaBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// UPLOAD DO PDF PARA O SUPABASE STORAGE
// ─────────────────────────────────────────────

async function uploadPdf(buffer, caminho) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, Buffer.from(buffer), { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Upload PDF: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return data.publicUrl;
}

// ─────────────────────────────────────────────
// RENDERIZADOR HTML → PDF
// ─────────────────────────────────────────────

async function renderizarPdf(html) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────
// TEMPLATE: CATÁLOGO SEMANAL
// ─────────────────────────────────────────────

function htmlCatalogo(tabelaSemanal, semana) {
  const dataFormatada = fmtData(semana);
  const geradoEm = new Date().toLocaleString('pt-BR');
  const validade = proximaSexta();

  const porCategoria = {};
  tabelaSemanal.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  const numCategorias = Object.keys(porCategoria).length;

  const categoriasHtml = Object.entries(porCategoria).sort().map(([cat, itens]) => {
    const emoji = EMOJI_CATEGORIA[cat] || '📌';
    const rows = itens.map((t, i) => `
      <tr class="${i % 2 === 1 ? 'par' : ''}">
        <td class="td-nome">${t.produtos?.nome || ''}</td>
        <td class="td-un">${t.produtos?.unidade || 'UN'}</td>
        <td class="td-forn">${t.fornecedores?.nome || ''}</td>
        <td class="td-margem">${Number(t.margem).toFixed(1)}%</td>
        <td class="td-preco">R$&nbsp;${fmtPreco(t.preco_venda)}</td>
      </tr>`).join('');

    return `
    <div class="cat-bloco">
      <div class="cat-header">
        <div class="cat-pill">${emoji}&nbsp; ${cat.toUpperCase()}</div>
        <div class="cat-linha"></div>
        <div class="cat-count">${itens.length} produto(s)</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40%">Produto</th>
            <th style="width:7%;text-align:center">UN</th>
            <th style="width:23%">Fornecedor</th>
            <th style="width:10%;text-align:right">Margem</th>
            <th style="width:15%;text-align:right">Preço Venda</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family: Arial, Helvetica, sans-serif; background:#fff; color:#1a2332; font-size:11px; }

/* HEADER */
.header {
  background: linear-gradient(135deg, #0f2035 0%, #1e3a5f 55%, #162d4a 100%);
  padding: 20px 40px;
  display: flex; align-items: center; justify-content: space-between;
  position: relative; overflow: hidden;
}
.header::after {
  content:'';
  position:absolute; width:350px; height:350px; border-radius:50%;
  background: radial-gradient(circle, rgba(212,160,23,0.10) 0%, transparent 70%);
  top:-150px; right:-50px; pointer-events:none;
}
.logo-img { height:72px; width:auto; object-fit:contain; }
.logo-txt { font-size:34px; font-weight:900; color:#fff; letter-spacing:-1px; line-height:1; }
.logo-txt b { color:#d4a017; }
.logo-sub { font-size:9px; color:#6b92b3; letter-spacing:4px; text-transform:uppercase; margin-top:4px; }
.header-dir { text-align:right; }
.h-badge {
  display:inline-block;
  background:rgba(212,160,23,0.18); border:1px solid rgba(212,160,23,0.5);
  color:#d4a017; font-size:8px; font-weight:700; letter-spacing:2px;
  text-transform:uppercase; padding:3px 10px; border-radius:20px; margin-bottom:7px;
}
.h-title { font-size:19px; font-weight:900; color:#fff; letter-spacing:-0.3px; }
.h-date { font-size:11px; color:#7da3c8; margin-top:3px; }

/* GOLD BAR */
.gold-bar { height:5px; background:linear-gradient(90deg, #7c5807, #d4a017, #f7d038, #d4a017, #7c5807); }

/* STATS BAR */
.stats {
  background:#f8fafc; border-bottom:1px solid #e2e8f0;
  padding:9px 40px; display:flex; align-items:center; gap:24px;
}
.stat { display:flex; align-items:center; font-size:9.5px; color:#64748b; gap:6px; }
.stat-dot { width:5px; height:5px; background:#d4a017; border-radius:50%; flex-shrink:0; }
.stat strong { color:#1e3a5f; font-weight:700; }
.stat-sep { width:1px; height:14px; background:#e2e8f0; }
.stat-alerta { color:#e25c3c; }
.stat-alerta .stat-dot { background:#e25c3c; }

/* CONTENT */
.content { padding:18px 40px 28px; }

/* CATEGORY */
.cat-bloco { margin-bottom:18px; break-inside:avoid; }
.cat-header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.cat-pill {
  background: linear-gradient(135deg, #d4a017, #b8860b);
  color:#fff; font-size:9px; font-weight:800;
  letter-spacing:1.5px; padding:4px 14px; border-radius:20px;
  flex-shrink:0; box-shadow:0 2px 8px rgba(212,160,23,0.35);
}
.cat-linha { flex:1; height:1px; background:#e2e8f0; }
.cat-count { font-size:9px; color:#94a3b8; flex-shrink:0; }

/* TABLE */
table { width:100%; border-collapse:collapse; border-radius:8px; overflow:hidden; box-shadow:0 1px 5px rgba(30,58,95,0.09); }
thead { background:#1e3a5f; }
th { padding:7px 11px; font-size:8px; font-weight:700; color:#7da3c8; letter-spacing:1.5px; text-transform:uppercase; }
tbody tr { border-bottom:1px solid #f1f5f9; }
tbody tr.par { background:#f8fafc; }
tbody tr:last-child { border-bottom:none; }
td { padding:6px 11px; }
.td-nome { font-weight:600; color:#1e3a5f; font-size:10.5px; }
.td-un { text-align:center; font-size:9px; color:#94a3b8; letter-spacing:1px; text-transform:uppercase; }
.td-forn { color:#64748b; font-size:9.5px; }
.td-margem { text-align:right; color:#b8860b; font-size:9.5px; font-weight:600; }
.td-preco { text-align:right; font-weight:900; font-size:13px; color:#1e3a5f; letter-spacing:-0.3px; }

/* FOOTER */
.footer {
  margin:0 40px 28px;
  padding-top:14px; border-top:2px solid #e2e8f0;
  display:flex; align-items:center; justify-content:space-between;
}
.footer-logo-img { height:36px; width:auto; object-fit:contain; }
.footer-marca { font-size:15px; font-weight:900; color:#1e3a5f; letter-spacing:-0.5px; }
.footer-marca b { color:#d4a017; }
.footer-nota { font-size:8px; color:#94a3b8; margin-top:2px; }
.footer-valid {
  background:#fffbeb; border:1.5px solid #d4a017; border-radius:8px;
  padding:8px 18px; text-align:center;
}
.footer-valid-label { font-size:8px; color:#b8860b; letter-spacing:2px; text-transform:uppercase; }
.footer-valid-date { font-size:13px; font-weight:800; color:#1e3a5f; margin-top:2px; }
.footer-gerado { font-size:8px; color:#cbd5e1; text-align:right; line-height:1.5; }
</style>
</head>
<body>

<div class="header">
  <div>
    ${LOGO_B64
      ? `<img src="${LOGO_B64}" class="logo-img" alt="Mercapan"/>`
      : `<div class="logo-txt">MERCA<b>PAN</b></div><div class="logo-sub">Distribuidora</div>`
    }
  </div>
  <div class="header-dir">
    <div class="h-badge">📋 Tabela de Preços</div>
    <div class="h-title">CATÁLOGO SEMANAL</div>
    <div class="h-date">Semana de ${dataFormatada} &bull; ${tabelaSemanal.length} produto(s) &bull; ${numCategorias} categoria(s)</div>
  </div>
</div>
<div class="gold-bar"></div>

<div class="stats">
  <div class="stat"><span class="stat-dot"></span><strong>${tabelaSemanal.length}</strong>&nbsp;produto(s) disponíveis</div>
  <div class="stat-sep"></div>
  <div class="stat"><span class="stat-dot"></span><strong>${numCategorias}</strong>&nbsp;categoria(s)</div>
  <div class="stat-sep"></div>
  <div class="stat"><span class="stat-dot"></span>Gerado em&nbsp;<strong>${geradoEm}</strong></div>
  <div class="stat-sep"></div>
  <div class="stat stat-alerta"><span class="stat-dot"></span>Preços sujeitos à disponibilidade de estoque</div>
</div>

<div class="content">
  ${categoriasHtml}
</div>

<div class="footer">
  <div>
    ${LOGO_B64
      ? `<img src="${LOGO_B64}" class="footer-logo-img" alt="Mercapan"/>`
      : `<div class="footer-marca">MERCA<b>PAN</b></div>`
    }
    <div class="footer-nota">Distribuidora · Tabela válida para a semana de referência</div>
  </div>
  <div class="footer-valid">
    <div class="footer-valid-label">Válido até</div>
    <div class="footer-valid-date">${validade}</div>
  </div>
  <div class="footer-gerado">Gerado automaticamente<br/>pelo Sistema Mercapan<br/>${geradoEm}</div>
</div>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// TEMPLATE: CARTAZ PROMOCIONAL
// ─────────────────────────────────────────────

async function htmlCartaz(produtos, opcoes = {}) {
  const {
    titulo = 'OFERTAS DA SEMANA',
    subtitulo = 'Preços válidos enquanto durar o estoque',
    validade = proximaSexta(),
    dataRef = '',
  } = opcoes;

  const total = Math.min(produtos.length, 12);
  const cols = total <= 3 ? 3 : total <= 6 ? 3 : 4;
  const rows = Math.ceil(total / cols);

  // Buscar fotos como base64 para embed seguro
  const produtosComFoto = await Promise.all(
    produtos.slice(0, 12).map(async p => ({
      ...p,
      fotoBase64: await urlParaBase64(p.foto_url),
    }))
  );

  const cardsHtml = produtosComFoto.map(p => {
    const emoji = EMOJI_CATEGORIA[p.produtos?.categoria || p.categoria] || '📦';
    const nome = p.produtos?.nome || p.nome || '';
    const unidade = p.produtos?.unidade || p.unidade || 'UN';
    const preco = p.preco_venda || p.preco || 0;
    const fotoHtml = p.fotoBase64
      ? `<img src="${p.fotoBase64}" class="card-foto" alt="${nome}"/>`
      : `<div class="card-placeholder"><span>${emoji}</span></div>`;

    return `
    <div class="card">
      <div class="card-img">${fotoHtml}</div>
      <div class="card-body">
        <div class="card-nome">${nome}</div>
        <div class="card-un">${unidade}</div>
        <div class="card-preco-area">
          <div class="card-preco-label">Preço</div>
          <div class="card-preco">
            <span class="card-rs">R$</span>${fmtPreco(preco)}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Altura do card depende do número de linhas
  const cardH = rows === 1 ? 260 : rows === 2 ? 230 : 200;
  const fotoH = cardH - 100;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family: Arial, Helvetica, sans-serif; background:#f0f4f9; color:#1a2332; min-height:100vh; }

/* ========= HEADER HERO ========= */
.hero {
  background: linear-gradient(135deg, #0f2035 0%, #1e3a5f 45%, #162d4a 100%);
  padding: 22px 36px 18px;
  position: relative; overflow: hidden;
}
.hero::before {
  content:''; position:absolute;
  width:500px; height:500px; border-radius:50%;
  background: radial-gradient(circle, rgba(212,160,23,0.12) 0%, transparent 70%);
  top:-250px; right:-100px;
}
.hero::after {
  content:''; position:absolute;
  width:300px; height:300px; border-radius:50%;
  background: radial-gradient(circle, rgba(212,160,23,0.07) 0%, transparent 70%);
  bottom:-150px; left:50px;
}

.hero-top { display:flex; align-items:center; justify-content:space-between; position:relative; }
.hero-logo-img { height:56px; width:auto; object-fit:contain; }
.hero-logo { font-size:26px; font-weight:900; color:#fff; letter-spacing:-1px; }
.hero-logo b { color:#d4a017; }
.hero-logo-sub { font-size:8px; color:#6b92b3; letter-spacing:4px; text-transform:uppercase; margin-top:2px; }

.hero-badge {
  background:rgba(212,160,23,0.20); border:1.5px solid rgba(212,160,23,0.50);
  color:#d4a017; font-size:9px; font-weight:700; letter-spacing:2px;
  padding:5px 14px; border-radius:20px;
}

.hero-center { text-align:center; position:relative; margin-top:12px; }
.hero-titulo {
  font-size:48px; font-weight:900; color:#d4a017;
  letter-spacing:-1.5px; line-height:1;
  text-shadow: 0 3px 16px rgba(0,0,0,0.35);
}
.hero-sub {
  font-size:12px; color:#a8bdd0; letter-spacing:3px;
  text-transform:uppercase; margin-top:5px;
}

/* GOLD BAR */
.gold-bar { height:6px; background:linear-gradient(90deg, #7c5807, #d4a017, #f7d038, #f0c040, #d4a017, #7c5807); }

/* GRID AREA */
.grid-wrap { padding: 16px 20px 12px; }

.grid {
  display: grid;
  grid-template-columns: repeat(${cols}, 1fr);
  gap: 12px;
}

/* PRODUCT CARD */
.card {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(30,58,95,0.12), 0 1px 3px rgba(0,0,0,0.06);
  display: flex; flex-direction: column;
  height: ${cardH}px;
  transition: transform 0.2s;
}
.card-img { width:100%; height:${fotoH}px; overflow:hidden; flex-shrink:0; }
.card-foto { width:100%; height:100%; object-fit:cover; display:block; }
.card-placeholder {
  width:100%; height:100%;
  background: linear-gradient(135deg, #eef2f7 0%, #d5e0ed 100%);
  display:flex; align-items:center; justify-content:center;
  font-size:${fotoH * 0.45}px;
}

.card-body { padding:10px; flex:1; display:flex; flex-direction:column; }
.card-nome {
  font-size:11px; font-weight:700; color:#1e3a5f;
  line-height:1.25; flex:1;
  overflow:hidden; display:-webkit-box;
  -webkit-line-clamp:2; -webkit-box-orient:vertical;
}
.card-un { font-size:8px; color:#94a3b8; letter-spacing:1.5px; text-transform:uppercase; margin:3px 0 6px; }

.card-preco-area {
  border-top:1px solid #f1f5f9; padding-top:7px;
  display:flex; align-items:baseline; justify-content:space-between;
}
.card-preco-label { font-size:8px; color:#94a3b8; letter-spacing:1px; text-transform:uppercase; }
.card-preco { font-size:20px; font-weight:900; color:#d4a017; letter-spacing:-0.5px; line-height:1; }
.card-rs { font-size:11px; font-weight:800; vertical-align:super; margin-right:1px; }

/* FOOTER */
.footer-bar {
  background: linear-gradient(135deg, #0f2035, #1e3a5f);
  padding: 12px 36px;
  display: flex; align-items: center; justify-content: space-between;
}
.footer-valid {
  display:flex; align-items:center; gap:10px;
}
.footer-valid-icon { font-size:18px; }
.footer-valid-text {}
.footer-valid-label { font-size:8px; color:#6b92b3; letter-spacing:2px; text-transform:uppercase; }
.footer-valid-date { font-size:15px; font-weight:900; color:#fff; }

.footer-nota { font-size:9px; color:#516a84; text-align:center; line-height:1.5; }

.footer-brand { text-align:right; }
.footer-logo-img-cartaz { height:40px; width:auto; object-fit:contain; }
.footer-logo { font-size:18px; font-weight:900; color:#fff; letter-spacing:-0.5px; }
.footer-logo b { color:#d4a017; }
.footer-distribuidora { font-size:8px; color:#6b92b3; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
</style>
</head>
<body>

<div class="hero">
  <div class="hero-top">
    <div>
      ${LOGO_B64
        ? `<img src="${LOGO_B64}" class="hero-logo-img" alt="Mercapan"/>`
        : `<div class="hero-logo">MERCA<b>PAN</b></div><div class="hero-logo-sub">Distribuidora</div>`
      }
    </div>
    <div class="hero-badge">🎯 Material Promocional</div>
  </div>
  <div class="hero-center">
    <div class="hero-titulo">${titulo}</div>
    <div class="hero-sub">${subtitulo}</div>
  </div>
</div>
<div class="gold-bar"></div>

<div class="grid-wrap">
  <div class="grid">
    ${cardsHtml}
  </div>
</div>

<div class="footer-bar">
  <div class="footer-valid">
    <div class="footer-valid-icon">📅</div>
    <div class="footer-valid-text">
      <div class="footer-valid-label">Válido até</div>
      <div class="footer-valid-date">${validade}</div>
    </div>
  </div>
  <div class="footer-nota">
    Preços sujeitos à disponibilidade de estoque<br/>
    ${dataRef ? `Tabela de referência: ${dataRef}` : `Gerado em ${new Date().toLocaleDateString('pt-BR')}`}
  </div>
  <div class="footer-brand">
    ${LOGO_B64
      ? `<img src="${LOGO_B64}" class="footer-logo-img-cartaz" alt="Mercapan"/>`
      : `<div class="footer-logo">MERCA<b>PAN</b></div><div class="footer-distribuidora">Distribuidora</div>`
    }
  </div>
</div>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// FUNÇÕES EXPORTADAS
// ─────────────────────────────────────────────

/**
 * Gera o Catálogo Semanal em PDF e salva no Supabase Storage.
 * @param {Array} tabelaSemanal - linhas da tabela_semanal com joins
 * @param {string} semana - YYYY-MM-DD
 * @returns {{ url, tamanhoBytes }}
 */
async function gerarCatalogo(tabelaSemanal, semana) {
  if (!tabelaSemanal?.length) throw new Error('Tabela semanal vazia');
  console.log(`[Material] Gerando catálogo semanal (${tabelaSemanal.length} produtos)...`);

  const html = htmlCatalogo(tabelaSemanal, semana);
  const buffer = await renderizarPdf(html);
  const nome = `catalogo-semanal-${semana || new Date().toISOString().split('T')[0]}.pdf`;
  const url = await uploadPdf(buffer, `semanas/${nome}`);

  console.log(`[Material] Catálogo gerado: ${url}`);
  return { url, tamanhoBytes: buffer.length };
}

/**
 * Gera o Cartaz Promocional em PDF e salva no Supabase Storage.
 * @param {Array} produtos - lista de produtos selecionados (com foto_url, preco_venda, etc.)
 * @param {object} opcoes - { titulo, subtitulo, validade, dataRef }
 * @returns {{ url, tamanhoBytes }}
 */
async function gerarCartaz(produtos, opcoes = {}) {
  if (!produtos?.length) throw new Error('Selecione pelo menos um produto');
  const qtd = Math.min(produtos.length, 12);
  console.log(`[Material] Gerando cartaz promocional (${qtd} produtos)...`);

  const html = await htmlCartaz(produtos.slice(0, 12), opcoes);
  const buffer = await renderizarPdf(html);
  const ts = Date.now();
  const url = await uploadPdf(buffer, `materiais/cartaz-${ts}.pdf`);

  console.log(`[Material] Cartaz gerado: ${url}`);
  return { url, tamanhoBytes: buffer.length };
}

module.exports = { gerarCatalogo, gerarCartaz };
