import { useEffect, useState } from 'react';
import api from '../lib/api';

const TIPOS = ['mercado','restaurante','bar','lanchonete','padaria','hortifruti','mercearia','conveniencia','outros'];

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome:'', whatsapp:'', tipo_negocio:'outros' });
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState('');

  async function carregar() {
    const data = await api.get('/clientes');
    setClientes(data);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    if (editId) {
      await api.put(`/clientes/${editId}`, form);
    } else {
      await api.post('/clientes', form);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nome:'', whatsapp:'', tipo_negocio:'outros' });
    carregar();
  }

  function editar(c) {
    setForm({ nome: c.nome, whatsapp: c.whatsapp||'', tipo_negocio: c.tipo_negocio||'outros' });
    setEditId(c.id);
    setShowForm(true);
  }

  function formatWhatsApp(num) {
    const d = num.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return num;
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.whatsapp || '').includes(busca)
  );

  const tipoIcon = {
    mercado: '🏪', restaurante: '🍽️', bar: '🍺', lanchonete: '🥪',
    padaria: '🍞', hortifruti: '🥦', mercearia: '🛒', conveniencia: '🏬', outros: '🏢',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{clientes.length} cliente(s) ativo(s)</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(true); setEditId(null); setForm({ nome:'', whatsapp:'', tipo_negocio:'outros' }); }}
        >
          + Novo Cliente
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nome ou WhatsApp..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-6 border-l-4 border-l-gold-500">
          <h3 className="font-semibold text-navy-800 mb-4">{editId ? 'Editar' : 'Novo'} Cliente</h3>
          <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Nome *</label>
              <input className="input" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input
                className="input"
                placeholder="(11) 99999-9999"
                value={form.whatsapp}
                onChange={e => setForm({...form, whatsapp: e.target.value})}
              />
            </div>
            <div>
              <label className="label">Tipo de negocio</label>
              <select className="input" value={form.tipo_negocio} onChange={e => setForm({...form, tipo_negocio: e.target.value})}>
                {TIPOS.map(t => <option key={t} value={t}>{tipoIcon[t]} {t}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary">Salvar cliente</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map(c => (
          <div key={c.id} className="card hover:shadow-navy transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-navy-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {tipoIcon[c.tipo_negocio] || '🏢'}
                </div>
                <div>
                  <p className="font-semibold text-navy-800 leading-tight">{c.nome}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.tipo_negocio}</p>
                </div>
              </div>
              <button
                className="text-xs text-navy-500 hover:text-gold-600 font-medium transition-colors"
                onClick={() => editar(c)}
              >Editar</button>
            </div>

            {c.whatsapp ? (
              <a
                href={`https://wa.me/55${c.whatsapp.replace(/\D/g,'')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium transition-colors"
              >
                <span>📱</span>
                <span>{formatWhatsApp(c.whatsapp)}</span>
              </a>
            ) : (
              <p className="text-xs text-gray-300 italic">Sem WhatsApp cadastrado</p>
            )}
          </div>
        ))}

        {filtrados.length === 0 && (
          <div className="col-span-3 py-16 text-center text-gray-400">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
