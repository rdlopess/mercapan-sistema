const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

// GET /api/tabela - tabela semanal mais recente
router.get('/', async (req, res) => {
  try {
    const { semana } = req.query;
    let query = supabase
      .from('tabela_semanal')
      .select('*, produtos(nome, categoria, unidade), fornecedores(nome)')
      .order('semana', { ascending: false });
    if (semana) {
      query = query.eq('semana', semana);
    } else {
      // Pega a semana mais recente
      const { data: latest } = await supabase
        .from('tabela_semanal')
        .select('semana')
        .order('semana', { ascending: false })
        .limit(1);
      if (latest && latest.length > 0) {
        query = query.eq('semana', latest[0].semana);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tabela/gerar - gera tabela semanal com base nas cotações mais recentes
router.post('/gerar', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // Busca todos os produtos ativos
    const { data: produtos, error: errProd } = await supabase
      .from('produtos')
      .select('id, categoria')
      .eq('ativo', true);
    if (errProd) throw errProd;

    // Busca margens
    const { data: margens, error: errMarg } = await supabase
      .from('margens')
      .select('*');
    if (errMarg) throw errMarg;

    const margemMap = {};
    margens.forEach(m => { margemMap[m.categoria] = m.percentual; });

    const linhas = [];

    for (const produto of produtos) {
      // Pega a cotação mais barata dos últimos 7 dias
      const { data: cotacoes } = await supabase
        .from('cotacoes')
        .select('preco, fornecedor_id')
        .eq('produto_id', produto.id)
        .gte('data', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
        .order('preco', { ascending: true })
        .limit(1);

      if (!cotacoes || cotacoes.length === 0) continue;

      const melhor = cotacoes[0];
      const margem = margemMap[produto.categoria] || margemMap['outros'] || 20;
      const preco_venda = +(melhor.preco * (1 + margem / 100)).toFixed(2);

      linhas.push({
        produto_id: produto.id,
        menor_preco: melhor.preco,
        fornecedor_id: melhor.fornecedor_id,
        margem,
        preco_venda,
        semana: hoje,
      });
    }

    if (linhas.length === 0) {
      return res.json({ message: 'Nenhuma cotação recente encontrada', geradas: 0 });
    }

    // Remove tabela anterior da mesma semana e insere nova
    await supabase.from('tabela_semanal').delete().eq('semana', hoje);
    const { data, error } = await supabase.from('tabela_semanal').insert(linhas).select();
    if (error) throw error;

    res.json({ message: 'Tabela semanal gerada com sucesso', geradas: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
