import { useEffect, useState } from 'react';
import api from '../lib/api';

const CATEGORIAS = ['bebidas','laticinios','embalagens','descartaveis','mercearia','doces','higiene','congelados','outros'];
const UNIDADES = ['UN','CX','FD','PCT','KG','LT','DZ'];

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ codigo:'', nome:'', categoria:'mercearia', unidade:'UN', ativo:true });
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  async function carregar() {
    try {
      const data = await api.get('/produtos');
      setProdutos(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/produtos/${editId}`, form);
      } else {
        await api.post('/produtos', form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ codigo:'', nome:'', categoria:'mercearia', unidade:'UN', ativo:true });
      carregar();
    } catch (err) {
      alert(err.message);
    }
  }

  function editar(p) {
    setForm({ codigo: p.codigo||'', nome: p.nome, categoria: p.categoria, unidade: p.unidade, ativo: p.ativo });
    setEditId(p.id);
    setShowForm(true);
  }

  async function toggleAtivo(p) {
    const acao = p.ativo ? 'Desativar' : 'Reativar';
    if (!confirm(`${acao} "${p.nome}"?`)) return;
    if (p.ativo) {
      await api.delete(`/produtos/${p.id}`);
    } else {
      await api.put(`/produtos/${p.id}`, { ...p, ativo: true });
    }
    carregar();
  }

  const filtrados = produtos.filter(p => {
    const textoOk = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(busca.toLowerCase());
    const catOk = !filtroCategoria || p.categoria === filtroCategoria;
    return textoOk && catOk;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(true); setEditId(null); setForm({ codigo:'', nome:'', categoria:'mercearia', unidade:'UN', ativo:true }); }}
        >
          + Novo Produto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nome ou codigo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-6 border-l-4 border-l-gold-500">
          <h3 className="font-semibold text-navy-800 mb-4">{editId ? 'Editar' : 'Novo'} Produto</h3>
          <form onSubmit={salvar} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Codigo</label>
              <input className="input" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Nome *</label>
              <input className="input" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="label">Unidade</label>
              <select className="input" value={form.unidade} onChange={e => setForm({...form, unidade: e.target.value})}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Categoria *</label>
              <select className="input" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-3">
              <button type="submit" className="btn-primary">Salvar produto</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-600 text-white text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Codigo</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">UN</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-navy-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.codigo || '-'}</td>
                  <td className="px-4 py-3 font-medium text-navy-800">{p.nome}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.categoria}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unidade}</td>
                  <td className="px-4 py-3">
                    <span className={p.ativo ? 'badge-ativo' : 'badge-inativo'}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      className="text-navy-600 hover:text-gold-600 text-xs font-medium transition-colors"
                      onClick={() => editar(p)}
                    >Editar</button>
                    <button
                      className={`text-xs font-medium transition-colors ${p.ativo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                      onClick={() => toggleAtivo(p)}
                    >{p.ativo ? 'Desativar' : 'Reativar'}</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-50 bg-gray-50 text-xs text-gray-400">
            {filtrados.length} de {produtos.length} produto(s)
          </div>
        </div>
      )}
    </div>
  );
}
