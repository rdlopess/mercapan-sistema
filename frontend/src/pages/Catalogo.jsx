import { useEffect, useState } from 'react';
import api from '../lib/api';

const EMOJI_CAT = {
  bebidas: '🥤', laticinios: '🧀', embalagens: '📦',
  descartaveis: '🥡', mercearia: '🛒', doces: '🍬',
  higiene: '🧼', congelados: '🧊', outros: '📌',
};

// ─────────────────────────────────────────────
// Modal de Geração de Material
// ─────────────────────────────────────────────
function ModalMaterial({ tabela, onClose }) {
  const [tipo, setTipo] = useState('catalogo'); // 'catalogo' | 'cartaz'
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  // Cartaz: seleção de produtos
  const [selecionados, setSelecionados] = useState([]);
  const [titulo, setTitulo] = useState('OFERTAS DA SEMANA');
  const [subtitulo, setSubtitulo] = useState('Mercapan Distribuidora');
  const [validade, setValidade] = useState('');

  // Agrupar produtos da tabela por categoria
  const porCategoria = {};
  tabela.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  function toggleSelecionado(produtoId) {
    setSelecionados(prev => {
      if (prev.includes(produtoId)) return prev.filter(id => id !== produtoId);
      if (prev.length >= 12) { alert('Máximo de 12 produtos no cartaz.'); return prev; }
      return [...prev, produtoId];
    });
  }

  async function gerar() {
    setErro('');
    setGerando(true);
    setResultado(null);
    try {
      if (tipo === 'catalogo') {
        const res = await api.post('/materiais/catalogo', {});
        setResultado({ url: res.url, tipo: 'catalogo', produtos: res.produtos, semana: res.semana, tamanhoKb: res.tamanhoKb });
      } else {
        if (!selecionados.length) { setErro('Selecione ao menos 1 produto.'); setGerando(false); return; }
        const res = await api.post('/materiais/cartaz', { produtoIds: selecionados, titulo, subtitulo, validade });
        setResultado({ url: res.url, tipo: 'cartaz', produtos: res.produtos, tamanhoKb: res.tamanhoKb });
      }
    } catch (err) {
      setErro(err.message || 'Erro ao gerar material.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-navy-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">🎨 Gerar Material Publicitário</h2>
            <p className="text-navy-300 text-xs mt-0.5">PDF profissional pronto para impressão</p>
          </div>
          <button onClick={onClose} className="text-navy-300 hover:text-white text-xl font-bold">✕</button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {resultado ? (
            /* ── Sucesso ── */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-xl font-bold text-navy-800 mb-1">
                {resultado.tipo === 'catalogo' ? 'Catálogo gerado!' : 'Cartaz gerado!'}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {resultado.produtos} produto(s) · {resultado.tamanhoKb} KB
                {resultado.semana && ` · Semana ${resultado.semana}`}
              </p>
              <a
                href={resultado.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white font-bold py-3 px-8 rounded-xl transition-colors text-sm"
              >
                📄 Abrir PDF
              </a>
              <div className="mt-4">
                <button
                  onClick={() => { setResultado(null); setErro(''); }}
                  className="text-sm text-navy-500 hover:text-navy-700 underline"
                >
                  Gerar outro material
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Seleção de tipo ── */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: 'catalogo', label: 'Catálogo Semanal', icon: '📋', desc: 'Todos os produtos com preços, agrupados por categoria' },
                  { id: 'cartaz',   label: 'Cartaz Promocional', icon: '🎯', desc: 'Até 12 produtos em destaque com fotos e preços grandes' },
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => setTipo(op.id)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      tipo === op.id
                        ? 'border-gold-500 bg-gold-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{op.icon}</div>
                    <p className="font-semibold text-navy-800 text-sm">{op.label}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{op.desc}</p>
                  </button>
                ))}
              </div>

              {/* ── Catálogo: info simples ── */}
              {tipo === 'catalogo' && (
                <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 text-sm text-navy-700">
                  <p className="font-semibold mb-1">📋 Catálogo Semanal completo</p>
                  <p className="text-xs text-navy-500">
                    Gera um PDF A4 profissional com <strong>{tabela.length} produto(s)</strong> da semana atual,
                    agrupados por categoria, com preços de venda destacados.
                    Formato ideal para enviar a clientes por WhatsApp ou e-mail.
                  </p>
                </div>
              )}

              {/* ── Cartaz: configurações ── */}
              {tipo === 'cartaz' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Título do cartaz</label>
                      <input
                        className="input w-full text-sm"
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        placeholder="OFERTAS DA SEMANA"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Subtítulo</label>
                      <input
                        className="input w-full text-sm"
                        value={subtitulo}
                        onChange={e => setSubtitulo(e.target.value)}
                        placeholder="Mercapan Distribuidora"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Válido até (opcional)</label>
                      <input
                        className="input w-full text-sm"
                        value={validade}
                        onChange={e => setValidade(e.target.value)}
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-gray-400">
                        {selecionados.length}/12 produto(s) selecionado(s)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Selecione os produtos (máx. 12):</p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      {Object.entries(porCategoria).sort().map(([cat, itens]) => (
                        <div key={cat}>
                          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              {EMOJI_CAT[cat] || '📌'} {cat}
                            </span>
                          </div>
                          {itens.map(t => {
                            const sel = selecionados.includes(t.produto_id);
                            return (
                              <label
                                key={t.id}
                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                                  sel ? 'bg-gold-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleSelecionado(t.produto_id)}
                                  className="accent-gold-500 w-3.5 h-3.5 flex-shrink-0"
                                />
                                <span className="flex-1 text-sm text-navy-800 truncate">{t.produtos?.nome}</span>
                                {t.produtos?.foto_url && (
                                  <span title="Tem foto" className="text-xs text-green-600 flex-shrink-0">📷</span>
                                )}
                                <span className="text-sm font-bold text-navy-700 flex-shrink-0">
                                  R$ {Number(t.preco_venda).toFixed(2)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Erro */}
              {erro && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  ⚠️ {erro}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!resultado && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
            <button
              onClick={gerar}
              disabled={gerando}
              className="btn-gold text-sm flex items-center gap-2"
            >
              {gerando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>🎨 Gerar {tipo === 'catalogo' ? 'Catálogo' : 'Cartaz'}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal do Catálogo
// ─────────────────────────────────────────────
export default function Catalogo() {
  const [tabela, setTabela] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

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

  // Agrupa por categoria para exibição
  const porCategoria = {};
  filtrados.forEach(t => {
    const cat = t.produtos?.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(t);
  });

  return (
    <div>
      {modalAberto && (
        <ModalMaterial tabela={tabela} onClose={() => setModalAberto(false)} />
      )}

      <div className="page-header">
        <div>
          <div className="gold-divider" />
          <h1 className="page-title">Catálogo Semanal</h1>
          {semana && <p className="text-sm text-gray-500 mt-1">Referência: semana de {semana}</p>}
        </div>
        <div className="flex gap-3">
          <button
            className="btn-gold flex items-center gap-2"
            onClick={() => setModalAberto(true)}
            disabled={tabela.length === 0}
          >
            🎨 Gerar Material
          </button>
          <button className="btn-secondary" onClick={copiarLink}>
            {copiado ? '✓ Link copiado!' : '🔗 Copiar link'}
          </button>
        </div>
      </div>

      {/* Banner do link público */}
      <div className="bg-navy-600 text-white rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="font-semibold">Link público do catálogo</p>
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
          <a href="/cotacao" className="btn-primary inline-flex">⚡ Executar cotação agora</a>
        </div>
      ) : (
        /* Visualização agrupada por categoria */
        <div className="space-y-6">
          {Object.entries(porCategoria).sort().map(([cat, itens]) => (
            <div key={cat} className="card p-0 overflow-hidden">
              <div className="px-6 py-3 bg-navy-600 text-white flex items-center gap-2">
                <span>{EMOJI_CAT[cat] || '📌'}</span>
                <h3 className="font-semibold capitalize text-sm">{cat}</h3>
                <span className="ml-auto text-navy-300 text-xs">{itens.length} produto(s)</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                    <th className="px-4 py-2.5 text-left">Produto</th>
                    <th className="px-4 py-2.5 text-left">UN</th>
                    <th className="px-4 py-2.5 text-left">Fornecedor vencedor</th>
                    <th className="px-4 py-2.5 text-right">Preço custo</th>
                    <th className="px-4 py-2.5 text-right">Margem</th>
                    <th className="px-4 py-2.5 text-right font-bold text-navy-600">Preço venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itens.map(t => (
                    <tr key={t.id} className="hover:bg-gold-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-navy-800 flex items-center gap-2">
                        {t.produtos?.foto_url && (
                          <img
                            src={t.produtos.foto_url}
                            alt=""
                            className="w-7 h-7 rounded object-cover flex-shrink-0"
                          />
                        )}
                        {t.produtos?.nome}
                      </td>
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
