const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, url, tipo } = req.body;
    if (!nome || !url || !tipo) {
      return res.status(400).json({ error: 'nome, url e tipo são obrigatórios' });
    }
    const { data, error } = await supabase
      .from('fornecedores')
      .insert([{ nome, url, tipo }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, url, tipo, ativo } = req.body;
    const { data, error } = await supabase
      .from('fornecedores')
      .update({ nome, url, tipo, ativo })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
