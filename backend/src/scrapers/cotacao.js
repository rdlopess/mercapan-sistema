require('dotenv').config();
const supabase = require('../supabase/client');
const atacadaoScraper = require('./atacadao');
const slapScraper = require('./slap');
const vendizapScraper = require('./vendizap');

/**
 * Mapa: nome do fornecedor no banco → instancia do scraper.
 * Adicione novos fornecedores aqui ao expandir o sistema.
 */
const SCRAPERS = {
  'Atacadão':      atacadaoScraper,
  'Slap Comercial': slapScraper,
  'Metta':         vendizapScraper,
};

// Pausa entre requisicoes para nao sobrecarregar os servidores
const PAUSA_MS = 1500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Busca o preco de um produto em um fornecedor especifico.
 * Retorna null em caso de falha (nao lanca excecao).
 *
 * @param {object} scraper - Instancia do scraper
 * @param {string} nomeProduto
 * @returns {{ preco: number|null, encontrado: boolean, url: string }}
 */
async function buscarComFornecedor(scraper, nomeProduto) {
  try {
    const resultado = await scraper.buscarPreco(nomeProduto);
    return resultado;
  } catch (err) {
    console.error(`[cotacao] Erro inesperado no scraper "${scraper.nomeFornecedor}": ${err.message}`);
    return { preco: null, encontrado: false, url: '' };
  }
}

/**
 * Orquestra a cotacao de todos os produtos ativos em todos os fornecedores ativos.
 *
 * Fluxo:
 *  1. Le produtos ativos do Supabase
 *  2. Le fornecedores ativos do Supabase
 *  3. Para cada produto, busca preco nos 3 fornecedores (em paralelo ou sequencial)
 *  4. Identifica o menor preco e o fornecedor vencedor
 *  5. Aplica a margem da categoria do produto
 *  6. Salva o resultado em tabela_semanal
 *
 * @param {{ produtosTeste?: string[] }} opcoes - Opcional: lista de nomes de produtos para teste
 * @returns {object} Relatorio com resultados
 */
