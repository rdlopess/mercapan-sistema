import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

const EMOJI_CAT = {
  bebidas: '🥤', laticinios: '🧀', embalagens: '📦',
  descartaveis: '🥡', mercearia: '🛒', doces: '🍬',
  higiene: '🧼', congelados: '🧊', outros: '📌',
};

function ProdutoCard({ produto, onUpload, onRemover }) {
  const inputRef = useRef();
  const [carregando, setCarregando] = useState(false);
  const [preview, setPreview] = useState(produto.foto_url || null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Foto muito grande. Máximo: 5MB');
      return;
    }

    setCarregando(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const imageData = ev.target.result; // data:image/...;base64,...
      const mimeType = file.type || 'image/jpeg';
      try {
        const res = await api.post(`/materiais/foto/${produto.id}`, { imageData, mimeType });
        setPreview(res.foto_url);
        onUpload(produto.id, res.foto_url);
      } catch (err) {
        alert('Erro ao enviar foto: ' + err.message);
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemover() {
    if (!confirm(`Remover foto de "${produto.nome}"?`)) return;
    setCarregando(true);
    try {
      await api.delete(`/materiais/foto/${produto.id}`);
      setPreview(null);
      onRemover(produto.id);
    } catch (err) {
      alert('Erro ao remover foto: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Área da foto */}
      <div className="relative bg-gray-50 h-40 flex items-center justify-center group">
        {preview ? (
          <>
            <img
              src={preview}
              alt={produto.nome}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                className="bg-white text-navy-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gold-50 transition"
              >
                ✏️ Trocar
              </button>
              <button
                onClick={handleRemover}
                className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 transition"
              >
                🗑 Remover
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <span className="text-4xl">{EMOJI_CAT[produto.categoria] || '📦'}</span>
            <span className="text-xs">Sem foto</span>
          </div>
        )}
        {carregando && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-navy-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs text-gold-600 font-semibold uppercase tracking-wide mb-1">
          {EMOJI_CAT[produto.categoria] || '📦'} {produto.categoria}
        </p>
        <p className="text-sm font-semibold text-navy-800 leading-tight flex-1">{produto.nome}</p>
        <p className="text-xs text-gray-400 mt-1">{produto.unidade} · {produto.ativo ? 'Ativo' : 'Inativo'}</p>

        {!preview && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={carregando}
            className="mt-3 w-full text-xs font-semibold text-navy-600 border-2 border-dashed border-navy-200 rounded-xl py-2 hover:border-gold-400 hover:text-gold-600 transition-colors"
          >
            {carregando ? 'Enviando...' : '+ Adicionar foto'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export default function FotosProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroFoto, setFiltroFoto] = useState('todos'); // todos | com | sem
  const [filtroCategoria, setFiltroCategoria] = useState('');

  useEffect(() => {
    api.get('/materiais/fotos')
      .then(setProdutos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleUpload(id, fotoUrl) {
    setProdutos(ps => ps.map(p => p.id === id ? { ...p, foto_url: fotoUrl } : p));
  }

  function handleRemover(id) {
    setProdutos(ps => ps.map(p => p.id === id ? { ...p, foto_url: null } : p));
  }

  const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();

  const filtrados = produtos.filter(p => {
    const nomeOk = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const catOk = !filtroCategoria || p.categoria === filtroCategoria;
    const fotoOk = filtroFoto === 'todos' ? true : filtroFoto === 'com' ? !!p.foto_url : !p.foto_url;
    return nomeOk && catOk && fotoOk;
  });

  const comFoto = produtos.filter(p => p.foto_url).length;
  const semFoto = produtos.length - comFoto;

  return (
    <div>
      <div className="mb-8">
        <div className="gold-divider" />
        <h1 className="page-title">Fotos de Produtos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre a foto de cada produto uma vez — ela aparece automaticamente no Cartaz Promocional.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-navy-50 rounded-xl flex items-center justify-center text-xl">📦</div>
          <div>
            <p className="text-2xl font-bold text-navy-700">{produtos.length}</p>
            <p className="text-xs text-gray-500">Total de produtos</p>
          </div>
        </div>
        <div className="card py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">🖼️</div>
          <div>
            <p className="text-2xl font-bold text-green-600">{comFoto}</p>
            <p className="text-xs text-gray-500">Com foto</p>
          </div>
        </div>
        <div className="card py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">📷</div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{semFoto}</p>
            <p className="text-xs text-gray-500">Sem foto</p>
          </div>
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
        <select className="input w-44" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-medium">
          {[['todos', 'Todos'], ['com', '✓ Com foto'], ['sem', '○ Sem foto']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltroFoto(v)}
              className={`px-4 py-2 transition-colors ${filtroFoto === v ? 'bg-navy-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="flex items-center text-sm text-gray-400">{filtrados.length} produto(s)</span>
      </div>

      {/* Dica */}
      <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div className="text-sm text-gold-800">
          <strong>Dica:</strong> Clique em qualquer card para adicionar ou trocar a foto. Formatos aceitos: JPG, PNG, WebP. Tamanho máximo: 5MB.
          A foto aparece automaticamente ao gerar o <strong>Cartaz Promocional</strong>.
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : produtos.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400">Nenhum produto cadastrado.</p>
          <a href="/produtos" className="btn-primary inline-flex mt-4">+ Cadastrar produtos</a>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">Nenhum produto encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtrados.map(p => (
            <ProdutoCard
              key={p.id}
              produto={p}
              onUpload={handleUpload}
              onRemover={handleRemover}
            />
          ))}
        </div>
      )}
    </div>
  );
}
