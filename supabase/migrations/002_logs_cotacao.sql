-- =============================================
-- MERCAPAN SISTEMA - Tabela de logs de cotacao
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS logs_cotacao (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  iniciado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_em  TIMESTAMPTZ,
  origem        TEXT        NOT NULL DEFAULT 'agendador'
                            CHECK (origem IN ('agendador', 'manual')),
  status        TEXT        NOT NULL DEFAULT 'em_andamento'
                            CHECK (status IN ('em_andamento', 'concluido', 'erro')),
  produtos_cotados  INT     DEFAULT 0,
  erros             INT     DEFAULT 0,
  duracao_segundos  NUMERIC(8,1),
  pdf_url           TEXT,
  sheets_atualizado BOOLEAN DEFAULT FALSE,
  mensagem_erro     TEXT,
  detalhes          JSONB   -- relatorio completo por produto
);

-- Index para buscar logs recentes rapidamente
CREATE INDEX IF NOT EXISTS idx_logs_cotacao_iniciado
  ON logs_cotacao (iniciado_em DESC);

-- Index por status (para encontrar execucoes em andamento)
CREATE INDEX IF NOT EXISTS idx_logs_cotacao_status
  ON logs_cotacao (status);

-- Comentario
COMMENT ON TABLE logs_cotacao IS
  'Registra cada execucao de cotacao: automatica (agendador) ou manual (painel).';
