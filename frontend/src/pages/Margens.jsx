import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Margens() {
  const [margens, setMargens] = useState([]);
  const [editando, setEditando] = useState(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/margens').then(setMargens).catch(console.error);
  }, []);

  async function salvar(id) {
    setSalvando(true);
    await api.put(`/margens/${id}`, { percentual: parseFloat(valor) });
    setEditando(null);
    const data = await api.get('/margens');
    setMargens(data);
    setSalvando(false);
  }

  const corMargem = (p) => {
    if (p <= 15) return 'text-red-600';
    if (p <= 20) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div>
      <div className="mb-8">
        <div className="gold-divider" />
        <h1 className="page-title">Margens por Categoria</h1>
        <p className="text-sm text-gray-500 mt-1">
          A margem e aplicada sobre o menor preco para calcular o preco de venda final.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabela de margens */}
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-600 text-white text-xs uppercase rounded-t-xl">
                <th className="px-4 py-3 text-left rounded-tl-xl">Categoria</th>
                <th className="px-4 py-3 text-right">Margem</th>
                <th className="px-4 py-3 text-right rounded-tr-xl">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {margens.map(m => (
                <tr key={m.id} className={`hover:bg-navy-50 transition-colors ${editando === m.id ? 'bg-gold-50' : ''}`}>
                  <td className="px-4 py-3 capitalize font-medium text-navy-800">{m.categoria}</td>
                  <td className="px-4 py-3 text-right">
                    {editando === m.id ? (
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="100"
                        className="input w-24 text-right text-sm py-1"
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span className={`font-bold text-base ${corMargem(m.percentual)}`}>
                        {m.percentual}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editando === m.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          className="text-xs font-semibold text-gold-700 hover:text-gold-900 transition-colors"
                          onClick={() => salvar(m.id)}
                          disabled={salvando}
                        >Salvar</button>
                        <button
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                          onClick={() => setEditando(null)}
                        >Cancelar</button>
                      </div>
                    ) : (
                      <button
                        className="text-xs font-medium text-navy-600 hover:text-gold-600 transition-colors"
                        onClick={() => { setEditando(m.id); setValor(m.percentual); }}
                      >Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda e explicacao */}
        <div className="space-y-4">
          <div className="card bg-navy-50 border-navy-100">
            <h3 className="font-semibold text-navy-800 mb-3">Como funciona o calculo?</h3>
            <div className="bg-white rounded-lg p-4 border border-gray-100 font-mono text-sm text-gray-700 space-y-1">
              <p>Menor preco encontrado: <span className="text-navy-600 font-semibold">R$ 10,00</span></p>
              <p>Margem da categoria:    <span className="text-gold-600 font-semibold">20%</span></p>
              <div className="border-t border-gray-100 pt-2 mt-2">
                <p>Preco de venda: <span className="text-green-600 font-bold text-base">R$ 12,00</span></p>
                <p className="text-xs text-gray-400">= 10,00 x (1 + 20/100)</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-navy-800 mb-3">Legenda das cores</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">Ate 15% — margem baixa</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm text-gray-600">16% a 20% — margem media</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Acima de 20% — margem boa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
