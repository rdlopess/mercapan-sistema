-- =============================================
-- MERCAPAN SISTEMA - Schema Inicial
-- Execute no SQL Editor do Supabase
-- =============================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABELA: produtos
-- =============================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: fornecedores
-- =============================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('html', 'javascript', 'api')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: margens
-- =============================================
CREATE TABLE IF NOT EXISTS margens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria TEXT UNIQUE NOT NULL,
  percentual NUMERIC(5,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: cotacoes
-- =============================================
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  preco NUMERIC(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: tabela_semanal
-- =============================================
CREATE TABLE IF NOT EXISTS tabela_semanal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  menor_preco NUMERIC(10,2) NOT NULL,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  margem NUMERIC(5,2) NOT NULL,
  preco_venda NUMERIC(10,2) NOT NULL,
  semana DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: clientes
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  whatsapp TEXT,
  tipo_negocio TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: pedidos
-- =============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','entregue','cancelado')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: itens_pedido
-- =============================================
CREATE TABLE IF NOT EXISTS itens_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  qtd NUMERIC(10,3) NOT NULL,
  preco_venda NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_cotacoes_produto ON cotacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_data ON cotacoes(data);
CREATE INDEX IF NOT EXISTS idx_tabela_semanal_semana ON tabela_semanal(semana);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);

-- =============================================
-- SEEDS: Margens padrão
-- =============================================
INSERT INTO margens (categoria, percentual) VALUES
  ('bebidas', 15.00),
  ('laticinios', 18.00),
  ('embalagens', 25.00),
  ('descartaveis', 25.00),
  ('mercearia', 20.00),
  ('doces', 22.00),
  ('higiene', 20.00),
  ('congelados', 18.00),
  ('outros', 20.00)
ON CONFLICT (categoria) DO NOTHING;

-- =============================================
-- SEEDS: Fornecedores iniciais
-- =============================================
INSERT INTO fornecedores (nome, url, tipo) VALUES
  ('Atacadão', 'https://www.atacadao.com.br', 'html'),
  ('Slap Comercial', 'https://www.slapcomercial.com.br', 'html'),
  ('Metta', 'https://distribuidorametta.vendizap.com', 'javascript')
ON CONFLICT DO NOTHING;

-- =============================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produtos_updated
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_pedidos_updated
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_clientes_updated
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
