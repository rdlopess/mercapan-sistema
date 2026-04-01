require('dotenv').config();
const express = require('express');
const cors = require('cors');

const produtosRoutes = require('./routes/produtos');
const fornecedoresRoutes = require('./routes/fornecedores');
const margensRoutes = require('./routes/margens');
const cotacoesRoutes = require('./routes/cotacoes');
const tabelaRoutes = require('./routes/tabela');
const clientesRoutes = require('./routes/clientes');
const pedidosRoutes = require('./routes/pedidos');
const scraperRoutes = require('./routes/scraper');
const cotacaoRoutes = require('./routes/cotacao');

// Agendador de tarefas
require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
// Aceita: localhost dev + dominio do Vercel + qualquer subdominio *.vercel.app
const origensPermitidas = [
  'http://localhost:5173',
  'http://localhost:4173',  // vite preview
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origem (ex: curl, Postman, Railway health check)
    if (!origin) return callback(null, true);
    // Permitir dominios configurados
    if (origensPermitidas.includes(origin)) return callback(null, true);
    // Permitir qualquer subdominio *.vercel.app e *.railway.app
    if (/\.(vercel\.app|railway\.app)$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origem nao permitida — ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas
app.use('/api/produtos', produtosRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/margens', margensRoutes);
app.use('/api/cotacoes', cotacoesRoutes);
app.use('/api/tabela', tabelaRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/cotacao', cotacaoRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Mercapan Backend rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
