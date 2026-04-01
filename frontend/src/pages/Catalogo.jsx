import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Catalogo() {
  const [tabela, setTabela] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api.get('/tabela')
      .then(setTabela)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categorias = [...new Set(tabela.map(t => t.produtos?.categoria).filter(Boolean))].sort();

  const filtrados = tabela.filter(t => {
    const nomeOk = t.produtos?.nome?.toLowerCase().includes(busca.toLowerCase());
    const catOk = !filtroCategoria || t.produtos?.categoria === filtroCategoria;
    return nomeOk && catOk;
  });

  const semana = tabela[0]?.semana
    ? new Date(tabela[0].semana + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  function copiarLink() {
    const link = `${window.location.origin}/catalogo-publico`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function imprimirPDF() {
    window.open('/catalogo-publico', '_blank');
    // O usuario pode usar Ctrl+P na pagina publica para gerar PDF
  }

  // Agrupa por categoria para exibicao
  const porCategoria = {};
  filtrados.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Catalogo Semanal</h1>
          {semana && <p className="text-sm text-gray-500 mt-1">Referencia: semana de {semana}</p>}
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={imprimirPDF}>
            🖨️ Gerar PDF
          </button>
          <button className="btn-gold" onClick={copiarLink}>
            {copiado ? '✓ Link copiado!' : '🔗 Copiar link publico'}
          </button>
        </div>
      </div>

      {/* Banner do link publico */}
      <div className="bg-navy-600 text-white rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="font-semibold">Link publico do catalogo</p>
          <p className="text-navy-200 text-sm mt-1">Compartilhe com seus clientes — sem necessidade de login</p>
          <code className="text-gold-400 text-xs mt-1 block">{window.location.origin}/catalogo-publico</code>
        </div>
        <div className="flex gap-2">
          <a
            href="/catalogo-publico"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-sm text-sm"
          >Abrir</a>
          <button className="btn-gold btn-sm text-sm" onClick={copiarLink}>
            {copiado ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input max-w-xs"
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="flex items-center text-sm text-gray-500">
          {filtrados.length} produto(s)
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tabela.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4">Nenhum produto na tabela semanal.</p>
          <a href="/cotacao" className="btn-primary inline-flex">⚡ Executar cotacao agora</a>
        </div>
      ) : (
        /* Visualizacao agrupada por categoria */
        <div className="space-y-6">
          {Object.entries(porCategoria).sort().map(([cat, itens]) => (
            <div key={cat} className="card p-0 overflow-hidden">
              <div className="px-6 py-3 bg-navy-600 text-white">
                <h3 className="font-semibold capitalize text-sm">{cat}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                    <th className="px-4 py-2.5 text-left">Produto</th>
                    <th className="px-4 py-2.5 text-left">UN</th>
                    <th className="px-4 py-2.5 text-left">Fornecedor vencedor</th>
                    <th className="px-4 py-2.5 text-right">Preco custo</th>
                    <th className="px-4 py-2.5 text-right">Margem</th>
                    <th className="px-4 py-2.5 text-right font-bold text-navy-600">Preco venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itens.map(t => (
                    <tr key={t.id} className="hover:bg-gold-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-navy-800">{t.produtos?.nome}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{t.produtos?.unidade}</td>
                      <td className="px-4 py-2.5 text-gray-500">{t.fornecedores?.nome}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">R$ {Number(t.menor_preco).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-gold-600 text-xs">{t.margem}%</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-bold text-navy-800 text-base">
                          R$ {Number(t.preco_venda).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
