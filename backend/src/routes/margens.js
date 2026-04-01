const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('margens')
      .select('*')
      .order('categoria');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { percentual } = req.body;
    const { data, error } = await supabase
      .from('margens')
      .update({ percentual })
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
