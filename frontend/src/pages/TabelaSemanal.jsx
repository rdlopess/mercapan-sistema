import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function TabelaSemanal() {
  const [tabela, setTabela] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [busca, setBusca] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.get('/tabela');
      setTabela(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function gerarTabela() {
    setGerando(true);
    try {
      const result = await api.post('/tabela/gerar', {});
      alert(result.message);
      carregar();
    } catch (err) {
      alert(err.message);
    } finally {
      setGerando(false);
    }
  }

  const filtrados = tabela.filter(t =>
    t.produtos?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Tabela Semanal de Preços</h2>
        <button className="btn-primary" onClick={gerarTabela} disabled={gerando}>
          {gerando ? 'Gerando...' : 'Gerar Tabela'}
        </button>
      </div>

      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Produto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Categoria</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fornecedor</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Menor Preço</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Margem</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Preço Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.produtos?.nome}</td>
                  <td className="px-4 py-3 capitalize text-gray-500">{t.produtos?.categoria}</td>
                  <td className="px-4 py-3 text-gray-600">{t.fornecedores?.nome}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    R$ {Number(t.menor_preco).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600">{t.margem}%</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    R$ {Number(t.preco_venda).toFixed(2)}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhum item na tabela. Clique em "Gerar Tabela" para criar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
