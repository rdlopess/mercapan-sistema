/**
 * routes/materiais.js
 * Endpoints para geração de materiais publicitários e gestão de fotos.
 *
 * GET  /api/materiais/fotos              - lista produtos com status de foto
 * POST /api/materiais/foto/:produtoId    - faz upload de foto de produto
 * DELETE /api/materiais/foto/:produtoId  - remove foto de produto
 * POST /api/materiais/catalogo           - gera Catálogo Semanal PDF
 * POST /api/materiais/cartaz             - gera Cartaz Promocional PDF
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase/client');
const { gerarCatalogo, gerarCartaz } = require('../services/materialGenerator');

const FOTOS_BUCKET = 'fotos-produtos';

// ─────────────────────────────────────────────
// FOTOS DE PRODUTOS
// ─────────────────────────────────────────────

/**
 * GET /api/materiais/fotos
 * Retorna todos os produtos com info de foto (url e status).
 */
router.get('/fotos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, categoria, unidade, ativo, foto_url')
      .order('categoria')
      .order('nome');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/materiais/foto/:produtoId
 * Body: { imageData: "base64string", mimeType: "image/jpeg" }
 * Faz upload da foto para Supabase Storage e atualiza foto_url no produto.
 */
router.post('/foto/:produtoId', async (req, res) => {
  try {
    const { produtoId } = req.params;
    const { imageData, mimeType = 'image/jpeg' } = req.body;

    if (!imageData) return res.status(400).json({ error: 'imageData é obrigatório' });

    // Converter base64 para buffer
    const base64 = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const caminho = `${produtoId}.${ext}`;

    // Upload para Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(FOTOS_BUCKET)
      .upload(caminho, buffer, { contentType: mimeType, upsert: true });

    if (uploadErr) throw new Error(`Upload foto: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(caminho);
    const fotoUrl = urlData.publicUrl;

    // Adicionar cache-buster para forçar reload
    const fotoUrlFinal = `${fotoUrl}?t=${Date.now()}`;

    // Atualizar foto_url no produto
    const { error: updErr } = await supabase
      .from('produtos')
      .update({ foto_url: fotoUrlFinal })
      .eq('id', produtoId);

    if (updErr) throw new Error(`Atualizar produto: ${updErr.message}`);

    console.log(`[Materiais] Foto do produto ${produtoId} atualizada.`);
    res.json({ ok: true, foto_url: fotoUrlFinal });

  } catch (err) {
    console.error('[Materiais] Erro upload foto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/materiais/foto/:produtoId
 * Remove a foto do produto do Storage e limpa foto_url.
 */
router.delete('/foto/:produtoId', async (req, res) => {
  try {
    const { produtoId } = req.params;

    // Tenta remover jpg e jpeg
    await supabase.storage.from(FOTOS_BUCKET).remove([`${produtoId}.jpg`, `${produtoId}.jpeg`, `${produtoId}.png`, `${produtoId}.webp`]);

    const { error } = await supabase
      .from('produtos')
      .update({ foto_url: null })
      .eq('id', produtoId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GERAÇÃO DE MATERIAIS
// ─────────────────────────────────────────────

/**
 * POST /api/materiais/catalogo
 * Body: { semana? } — usa semana mais recente se omitido
 * Gera o Catálogo Semanal completo em PDF.
 */
router.post('/catalogo', async (req, res) => {
  try {
    const { semana } = req.body;

    // Buscar tabela semanal (semana especificada ou a mais recente)
    let query = supabase
      .from('tabela_semanal')
      .select(`*, produtos(nome, categoria, unidade, foto_url), fornecedores(nome)`)
      .order('semana', { ascending: false });

    if (semana) {
      query = query.eq('semana', semana);
    } else {
      query = query.limit(200);
    }

    const { data: tabela, error } = await query;
    if (error) throw error;
    if (!tabela?.length) return res.status(400).json({ error: 'Nenhum produto na tabela semanal. Execute a cotação primeiro.' });

    // Se não filtrou por semana, pegar somente a semana mais recente
    const semanaRef = semana || tabela[0]?.semana;
    const tabelaFiltrada = semana ? tabela : tabela.filter(t => t.semana === semanaRef);

    const resultado = await gerarCatalogo(tabelaFiltrada, semanaRef);

    res.json({
      ok: true,
      url: resultado.url,
      tamanhoKb: Math.round(resultado.tamanhoBytes / 1024),
      produtos: tabelaFiltrada.length,
      semana: semanaRef,
    });
  } catch (err) {
    console.error('[Materiais] Erro gerar catálogo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/materiais/cartaz
 * Body: {
 *   produtoIds: string[],         // IDs dos produtos da tabela_semanal (até 12)
 *   titulo?: string,              // ex: "OFERTAS DA SEMANA"
 *   subtitulo?: string,
 *   validade?: string,            // ex: "31/12/2024"
 * }
 * Gera o Cartaz Promocional em PDF com os produtos selecionados.
 */
router.post('/cartaz', async (req, res) => {
  try {
    const { produtoIds, titulo, subtitulo, validade } = req.body;

    if (!produtoIds?.length) return res.status(400).json({ error: 'Selecione pelo menos 1 produto' });
    if (produtoIds.length > 12) return res.status(400).json({ error: 'Máximo de 12 produtos no cartaz' });

    // Buscar dados dos produtos selecionados (da tabela_semanal mais recente)
    const { data: tabela, error } = await supabase
      .from('tabela_semanal')
      .select(`*, produtos(id, nome, categoria, unidade, foto_url), fornecedores(nome)`)
      .in('produto_id', produtoIds)
      .order('semana', { ascending: false });

    if (error) throw error;
    if (!tabela?.length) return res.status(400).json({ error: 'Produtos não encontrados na tabela semanal' });

    // Manter apenas 1 entrada por produto (semana mais recente)
    const vistos = new Set();
    const produtosUnicos = tabela.filter(t => {
      if (vistos.has(t.produto_id)) return false;
      vistos.add(t.produto_id);
      return true;
    });

    // Ordenar conforme a seleção original do usuário
    const ordenados = produtoIds.map(id => produtosUnicos.find(t => t.produto_id === id)).filter(Boolean);

    const semanaRef = tabela[0]?.semana;
    const dataRef = semanaRef ? new Date(semanaRef + 'T12:00:00').toLocaleDateString('pt-BR') : '';

    const resultado = await gerarCartaz(ordenados, { titulo, subtitulo, validade, dataRef });

    res.json({
      ok: true,
      url: resultado.url,
      tamanhoKb: Math.round(resultado.tamanhoBytes / 1024),
      produtos: ordenados.length,
    });
  } catch (err) {
    console.error('[Materiais] Erro gerar cartaz:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
