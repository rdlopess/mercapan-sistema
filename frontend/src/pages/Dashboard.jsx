import { useEffect, useState } from 'react';
import api from '../lib/api';

function StatCard({ valor, label, icon, cor }) {
  const bordas = {
    navy:   'border-l-navy-600 bg-navy-50',
    gold:   'border-l-gold-500 bg-gold-50',
    green:  'border-l-green-500 bg-green-50',
    purple: 'border-l-purple-500 bg-purple-50',
  };
  return (
    <div className={`card border-l-4 ${bordas[cor]} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-navy-800">{valor}</p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
        <span className="text-3xl opacity-70">{icon}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ produtos: [], clientes: [], pedidos: [], tabela: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/produtos'),
      api.get('/clientes'),
      api.get('/pedidos'),
      api.get('/tabela'),
    ])
      .then(([produtos, clientes, pedidos, tabela]) =>
        setStats({ produtos, clientes, pedidos, tabela })
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  const pendentes = stats.pedidos.filter(p => ['novo', 'pendente'].includes(p.status)).length;
  const semanaInicio = new Date();
  semanaInicio.setDate(semanaInicio.getDate() - 7);
  const pedidosSemana = stats.pedidos.filter(p => new Date(p.data) >= semanaInicio).length;
  const faturamento = stats.pedidos
    .filter(p => p.status !== 'cancelado')
    .reduce((s, p) => s + Number(p.total || 0), 0);

  const contForn = {};
  stats.tabela.forEach(t => {
    const nome = t.fornecedores?.nome || 'Outro';
    contForn[nome] = (contForn[nome] || 0) + 1;
  });
  const melhorForn = Object.entries(contForn).sort((a, b) => b[1] - a[1])[0];

  const badgeStatus = {
    novo: 'badge-novo', pendente: 'badge-pendente', confirmado: 'badge-confirmado',
    comprado: 'badge-comprado', entregue: 'badge-entregue', cancelado: 'badge-cancelado',
  };

  return (
    <div>
      <div className="mb-8">
        <div className="gold-divider" />
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumo da operacao desta semana.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard valor={stats.produtos.length} label="Produtos ativos"    icon="📦" cor="navy" />
        <StatCard valor={stats.clientes.length} label="Clientes"           icon="👥" cor="gold" />
        <StatCard valor={pendentes}             label="Pedidos pendentes"   icon="⏳" cor="purple" />
        <StatCard valor={pedidosSemana}         label="Pedidos esta semana" icon="🛒" cor="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Faturamento total</p>
          <p className="text-3xl font-bold text-navy-800">
            R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Todos os pedidos nao cancelados</p>
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Tabela semanal</p>
          <p className="text-3xl font-bold text-navy-800">{stats.tabela.length}</p>
          <p className="text-xs text-gray-400 mt-1">Produtos com preco definido</p>
          {melhorForn && (
            <div className="mt-3 p-2.5 bg-gold-50 rounded-lg border border-gold-200">
              <p className="text-xs font-semibold text-gold-700">Melhor fornecedor: {melhorForn[0]}</p>
              <p className="text-xs text-gray-500">{melhorForn[1]} itens com menor preco</p>
            </div>
          )}
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Acoes rapidas</p>
          <div className="space-y-2.5">
            {[
              { href: '/cotacao',  icon: '📊', text: 'Executar cotacao semanal' },
              { href: '/catalogo', icon: '📋', text: 'Ver catalogo da semana' },
              { href: '/pedidos',  icon: '🛒', text: 'Gerenciar pedidos' },
              { href: '/produtos', icon: '📦', text: 'Cadastrar produto' },
            ].map(a => (
              <a key={a.href} href={a.href}
                className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 font-medium transition-colors">
                <span>{a.icon}</span> {a.text}
              </a>
            ))}
          </div>
        </div>
      </div>

      {stats.pedidos.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-navy-800">Ultimos pedidos</h3>
            <a href="/pedidos" className="text-sm text-gold-600 hover:underline font-medium">Ver todos</a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-600 text-white text-xs uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Data</th>
                <th className="px-6 py-3 text-left">Cliente</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.pedidos.slice(0, 6).map(p => (
                <tr key={p.id} className="hover:bg-navy-50 transition-colors">
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-3 font-medium text-navy-800">{p.clientes?.nome}</td>
                  <td className="px-6 py-3 text-right font-semibold text-navy-700">
                    R$ {Number(p.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3">
                    <span className={badgeStatus[p.status] || 'badge'}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
