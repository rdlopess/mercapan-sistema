import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';

const navGroups = [
  {
    items: [
      { to: '/dashboard',    label: 'Dashboard',    icon: '⬛' },
      { to: '/produtos',     label: 'Produtos',     icon: '📦' },
      { to: '/fornecedores', label: 'Fornecedores', icon: '🏭' },
      { to: '/cotacao',      label: 'Cotação',      icon: '📊' },
      { to: '/catalogo',     label: 'Catálogo',     icon: '📋' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { to: '/fotos-produtos', label: 'Fotos Produtos', icon: '📷' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { to: '/clientes', label: 'Clientes', icon: '👥' },
      { to: '/pedidos',  label: 'Pedidos',  icon: '🛒' },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/margens', label: 'Margens', icon: '💹' },
    ],
  },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const pageTitle = location.pathname.replace('/', '') || 'dashboard';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ---- Sidebar ---- */}
      <aside
        style={{ width: collapsed ? 64 : 256 }}
        className="bg-navy-600 text-white flex flex-col flex-shrink-0 transition-all duration-300"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-3 border-b border-navy-500">
          <img
            src="/logo.png"
            alt="Mercapan"
            className={`object-contain flex-shrink-0 transition-all duration-300 ${collapsed ? 'h-8 w-8' : 'h-11 w-auto'}`}
          />
          {!collapsed && (
            <div className="min-w-0" />
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-navy-300 hover:text-white flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.title && !collapsed && (
                <p className="px-4 pt-4 pb-1 text-navy-300 text-xs font-semibold uppercase tracking-widest">
                  {group.title}
                </p>
              )}
              {group.title && collapsed && <div className="my-2 mx-3 border-t border-navy-500" />}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium
                     transition-all duration-150 ${
                       isActive
                         ? 'bg-gold-500 text-white shadow-sm'
                         : 'text-navy-200 hover:bg-navy-500 hover:text-white'
                     }`
                  }
                >
                  <span className="flex-shrink-0 text-base w-5 text-center">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Rodape */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-navy-500">
            <a
              href="/catalogo-publico"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-navy-300 hover:text-gold-400 transition-colors"
            >
              <span>🔗</span> Ver Catalogo Publico
            </a>
            <p className="text-navy-500 text-xs mt-2">v1.0.0</p>
          </div>
        )}
      </aside>

      {/* ---- Conteudo ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-600 capitalize">{pageTitle}</h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <div className="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </header>

        {/* Pagina */}
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
