const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

router.get('/', async (req, res) => {
  try {
    const { produto_id, data } = req.query;
    let query = supabase
      .from('cotacoes')
      .select('*, produtos(nome, categoria), fornecedores(nome)')
      .order('data', { ascending: false });
    if (produto_id) query = query.eq('produto_id', produto_id);
    if (data) query = query.eq('data', data);
    const { data: rows, error } = await query;
    if (error) throw error;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { produto_id, fornecedor_id, preco, data } = req.body;
    if (!produto_id || !fornecedor_id || !preco) {
      return res.status(400).json({ error: 'produto_id, fornecedor_id e preco são obrigatórios' });
    }
    const { data: row, error } = await supabase
      .from('cotacoes')
      .insert([{ produto_id, fornecedor_id, preco, data: data || new Date().toISOString().split('T')[0] }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
