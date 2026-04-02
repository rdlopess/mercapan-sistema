const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const ScraperBase = require('./base');

/**
 * Scraper do Atacadao.
 * Estrategia primaria: axios + cheerio (HTML estatico, mais rapido).
 * Fallback automatico: Playwright headless (contorna bloqueios e JS).
 */
class AtacadaoScraper extends ScraperBase {
  constructor() {
    super('Atacadao', 'https://www.atacadao.com.br');

    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    // Seletores CSS em ordem de prioridade
    // Atacadao usa Next.js — prioridade para seletores VTEX IO / Next commerce
    this.seletoresPreco = [
      // VTEX IO (plataforma comum do Atacadao/Carrefour)
      '[class*="sellingPrice"]',
      '[class*="SellingPrice"]',
      '[class*="selling-price"]',
      '[class*="bestPrice"]',
      '[class*="priceContainer"] [class*="price"]',
      '[class*="ProductCard"] [class*="price"]',
      '[data-testid="price-box"] [class*="integer"]',
      '[class*="product-price"]',
      'span[class*="Price"]',
      '.price',
      '[class*="preco"]',
      // Next.js / generico
      '[class*="price_selling"]',
      '[class*="price__selling"]',
      '[class*="offerPrice"]',
    ];
  }

  montarUrlBusca(produto) {
    return `${this.urlBase}/s/?q=${encodeURIComponent(produto)}`;
  }

  /**
   * Extrai o menor preco de uma pagina HTML (string) usando cheerio.
   */
  _extrairPrecoHtml(html) {
    const $ = cheerio.load(html);

    for (const seletor of this.seletoresPreco) {
      const elemento = $(seletor).first();
      if (elemento.length) {
        const texto = elemento.text().trim();
        const preco = this.normalizarPreco(texto);
        if (preco) {
          this.log(`Preco encontrado via cheerio (${seletor}): R$ ${preco}`);
          return preco;
        }
      }
    }
    return null;
  }

  /**
   * Tentativa primaria: axios + cheerio (rapido, sem browser).
   */
  async _tentarComAxios(url) {
    this.log('Tentando com axios + cheerio...');
    const { data: html } = await axios.get(url, {
      headers: this.headers,
      timeout: 12000,
    });

    // Detecta possivel bloqueio (CAPTCHA ou pagina vazia)
    if (
      html.toLowerCase().includes('captcha') ||
      html.toLowerCase().includes('robot') ||
      html.length < 1000
    ) {
      throw new Error('Possivel bloqueio detectado (captcha/conteudo insuficiente)');
    }

    return this._extrairPrecoHtml(html);
  }

  /**
   * Fallback: Playwright headless (lento, mas contorna JS e bloqueios).
   */
  async _tentarComPlaywright(url) {
    this.log('Fallback: usando Playwright headless...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: this.headers['User-Agent'],
      locale: 'pt-BR',
    });
    const page = await context.newPage();

    try {
      // Next.js SSR + hydration: espera rede estabilizar
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // Aguarda possivel carregamento assincrono de precos
      await page.waitForTimeout(3000);

      let preco = null;
      for (const seletor of this.seletoresPreco) {
        try {
          const texto = await page
            .locator(seletor)
            .first()
            .textContent({ timeout: 3000 });
          preco = this.normalizarPreco(texto);
          if (preco) {
            this.log(`Preco encontrado via Playwright (${seletor}): R$ ${preco}`);
            break;
          }
        } catch (_) {
          // seletor nao encontrado, tenta o proximo
        }
      }
      return preco;
    } finally {
      await browser.close();
    }
  }

  /**
   * Busca o preco de um produto no Atacadao.
   * @param {string} produto - Nome do produto
   * @returns {{ preco: number|null, encontrado: boolean, url: string }}
   */
  async buscarPreco(produto) {
    const url = this.montarUrlBusca(produto);
    this.log(`Buscando: "${produto}"`);

    let preco = null;

    // 1a tentativa: axios + cheerio
    try {
      preco = await this._tentarComAxios(url);
    } catch (err) {
      this.warn(`Axios falhou (${err.message}). Ativando Playwright como fallback.`);
    }

    // Fallback: Playwright
    if (preco === null) {
      try {
        preco = await this._tentarComPlaywright(url);
      } catch (err) {
        this.erro(`Playwright tambem falhou: ${err.message}`);
      }
    }

    if (preco === null) {
      this.warn(`Preco nao encontrado para "${produto}"`);
    }

    return { preco, encontrado: preco !== null, url };
  }
}

// Exporta instancia unica (singleton)
module.exports = new AtacadaoScraper();
