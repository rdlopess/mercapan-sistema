const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, whatsapp, tipo_negocio } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ nome, whatsapp, tipo_negocio }])
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
    const { nome, whatsapp, tipo_negocio, ativo } = req.body;
    const { data, error } = await supabase
      .from('clientes')
      .update({ nome, whatsapp, tipo_negocio, ativo })
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
