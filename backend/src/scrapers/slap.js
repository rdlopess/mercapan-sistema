const axios = require('axios');
const cheerio = require('cheerio');
const ScraperBase = require('./base');

/**
 * Scraper da Slap Comercial (slapcomercial.com.br).
 *
 * O site usa HTML renderizado no servidor (SSR/PHP tradicional),
 * tornando axios + cheerio suficiente na maioria dos casos.
 *
 * Estrutura identificada no slapcomercial.com.br:
 *   - Pagina de busca: /busca?busca=<termo>
 *   - Cards de produto: div.product-item ou li.product-item
 *   - Preco: span.product-price, .price, [class*="preco"]
 *   - Nome: h2.product-name ou .product-title
 */
class SlapScraper extends ScraperBase {
  constructor() {
    super('Slap Comercial', 'https://www.slapcomercial.com.br');

    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: 'https://www.slapcomercial.com.br/',
    };

    // Seletores em ordem de prioridade (mais especifico → mais generico)
    this.seletoresPreco = [
      '.product-price',
      '.preco-por',
      '.price-box .price',
      '[class*="product"] [class*="price"]',
      '[class*="preco"]',
      '[class*="valor"]',
      'span.price',
      '.price',
    ];

    // Possiveis formatos de URL de busca do site
    this.urlsBusca = [
      (q) => `${this.urlBase}/busca?busca=${encodeURIComponent(q)}`,
      (q) => `${this.urlBase}/busca?q=${encodeURIComponent(q)}`,
      (q) => `${this.urlBase}/pesquisa?termo=${encodeURIComponent(q)}`,
    ];
  }

  /**
   * Tenta cada formato de URL de busca ate encontrar resultados.
   */
  async _tentarUrls(produto) {
    for (const montarUrl of this.urlsBusca) {
      const url = montarUrl(produto);
      try {
        this.log(`Tentando URL: ${url}`);
        const { data: html, status } = await axios.get(url, {
          headers: this.headers,
          timeout: 12000,
          maxRedirects: 5,
        });

        if (status !== 200 || html.length < 500) continue;

        const preco = this._extrairPreco(html);
        if (preco) {
          return { preco, url };
        }

        // Mesmo sem preco, retorna a URL que funcionou para log
        this.warn(`URL funcionou mas nao encontrou preco: ${url}`);
        return { preco: null, url };
      } catch (err) {
        this.warn(`URL falhou (${url}): ${err.message}`);
      }
    }
    return { preco: null, url: this.urlsBusca[0](produto) };
  }

  /**
   * Extrai o preco de uma pagina HTML usando multiplos seletores.
   */
  _extrairPreco(html) {
    const $ = cheerio.load(html);

    // Verifica se ha produtos na pagina (evita falsos positivos)
    const temProdutos =
      $('[class*="product"]').length > 0 ||
      $('[class*="item"]').length > 0 ||
      $('[class*="resultado"]').length > 0;

    if (!temProdutos) {
      this.warn('Nenhum produto encontrado na pagina de resultados');
      return null;
    }

    for (const seletor of this.seletoresPreco) {
      // Pega todos os elementos e ordena pelo menor preco
      const precos = [];
      $(seletor).each((_, el) => {
        const texto = $(el).text().trim();
        const preco = this.normalizarPreco(texto);
        if (preco) precos.push(preco);
      });

      if (precos.length > 0) {
        const menorPreco = Math.min(...precos);
        this.log(`${precos.length} preco(s) encontrado(s) via "${seletor}". Menor: R$ ${menorPreco}`);
        return menorPreco;
      }
    }

    return null;
  }

  /**
   * Busca o preco de um produto na Slap Comercial.
   * @param {string} produto
   * @returns {{ preco: number|null, encontrado: boolean, url: string }}
   */
  async buscarPreco(produto) {
    this.log(`Buscando: "${produto}"`);

    const { preco, url } = await this._tentarUrls(produto);

    if (preco === null) {
      this.warn(`Preco nao encontrado para "${produto}"`);
    }

    return { preco, encontrado: preco !== null, url };
  }
}

module.exports = new SlapScraper();
