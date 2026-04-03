const { chromium } = require('playwright');
const ScraperBase = require('./base');

/**
 * Scraper do Atacadao.
 *
 * O site usa Next.js com hidratacao client-side, entao Playwright e obrigatorio.
 *
 * Estrutura DOM confirmada via inspecao real (2026-04):
 *   - Cards de produto: <article>
 *   - Nome do produto:  article a[class*="after:content"]  (link com overlay)
 *   - Preco principal:  article p.text-lg                  (ex: "R$ 19,39")
 *   - Preco unitario:   article p.text-sm                  (ex: "R$ 19,89")
 *   - URL de busca:     /s/?q=<termo>
 *
 * Estrategia: percorre os cards, verifica se o nome contem o produto buscado,
 * e retorna o menor preco entre os cards correspondentes.
 */
class AtacadaoScraper extends ScraperBase {
  constructor() {
    super('Atacadão', 'https://www.atacadao.com.br');

    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  montarUrlBusca(produto) {
    return `${this.urlBase}/s/?q=${encodeURIComponent(produto)}`;
  }

  /**
   * Verifica se o texto do card contem o produto buscado
   * (compara as primeiras palavras significativas).
   */
  _cardContemProduto(nomeCard, nomeProduto) {
    const cardLower = nomeCard.toLowerCase();
    const palavras = nomeProduto
      .toLowerCase()
      .split(/\s+/)
      .filter(p => p.length > 2);
    if (palavras.length === 0) return false;
    return palavras.some(p => cardLower.includes(p));
  }

  /**
   * Extrai precos dos cards que correspondem ao produto buscado.
   * Usa seletores confirmados via inspecao real do DOM.
   */
  async _extrairPrecoEspecifico(page, nomeProduto) {
    try {
      const cards = await page.locator('article').all();
      this.log(`${cards.length} card(s) encontrado(s) na pagina`);

      const precos = [];

      for (const card of cards.slice(0, 20)) {
        try {
          // Pega o nome do produto no card (link com overlay "after:content")
          const nomeEl = card.locator('a[class*="after\\:content"]').first();
          const nomeCard = await nomeEl.textContent({ timeout: 2000 }).catch(() => '');

          if (!nomeCard || !this._cardContemProduto(nomeCard, nomeProduto)) continue;

          // Pega o preco principal (p.text-lg = preco de atacado)
          const precoEl = card.locator('p.text-lg').first();
          const precoTxt = await precoEl.textContent({ timeout: 2000 }).catch(() => '');
          const preco = this.normalizarPreco(precoTxt);

          if (preco) {
            this.log(`Card "${nomeCard.substring(0, 40)}" → R$ ${preco}`);
            precos.push(preco);
          }
        } catch (_) {}
      }

      if (precos.length > 0) {
        const menor = Math.min(...precos);
        this.log(`Menor preco para "${nomeProduto}": R$ ${menor}`);
        return menor;
      }
    } catch (err) {
      this.warn(`Erro ao extrair precos: ${err.message}`);
    }

    return null;
  }

  /**
   * Busca o preco de um produto no Atacadao via Playwright.
   * @param {string} produto
   * @returns {{ preco: number|null, encontrado: boolean, url: string }}
   */
  async buscarPreco(produto) {
    const url = this.montarUrlBusca(produto);
    this.log(`Buscando: "${produto}"`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: this.userAgent,
      locale: 'pt-BR',
      viewport: { width: 1280, height: 800 },
    });

    let preco = null;

    try {
      const page = await context.newPage();

      // Bloqueia recursos desnecessarios para acelerar
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', route =>
        route.abort()
      );

      this.log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Aguarda Next.js hidratar e renderizar os cards
      await page.waitForSelector('article', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      preco = await this._extrairPrecoEspecifico(page, produto);

      // Se nao achou, tenta scroll e nova tentativa
      if (preco === null) {
        this.log('Tentando scroll para carregar lazy content...');
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(2000);
        preco = await this._extrairPrecoEspecifico(page, produto);
      }
    } catch (err) {
      this.erro(`Erro ao acessar o site: ${err.message}`);
    } finally {
      await browser.close();
    }

    if (preco === null) {
      this.warn(`Preco nao encontrado para "${produto}"`);
    }

    return { preco, encontrado: preco !== null, url };
  }
}

module.exports = new AtacadaoScraper();
