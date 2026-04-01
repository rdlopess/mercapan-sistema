import { useEffect, useState } from 'react';
import api from '../lib/api';

const STATUS_LIST = ['novo','confirmado','comprado','entregue','cancelado'];

const badgeCor = {
  novo: 'badge-novo', confirmado: 'badge-confirmado',
  comprado: 'badge-comprado', entregue: 'badge-entregue',
  cancelado: 'badge-cancelado',
};

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [tabela, setTabela] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cliente_id: '', data: new Date().toISOString().split('T')[0], itens: [] });
  const [filtroStatus, setFiltroStatus] = useState('');

  async function carregar() {
    const [p, c, pr, tab] = await Promise.all([
      api.get('/pedidos' + (filtroStatus ? `?status=${filtroStatus}` : '')),
      api.get('/clientes'),
      api.get('/produtos'),
      api.get('/tabela'),
    ]);
    setPedidos(p);
    setClientes(c);
    setProdutos(pr);
    setTabela(tab);
  }

  useEffect(() => { carregar(); }, [filtroStatus]);

  function addItem() {
    setForm(f => ({ ...f, itens: [...f.itens, { produto_id: '', qtd: 1, preco_venda: '' }] }));
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  function updateItem(idx, field, value) {
    setForm(f => {
      const itens = [...f.itens];
      itens[idx] = { ...itens[idx], [field]: value };
      // Auto-preenche preco da tabela semanal
      if (field === 'produto_id') {
        const item = tabela.find(t => t.produto_id === value);
        if (item) itens[idx].preco_venda = item.preco_venda;
      }
      return { ...f, itens };
    });
  }

  async function salvar(e) {
    e.preventDefault();
    if (form.itens.length === 0) return alert('Adicione ao menos um item.');
    await api.post('/pedidos', form);
    setShowForm(false);
    setForm({ cliente_id: '', data: new Date().toISOString().split('T')[0], itens: [] });
    carregar();
  }

  async function mudarStatus(id, status) {
    await api.patch(`/pedidos/${id}/status`, { status });
    carregar();
  }

  const total = form.itens.reduce((s, i) => s + (Number(i.qtd) * Number(i.preco_venda || 0)), 0);

  const totalPedidos = pedidos.reduce((s, p) => s + Number(p.total || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pedidos.length} pedido(s) — Total: R$ {totalPedidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Novo Pedido</button>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['', ...STATUS_LIST].map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroStatus === s
                ? 'bg-navy-600 text-white border-navy-600'
                : 'border-gray-300 text-gray-600 hover:border-navy-400'
            }`}
          >
            {s || 'Todos'}
          </button>
        ))}
      </div>

      {/* Formulario de novo pedido */}
      {showForm && (
        <div className="card mb-6 border-l-4 border-l-gold-500">
          <h3 className="font-semibold text-navy-800 mb-4">Novo Pedido</h3>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Cliente *</label>
                <select className="input" required value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}>
                  <option value="">Selecione o cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Data</label>
                <input type="date" className="input" value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
              </div>
            </div>

            {/* Itens */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Itens do pedido</label>
                <button type="button" className="btn-secondary btn-sm text-xs" onClick={addItem}>+ Adicionar item</button>
              </div>
              {form.itens.length === 0 && (
                <p className="text-sm text-gray-400 italic py-3">Nenhum item. Clique em "+ Adicionar item".</p>
              )}
              {form.itens.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-5">
                    <select
                      className="input text-sm"
                      value={item.produto_id}
                      onChange={e => updateItem(idx, 'produto_id', e.target.value)}
                    >
                      <option value="">Produto...</option>
                      {produtos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      className="input text-sm"
                      placeholder="Qtd"
                      value={item.qtd}
                      onChange={e => updateItem(idx, 'qtd', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-sm"
                      placeholder="R$ Preco venda"
                      value={item.preco_venda}
                      onChange={e => updateItem(idx, 'preco_venda', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-600 text-xl font-bold leading-none transition-colors"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>

            {form.itens.length > 0 && (
              <div className="flex justify-end mb-4">
                <div className="bg-navy-50 px-4 py-2 rounded-lg">
                  <span className="text-sm text-gray-500">Total do pedido: </span>
                  <span className="font-bold text-navy-800 text-lg">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" className="btn-primary">Salvar pedido</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de pedidos */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-600 text-white text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Alterar status</th>
              <th className="px-4 py-3 text-left">WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pedidos.map(p => (
              <tr key={p.id} className="hover:bg-navy-50 transition-colors">
                <td className="px-4 py-3 text-gray-500">
                  {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 font-medium text-navy-800">{p.clientes?.nome}</td>
                <td className="px-4 py-3 text-right font-semibold text-navy-700">
                  R$ {Number(p.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={badgeCor[p.status] || 'badge'}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                    value={p.status}
                    onChange={e => mudarStatus(p.id, e.target.value)}
                  >
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {p.clientes?.whatsapp ? (
                    <a
                      href={`https://wa.me/55${p.clientes.whatsapp.replace(/\D/g,'')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-600 hover:text-green-800 text-xs font-medium transition-colors"
                    >
                      📱 Contatar
                    </a>
                  ) : (
                    <span className="text-gray-300 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
