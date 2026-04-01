const { chromium } = require('playwright');
const supabase = require('../supabase/client');

/**
 * Scraper da Metta (JavaScript - usa Playwright headless)
 */
async function rasparMetta() {
  console.log('Raspando Metta (modo JavaScript)...');

  const { data: fornecedores } = await supabase
    .from('fornecedores')
    .select('id')
    .eq('nome', 'Metta')
    .single();

  if (!fornecedores) throw new Error('Fornecedor Metta não encontrado no banco');
  const fornecedor_id = fornecedores.id;

  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome')
    .eq('ativo', true);

  if (!produtos || produtos.length === 0) {
    return { salvos: 0, mensagem: 'Nenhum produto ativo cadastrado' };
  }

  const cotacoesParaSalvar = [];
  const hoje = new Date().toISOString().split('T')[0];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'pt-BR',
  });

  try {
    const page = await context.newPage();

    for (const produto of produtos) {
      try {
        const busca = encodeURIComponent(produto.nome);
        const url = `https://distribuidorametta.vendizap.com/busca?q=${busca}`;

        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2000);

        // Ajuste o seletor conforme inspeção real do site
        const precoTexto = await page
          .locator('[class*="price"], [class*="preco"], [class*="valor"]')
          .first()
          .textContent({ timeout: 5000 })
          .catch(() => null);

        if (precoTexto) {
          const preco = parseFloat(
            precoTexto.replace(/[^\d,]/g, '').replace(',', '.')
          );
          if (!isNaN(preco) && preco > 0) {
            cotacoesParaSalvar.push({
              produto_id: produto.id,
              fornecedor_id,
              preco,
              data: hoje,
            });
          }
        }

        await page.waitForTimeout(2000);
      } catch (err) {
        console.warn(`Metta - Erro ao buscar "${produto.nome}": ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (cotacoesParaSalvar.length > 0) {
    const { error } = await supabase.from('cotacoes').insert(cotacoesParaSalvar);
    if (error) throw error;
  }

  console.log(`Metta: ${cotacoesParaSalvar.length} cotações salvas`);
  return { salvos: cotacoesParaSalvar.length };
}

module.exports = { rasparMetta };
