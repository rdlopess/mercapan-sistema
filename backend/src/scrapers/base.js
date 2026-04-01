/**
 * Classe base para todos os scrapers do Mercapan.
 * Todo scraper deve estender esta classe e implementar buscarPreco().
 */
class ScraperBase {
  /**
   * @param {string} nomeFornecedor - Nome do fornecedor (para logs)
   * @param {string} urlBase        - URL base do site do fornecedor
   */
  constructor(nomeFornecedor, urlBase) {
    this.nomeFornecedor = nomeFornecedor;
    this.urlBase = urlBase;
  }

  /**
   * Busca o preço de um produto neste fornecedor.
   *
   * @param {string} produto - Nome do produto a ser buscado
   * @returns {Promise<{ preco: number|null, encontrado: boolean, url: string }>}
   */
  async buscarPreco(produto) {
    throw new Error(`buscarPreco() deve ser implementado pelo scraper "${this.nomeFornecedor}"`);
  }

  /**
   * Normaliza o texto de preço extraído do HTML.
   * Remove R$, espaços, pontos de milhar e converte vírgula → ponto.
   *
   * @param {string} texto
   * @returns {number|null}
   */
  normalizarPreco(texto) {
    if (!texto) return null;
    // Remove tudo exceto dígitos, vírgula e ponto
    const limpo = texto
      .replace(/R\$\s*/gi, '')
      .trim()
      // Remove pontos de milhar (ex: 1.234,56 → 1234,56)
      .replace(/\.(?=\d{3}[,\s])/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');

    const valor = parseFloat(limpo);
    return isNaN(valor) || valor <= 0 ? null : valor;
  }

  /**
   * Monta a URL de busca para um produto.
   * Pode ser sobrescrito pelo scraper se necessário.
   *
   * @param {string} termoBusca
   * @returns {string}
   */
  montarUrlBusca(termoBusca) {
    return `${this.urlBase}/busca?q=${encodeURIComponent(termoBusca)}`;
  }

  /**
   * Log padronizado para o scraper.
   * @param {string} msg
   */
  log(msg) {
    console.log(`[${this.nomeFornecedor}] ${msg}`);
  }

  warn(msg) {
    console.warn(`[${this.nomeFornecedor}] AVISO: ${msg}`);
  }

  erro(msg) {
    console.error(`[${this.nomeFornecedor}] ERRO: ${msg}`);
  }
}

module.exports = ScraperBase;
