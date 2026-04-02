const { chromium } = require('playwright');
const ScraperBase = require('./base');

/**
 * Scraper da Metta via VendiZap (distribuidorametta.vendizap.com).
 *
 * O VendiZap e uma plataforma de catalogo digital que renderiza
 * todo o conteudo via JavaScript (React/Vue SPA).
 * Por isso, Playwright e OBRIGATORIO — axios/cheerio nao funcionam.
 *
 * Fluxo observado no site:
 *   1. Acessa a pagina de busca
 *   2. Aguarda o JS carregar os produtos
 *   3. Os cards de produto aparecem dinamicamente
 *   4. Extrai o preco do primeiro resultado
 */
class VendiZapScraper extends ScraperBase {
  constructor() {
    super('Metta (VendiZap)', 'https://distribuidorametta.vendizap.com');

    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Seletores do VendiZap em ordem de prioridade
    // (baseados na estrutura tipica de SPAs de catalogo)
    this.seletoresPreco = [
      '[class*="product-price"]',
      '[class*="ProductPrice"]',
      '[class*="price-value"]',
      '[class*="preco"]',
      '[data-price]',
      '[class*="valor"]',
      '[class*="currency"]',
      'span[class*="price"]',
    ];

    // Seletores para detectar que a pagina carregou os produtos
    this.seletoresCarregamento = [
      '[class*="product-card"]',
      '[class*="ProductCard"]',
      '[class*="product-item"]',
      '[class*="catalog"]',
      '[class*="grid"]',
    ];
  }

  montarUrlBusca(produto) {
    // VendiZap usa hash-based routing ou query string
    const termo = encodeURIComponent(produto);
    return `${this.urlBase}/?search=${termo}`;
  }

  /**
   * Aguarda ate os produtos aparecerem na pagina ou timeout.
   */
  async _aguardarProdutos(page, timeoutMs = 10000) {
    for (const seletor of this.seletoresCarregamento) {
      try {
        await page.waitForSelector(seletor, { timeout: timeoutMs });
        this.log(`Produtos carregados (detectado: "${seletor}")`);
        return true;
      } catch (_) {
        // tenta o proximo seletor
      }
    }
    this.warn('Seletor de carregamento nao encontrado — continuando mesmo assim');
    return false;
  }

  /**
   * Extrai o preco da pagina ja carregada.
   */
  async _extrairPrecoDaPagina(page) {
    for (const seletor of this.seletoresPreco) {
      try {
        // Pega todos os elementos e retorna o menor preco
        const textos = await page.locator(seletor).allTextContents();
        const precos = textos
          .map(t => this.normalizarPreco(t))
          .filter(p => p !== null);

        if (precos.length > 0) {
          const menorPreco = Math.min(...precos);
          this.log(`${precos.length} preco(s) encontrado(s) via "${seletor}". Menor: R$ ${menorPreco}`);
          return menorPreco;
        }
      } catch (_) {
        // seletor nao encontrado, tenta o proximo
      }
    }

    // Nota: busca generica removida — retornava o menor preco do catalogo inteiro,
    // causando o mesmo preco para todos os produtos pesquisados (falso positivo).
    return null;
  }

  /**
   * Busca o preco de um produto no catalogo VendiZap da Metta.
   * Usa Playwright obrigatoriamente (site SPA em JavaScript).
   *
   * @param {string} produto
   * @returns {{ preco: number|null, encontrado: boolean, url: string }}
   */
  async buscarPreco(produto) {
    const url = this.montarUrlBusca(produto);
    this.log(`Buscando: "${produto}" (Playwright obrigatorio)`);

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

      // Bloqueia recursos desnecessarios (imagens, fontes) para acelerar
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', route =>
        route.abort()
      );

      this.log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Aguarda carregamento do JS
      await this._aguardarProdutos(page, 8000);

      // Pausa extra para renderizacao completa
      await page.waitForTimeout(2000);

      preco = await this._extrairPrecoDaPagina(page);

      // Se nao achou, tenta scrollar (lazy loading)
      if (preco === null) {
        this.log('Tentando scroll para carregar mais conteudo...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        preco = await this._extrairPrecoDaPagina(page);
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

module.exports = new VendiZapScraper();
