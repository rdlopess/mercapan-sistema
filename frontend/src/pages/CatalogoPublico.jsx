import { useEffect, useState } from 'react';
import api from '../lib/api';

/**
 * Pagina publica do catalogo — acessivel sem login.
 * Rota: /catalogo-publico
 * Clientes podem ver os precos da semana e enviar pedido via WhatsApp.
 */
export default function CatalogoPublico() {
  const [tabela, setTabela] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [showCarrinho, setShowCarrinho] = useState(false);

  // Numero do WhatsApp da distribuidora (ajustar conforme necessidade)
  const WHATSAPP_DISTRIBUIDORA = '5511999999999';

  useEffect(() => {
    api.get('/tabela')
      .then(setTabela)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const semana = tabela[0]?.semana
    ? new Date(tabela[0].semana + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const categorias = [...new Set(tabela.map(t => t.produtos?.categoria).filter(Boolean))].sort();

  const filtrados = tabela.filter(t =>
    t.produtos?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const porCategoria = {};
  filtrados.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  function addCarrinho(item) {
    setCarrinho(prev => {
      const existe = prev.find(c => c.produto_id === item.produto_id);
      if (existe) {
        return prev.map(c =>
          c.produto_id === item.produto_id ? { ...c, qtd: c.qtd + 1 } : c
        );
      }
      return [...prev, { ...item, qtd: 1 }];
    });
  }

  function removeCarrinho(produto_id) {
    setCarrinho(prev => prev.filter(c => c.produto_id !== produto_id));
  }

  function updateQtd(produto_id, qtd) {
    const n = parseFloat(qtd);
    if (isNaN(n) || n <= 0) return removeCarrinho(produto_id);
    setCarrinho(prev => prev.map(c => c.produto_id === produto_id ? { ...c, qtd: n } : c));
  }

  const totalCarrinho = carrinho.reduce((s, c) => s + c.qtd * c.preco_venda, 0);

  function enviarPedidoWhatsApp() {
    if (!nomeCliente.trim()) {
      alert('Por favor, informe seu nome antes de enviar o pedido.');
      return;
    }

    const linhas = carrinho.map(c =>
      `• ${c.produtos?.nome} — ${c.qtd} ${c.produtos?.unidade || 'UN'} x R$ ${Number(c.preco_venda).toFixed(2)} = R$ ${(c.qtd * c.preco_venda).toFixed(2)}`
    );

    const mensagem = [
      `*Pedido Mercapan* — ${new Date().toLocaleDateString('pt-BR')}`,
      `Cliente: *${nomeCliente}*`,
      ``,
      `*Itens:*`,
      ...linhas,
      ``,
      `*Total: R$ ${totalCarrinho.toFixed(2)}*`,
    ].join('\n');

    const url = `https://wa.me/${WHATSAPP_DISTRIBUIDORA}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <header className="bg-navy-600 text-white py-6 px-4 print:bg-white print:text-navy-900">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold-500 rounded-xl flex items-center justify-center font-bold text-white text-2xl shadow-gold">
                M
              </div>
              <div>
                <h1 className="text-xl font-bold">Mercapan Distribuidora</h1>
                <p className="text-navy-200 text-sm">Catalogo de Precos — {semana || 'Esta semana'}</p>
              </div>
            </div>
            {carrinho.length > 0 && (
              <button
                onClick={() => setShowCarrinho(true)}
                className="relative bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors print:hidden"
              >
                🛒 Meu Pedido
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {carrinho.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Busca */}
      <div className="bg-white border-b border-gray-100 py-4 px-4 print:hidden">
        <div className="max-w-5xl mx-auto">
          <input
            className="w-full max-w-md border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            placeholder="Buscar produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Conteudo */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Carregando catalogo...</p>
          </div>
        ) : tabela.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-semibold mb-2">Catalogo indisponivel</p>
            <p className="text-sm">O catalogo desta semana ainda nao foi publicado. Tente novamente em breve.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(porCategoria).sort().map(([cat, itens]) => (
              <div key={cat}>
                <h2 className="text-base font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-gold-500 inline-block" />
                  {cat}
                </h2>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-navy-600 text-white text-xs">
                        <th className="px-4 py-3 text-left">Produto</th>
                        <th className="px-4 py-3 text-center">UN</th>
                        <th className="px-4 py-3 text-right font-bold">Preco</th>
                        <th className="px-4 py-3 text-center print:hidden">Pedir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {itens.map(t => {
                        const noCarrinho = carrinho.find(c => c.produto_id === t.produto_id);
                        return (
                          <tr key={t.id} className="hover:bg-gold-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-navy-800">{t.produtos?.nome}</td>
                            <td className="px-4 py-3 text-center text-gray-400 text-xs">{t.produtos?.unidade}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-navy-800 text-base">
                                R$ {Number(t.preco_venda).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center print:hidden">
                              {noCarrinho ? (
                                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                  ✓ {noCarrinho.qtd}x
                                </span>
                              ) : (
                                <button
                                  onClick={() => addCarrinho(t)}
                                  className="bg-navy-600 hover:bg-gold-500 text-white text-xs font-semibold py-1 px-3 rounded-lg transition-colors"
                                >
                                  + Pedir
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rodape */}
        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Precos validos para a semana de {semana}.</p>
          <p className="mt-1">Distribuidora Mercapan — sujeito a disponibilidade de estoque.</p>
        </div>
      </main>

      {/* Modal do carrinho */}
      {showCarrinho && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-navy-800">Meu Pedido</h3>
              <button onClick={() => setShowCarrinho(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="px-6 py-4">
              {/* Nome do cliente */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Ex: Padaria Sao Jose"
                  value={nomeCliente}
                  onChange={e => setNomeCliente(e.target.value)}
                />
              </div>

              {/* Itens */}
              <div className="space-y-3 mb-4">
                {carrinho.map(c => (
                  <div key={c.produto_id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy-800 truncate">{c.produtos?.nome}</p>
                      <p className="text-xs text-gray-400">R$ {Number(c.preco_venda).toFixed(2)} / {c.produtos?.unidade}</p>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="w-16 border border-gray-200 rounded text-center text-sm py-1"
                      value={c.qtd}
                      onChange={e => updateQtd(c.produto_id, e.target.value)}
                    />
                    <span className="text-sm font-semibold text-navy-700 w-20 text-right">
                      R$ {(c.qtd * c.preco_venda).toFixed(2)}
                    </span>
                    <button onClick={() => removeCarrinho(c.produto_id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>

              <div className="bg-navy-50 rounded-xl p-3 mb-4 text-right">
                <span className="text-sm text-gray-500">Total: </span>
                <span className="font-bold text-navy-800 text-xl">R$ {totalCarrinho.toFixed(2)}</span>
              </div>

              <button
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                onClick={enviarPedidoWhatsApp}
              >
                📱 Enviar pedido pelo WhatsApp
              </button>
              <p className="text-xs text-center text-gray-400 mt-2">
                Voce sera redirecionado ao WhatsApp da distribuidora.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
