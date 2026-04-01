const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

// GET /api/pedidos
router.get('/', async (req, res) => {
  try {
    const { status, cliente_id } = req.query;
    let query = supabase
      .from('pedidos')
      .select('*, clientes(nome, whatsapp)')
      .order('data', { ascending: false });
    if (status) query = query.eq('status', status);
    if (cliente_id) query = query.eq('cliente_id', cliente_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/:id (com itens)
router.get('/:id', async (req, res) => {
  try {
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nome, whatsapp)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    const { data: itens, error: errItens } = await supabase
      .from('itens_pedido')
      .select('*, produtos(nome, unidade)')
      .eq('pedido_id', req.params.id);
    if (errItens) throw errItens;

    res.json({ ...pedido, itens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pedidos
router.post('/', async (req, res) => {
  try {
    const { cliente_id, data, itens } = req.body;
    if (!cliente_id || !itens || itens.length === 0) {
      return res.status(400).json({ error: 'cliente_id e itens são obrigatórios' });
    }

    const total = itens.reduce((sum, item) => sum + item.qtd * item.preco_venda, 0);

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert([{ cliente_id, data: data || new Date().toISOString().split('T')[0], total }])
      .select()
      .single();
    if (error) throw error;

    const linhasItens = itens.map(item => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      qtd: item.qtd,
      preco_venda: item.preco_venda,
    }));

    const { error: errItens } = await supabase.from('itens_pedido').insert(linhasItens);
    if (errItens) throw errItens;

    res.status(201).json({ ...pedido, itens: linhasItens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('pedidos')
      .update({ status })
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
