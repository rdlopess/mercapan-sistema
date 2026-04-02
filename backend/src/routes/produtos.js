const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

// GET /api/produtos
router.get('/', async (req, res) => {
  try {
    const { ativo } = req.query;
    let query = supabase.from('produtos').select('*').order('nome');
    if (ativo !== undefined) query = query.eq('ativo', ativo === 'true');
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/produtos/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gera próximo código automático no formato P001, P002, ...
async function gerarCodigoAutomatico() {
  const { data } = await supabase
    .from('produtos')
    .select('codigo')
    .like('codigo', 'P%');

  let maiorNumero = 0;
  (data || []).forEach(({ codigo }) => {
    const match = codigo && codigo.match(/^P(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maiorNumero) maiorNumero = num;
    }
  });

  const proximo = maiorNumero + 1;
  return 'P' + String(proximo).padStart(3, '0');
}

// POST /api/produtos
router.post('/', async (req, res) => {
  try {
    const { codigo, nome, categoria, unidade, ativo } = req.body;
    if (!nome || !categoria) {
      return res.status(400).json({ error: 'nome e categoria são obrigatórios' });
    }
    const codigoFinal = codigo && codigo.trim() !== ''
      ? codigo.trim()
      : await gerarCodigoAutomatico();
    const { data, error } = await supabase
      .from('produtos')
      .insert([{ codigo: codigoFinal, nome, categoria, unidade: unidade || 'UN', ativo: ativo !== false }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/produtos/:id
router.put('/:id', async (req, res) => {
  try {
    const { codigo, nome, categoria, unidade, ativo } = req.body;
    const codigoFinal = codigo && codigo.trim() !== '' ? codigo.trim() : null;
    const { data, error } = await supabase
      .from('produtos')
      .update({ codigo: codigoFinal, nome, categoria, unidade, ativo })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/produtos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: false })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Produto desativado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
