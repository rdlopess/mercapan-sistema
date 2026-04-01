import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome:'', url:'', tipo:'html' });
  const [editId, setEditId] = useState(null);

  async function carregar() {
    const data = await api.get('/fornecedores');
    setFornecedores(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    if (editId) {
      await api.put(`/fornecedores/${editId}`, form);
    } else {
      await api.post('/fornecedores', form);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nome:'', url:'', tipo:'html' });
    carregar();
  }

  function editar(f) {
    setForm({ nome: f.nome, url: f.url, tipo: f.tipo });
    setEditId(f.id);
    setShowForm(true);
  }

  async function toggleAtivo(f) {
    await api.put(`/fornecedores/${f.id}`, { ...f, ativo: !f.ativo });
    carregar();
  }

  const tipoBadge = {
    html: 'bg-blue-100 text-blue-700',
    javascript: 'bg-purple-100 text-purple-700',
    api: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Fornecedores</h1>
          <p className="text-sm text-gray-500 mt-1">Sites de onde os precos sao coletados automaticamente</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(true); setEditId(null); setForm({ nome:'', url:'', tipo:'html' }); }}
        >
          + Novo Fornecedor
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-6 border-l-4 border-l-gold-500">
          <h3 className="font-semibold text-navy-800 mb-4">{editId ? 'Editar' : 'Novo'} Fornecedor</h3>
          <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Nome *</label>
              <input className="input" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="label">URL do site *</label>
              <input className="input" required type="url" placeholder="https://..." value={form.url} onChange={e => setForm({...form, url: e.target.value})} />
            </div>
            <div>
              <label className="label">Tipo de scraper</label>
              <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                <option value="html">HTML estatico (axios+cheerio)</option>
                <option value="javascript">JavaScript/SPA (Playwright)</option>
                <option value="api">API REST</option>
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary">Salvar</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Cards de fornecedores */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {fornecedores.map(f => (
            <div key={f.id} className={`card border-t-4 ${f.ativo ? 'border-t-gold-500' : 'border-t-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-navy-800">{f.nome}</h3>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-navy-400 hover:text-gold-600 truncate block max-w-[180px] mt-0.5 transition-colors"
                  >
                    {f.url}
                  </a>
                </div>
                <span className={f.ativo ? 'badge-ativo' : 'badge-inativo'}>
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tipoBadge[f.tipo] || 'bg-gray-100 text-gray-600'}`}>
                  {f.tipo === 'html' ? 'HTML' : f.tipo === 'javascript' ? 'JavaScript' : 'API'}
                </span>
                <span className="text-xs text-gray-400">
                  {f.tipo === 'html' ? 'axios + cheerio' : f.tipo === 'javascript' ? 'Playwright' : 'REST'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-secondary btn-sm flex-1 justify-center"
                  onClick={() => editar(f)}
                >Editar</button>
                <button
                  className={`btn-sm flex-1 justify-center rounded-lg font-medium text-sm transition-all ${f.ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  onClick={() => toggleAtivo(f)}
                >{f.ativo ? 'Desativar' : 'Reativar'}</button>
              </div>
            </div>
          ))}

          {fornecedores.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              Nenhum fornecedor cadastrado.
            </div>
          )}
        </div>
      )}

      {/* Info sobre os scrapers */}
      <div className="mt-8 p-4 bg-navy-50 rounded-xl border border-navy-100">
        <h4 className="font-semibold text-navy-700 text-sm mb-2">Como funcionam os scrapers?</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li><span className="font-medium text-blue-600">HTML:</span> busca precos em sites com HTML estatico usando axios + cheerio (rapido)</li>
          <li><span className="font-medium text-purple-600">JavaScript:</span> usa Playwright headless para sites SPA/React/Vue que carregam dados via JS (lento)</li>
          <li><span className="font-medium text-green-600">API:</span> consome endpoint REST do fornecedor diretamente (mais confiavel)</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          Para executar a cotacao: acesse <a href="/cotacao" className="text-gold-600 hover:underline font-medium">Cotacao</a> e clique em "Executar Cotacao Agora".
        </p>
      </div>
    </div>
  );
}