async function executarCotacao(opcoes = {}) {
  const inicio = Date.now();
  console.log('\n=== INICIO DA COTACAO ===');
  console.log(`Horario: ${new Date().toLocaleString('pt-BR')}`);

  // -------------------------------------------------------
  // 1. Buscar dados do banco
  // -------------------------------------------------------
  const { data: todosProdutos, error: errProd } = await supabase
    .from('produtos')
    .select('id, nome, categoria')
    .eq('ativo', true)
    .order('nome');

  if (errProd) throw new Error(`Erro ao buscar produtos: ${errProd.message}`);
  if (!todosProdutos || todosProdutos.length === 0) {
    console.log('Nenhum produto ativo encontrado.');
    return { geradas: 0, erros: 0 };
  }

  // Filtro de teste: usa apenas os produtos especificados
  const produtos = opcoes.produtosTeste
    ? todosProdutos.filter(p =>
        opcoes.produtosTeste.some(nome =>
          p.nome.toLowerCase().includes(nome.toLowerCase())
        )
      )
    : todosProdutos;

  console.log(`Produtos a cotar: ${produtos.length}`);

  // Busca fornecedores ativos
  const { data: fornecedoresBanco, error: errForn } = await supabase
    .from('fornecedores')
    .select('id, nome')
    .eq('ativo', true);

  if (errForn) throw new Error(`Erro ao buscar fornecedores: ${errForn.message}`);

  // Filtra apenas os fornecedores que tem scraper implementado
  const fornecedoresAtivos = (fornecedoresBanco || []).filter(f => SCRAPERS[f.nome]);
  console.log(`Fornecedores ativos com scraper: ${fornecedoresAtivos.map(f => f.nome).join(', ')}`);

  if (fornecedoresAtivos.length === 0) {
    console.log('Nenhum fornecedor com scraper disponivel.');
    return { geradas: 0, erros: 0 };
  }

  // Busca margens por categoria
  const { data: margens } = await supabase.from('margens').select('*');
  const margemMap = {};
  (margens || []).forEach(m => { margemMap[m.categoria] = Number(m.percentual); });

  // -------------------------------------------------------
  // 2. Cotar cada produto em todos os fornecedores
  // -------------------------------------------------------
  const hoje = new Date().toISOString().split('T')[0];
  const linhasTabela = [];
  const relatorio = [];
  let erros = 0;

  for (const produto of produtos) {
    console.log(`\n--- Produto: "${produto.nome}" (${produto.categoria}) ---`);
    const resultadosPorFornecedor = [];

    for (const fornecedor of fornecedoresAtivos) {
      const scraper = SCRAPERS[fornecedor.nome];
      const resultado = await buscarComFornecedor(scraper, produto.nome);

      resultadosPorFornecedor.push({
        fornecedor_id: fornecedor.id,
        fornecedor_nome: fornecedor.nome,
        ...resultado,
      });

      // Salva cotacao individual no banco (historico)
      if (resultado.preco !== null) {
        await supabase.from('cotacoes').insert({
          produto_id: produto.id,
          fornecedor_id: fornecedor.id,
          preco: resultado.preco,
          data: hoje,
        });
      } else {
        erros++;
      }

      // Pausa entre fornecedores
      await sleep(PAUSA_MS);
    }

    // Identifica o menor preco entre os fornecedores
    const validos = resultadosPorFornecedor.filter(r => r.preco !== null);

    if (validos.length === 0) {
      console.log(`  AVISO: Nenhum preco encontrado para "${produto.nome}"`);
      relatorio.push({ produto: produto.nome, status: 'sem_preco' });
      continue;
    }

    const melhor = validos.reduce((a, b) => a.preco <= b.preco ? a : b);

    // Aplica margem da categoria
    const margem = margemMap[produto.categoria] ?? margemMap['outros'] ?? 20;
    const preco_venda = +(melhor.preco * (1 + margem / 100)).toFixed(2);

    console.log(`  Menor preco: R$ ${melhor.preco} (${melhor.fornecedor_nome})`);
    console.log(`  Margem ${produto.categoria}: ${margem}%  →  Preco venda: R$ ${preco_venda}`);

    linhasTabela.push({
      produto_id: produto.id,
      menor_preco: melhor.preco,
      fornecedor_id: melhor.fornecedor_id,
      margem,
      preco_venda,
      semana: hoje,
    });

    relatorio.push({
      produto: produto.nome,
      categoria: produto.categoria,
      menor_preco: melhor.preco,
      fornecedor: melhor.fornecedor_nome,
      margem,
      preco_venda,
      status: 'ok',
      cotacoes: resultadosPorFornecedor.map(r => ({
        fornecedor: r.fornecedor_nome,
        preco: r.preco,
        encontrado: r.encontrado,
      })),
    });
  }

  // -------------------------------------------------------
  // 3. Salvar tabela_semanal (remove registros do dia e re-insere)
  // -------------------------------------------------------
  if (linhasTabela.length > 0) {
    // Remove registros da mesma semana para os produtos cotados
    const produtoIds = linhasTabela.map(l => l.produto_id);
    await supabase
      .from('tabela_semanal')
      .delete()
      .eq('semana', hoje)
      .in('produto_id', produtoIds);

    const { error: errTabela } = await supabase
      .from('tabela_semanal')
      .insert(linhasTabela);

    if (errTabela) {
      console.error('Erro ao salvar tabela_semanal:', errTabela.message);
    } else {
      console.log(`\n${linhasTabela.length} linha(s) salva(s) na tabela_semanal.`);
    }
  }

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n=== COTACAO CONCLUIDA em ${duracao}s ===`);
  console.log(`Produtos cotados: ${linhasTabela.length} | Erros: ${erros}`);

  return {
    geradas: linhasTabela.length,
    erros,
    duracao_segundos: Number(duracao),
    relatorio,
  };
}

// -------------------------------------------------------
// Execucao direta para TESTE: node src/scrapers/cotacao.js
// -------------------------------------------------------
if (require.main === module) {
  // Produtos de teste (nomes parciais)
  const produtosTeste = [
    'oleo de soja',
    'agua mineral',
    'arroz',
  ];

  console.log('MODO TESTE — cotando apenas:', produtosTeste);

  executarCotacao({ produtosTeste })
    .then(resultado => {
      console.log('\n=== RESULTADO DO TESTE ===');
      console.log(JSON.stringify(resultado, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Erro fatal:', err);
      process.exit(1);
    });
}

module.exports = { executarCotacao };
