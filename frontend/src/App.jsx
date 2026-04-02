import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Fornecedores from './pages/Fornecedores';
import Cotacao from './pages/Cotacao';
import Catalogo from './pages/Catalogo';
import CatalogoPublico from './pages/CatalogoPublico';
import Clientes from './pages/Clientes';
import Pedidos from './pages/Pedidos';
import Margens from './pages/Margens';
import FotosProdutos from './pages/FotosProdutos';

export default function App() {
  return (
    <Routes>
      {/* Pagina publica do catalogo — sem sidebar/login */}
      <Route path="/catalogo-publico" element={<CatalogoPublico />} />

      {/* Sistema interno com sidebar */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<Dashboard />} />
        <Route path="produtos"       element={<Produtos />} />
        <Route path="fornecedores"   element={<Fornecedores />} />
        <Route path="cotacao"        element={<Cotacao />} />
        <Route path="catalogo"       element={<Catalogo />} />
        <Route path="clientes"       element={<Clientes />} />
        <Route path="pedidos"        element={<Pedidos />} />
        <Route path="margens"        element={<Margens />} />
        <Route path="fotos-produtos" element={<FotosProdutos />} />
      </Route>
    </Routes>
  );
}
