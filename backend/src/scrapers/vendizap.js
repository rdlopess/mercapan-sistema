const { chromium } = require('playwright');
const ScraperBase = require('./base');

/**
 * Scraper da Metta via VendiZap (distribuidorametta.vendizap.com).
 *
 * O VendiZap e uma plataforma de catalogo digital que renderiza
 * todo o conteudo via JavaScript (React/Vue SPA).
 * Por isso, Playwright e OBRIGATORIO — axios/cheerio nao funcionam.
 *
 * Estrategia de busca (em ordem de tentativa):
 *   1. Acessa /?search=<produto> e aguarda filtrar
 *   2. Se nao filtrou, interage com o campo de busca da pagina
 *   3. Encontra cards de produto que contenham o nome buscado
 *   4. Extrai o preco APENAS do card correspondente ao produto
 *      (evita retornar preco generico do catalogo inteiro)
 */
class VendiZapScraper extends ScraperBase {
  constructor() {
    super('Metta (VendiZap)', 'https://distribuidorametta.vendizap.com');

    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Seletores de campo de busca para interacao direta com UI
    this.seletoresBusca = [
      'input[type="search"]',
      'input[placeholder*="busca" i]',
      'input[placeholder*="pesquisa" i]',
      'input[placeholder*="procura" i]',
      'input[placeholder*="produto" i]',
      'input[placeholder*="search" i]',
      '[class*="search"] input',
      '[class*="busca"] input',
      '[class*="Search"] input',
    ];

    // Seletores para detectar que a pagina carregou os produtos
    this.seletoresCarregamento = [
      '[class*="product-card"]',
      '[class*="ProductCard"]',
      '[class*="product-item"]',
      '[class*="ProductItem"]',
      '[class*="catalog"]',
      '[class*="Catalog"]',
    ];
  }

  montarUrlBusca(produto) {
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
    // Fallback: aguarda qualquer conteudo aparecer
    try {
      await page.waitForLoadState('networkidle', { timeout: timeoutMs });
    } catch (_) {}
    this.warn('Seletor de carregamento nao encontrado — continuando mesmo assim');
    return false;
  }

  /**
   * Tenta interagir com o campo de busca da pagina para filtrar resultados.
   * Retorna true se conseguiu preencher o campo.
   */
  async _usarCampoBusca(page, nomeProduto) {
    for (const seletor of this.seletoresBusca) {
      try {
        const input = page.locator(seletor).first();
        if (await input.count() === 0) continue;

        await input.fill('');
        await input.fill(nomeProduto);
        await input.press('Enter');
        this.log(`Campo de busca preenchido via "${seletor}"`);
        // Aguarda resultados filtrarem
        await page.waitForTimeout(2500);
        return true;
      } catch (_) {
        // seletor nao encontrado, tenta o proximo
      }
    }
    return false;
  }

  /**
   * Extrai preco de um unico elemento (card de produto).
   * Busca texto com R$ dentro do elemento e normaliza.
   */
  _extrairPrecoDeTexto(texto) {
    if (!texto) return null;
    // Encontra todos os padroes de preco no texto
    const matches = texto.match(/R\$\s*[\d.,]+/g) || [];
    const precos = matches
      .map(m => this.normalizarPreco(m))
      .filter(p => p !== null && p > 0.1 && p < 100000);
    if (precos.length === 0) return null;
    // Retorna o menor preco encontrado no card
    return Math.min(...precos);
  }

  /**
   * Verifica se um texto de card contem o produto buscado.
   * Usa as primeiras palavras significativas do nome do produto.
   */
  _cardContemProduto(textoCard, nomeProduto) {
    const cardLower = textoCard.toLowerCase();
    // Palavras com mais de 2 caracteres do nome do produto
    const palavras = nomeProduto
      .toLowerCase()
      .split(/\s+/)
      .filter(p => p.length > 2);

    if (palavras.length === 0) return false;
    // Basta a primeira palavra significativa estar no card
    return palavras.some(palavra => cardLower.includes(palavra));
  }

  /**
   * Busca preco especifico para o produto em cards ja carregados na pagina.
   * Percorre os cards e retorna o preco do primeiro que contem o nome do produto.
   */
  async _extrairPrecoEspecifico(page, nomeProduto) {
    // Tenta cada seletor de card
    for (const seletor of this.seletoresCarregamento) {
      try {
        const cards = await page.locator(seletor).all();
        if (cards.length === 0) continue;

        this.log(`${cards.length} card(s) encontrado(s) via "${seletor}"`);

        for (const card of cards.slice(0, 20)) {
          try {
            const texto = await card.textContent({ timeout: 2000 }) || '';
            if (this._cardContemProduto(texto, nomeProduto)) {
              const preco = this._extrairPrecoDeTexto(texto);
              if (preco) {
                this.log(`Preco encontrado no card do produto "${nomeProduto}": R$ ${preco}`);
                return preco;
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    return null;
  }

  /**
   * Ultima tentativa: executa JavaScript na pagina para encontrar
   * elementos de preco proximos a textos que contenham o nome do produto.
   */
  async _extrairViaJS(page, nomeProduto) {
    try {
      const palavraChave = nomeProduto.toLowerCase().split(' ').filter(p => p.length > 2)[0];
      if (!palavraChave) return null;

      const preco = await page.evaluate((kw) => {
        // Procura todos os elementos de texto
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
        );

        let node;
        while ((node = walker.nextNode())) {
          const texto = (node.textContent || '').toLowerCase();
          if (!texto.includes(kw)) continue;

          // Encontrou o nome do produto — sobe na arvore ate achar um preco
          let el = node.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!el) break;
            const elTexto = el.textContent || '';
            const match = elTexto.match(/R\$\s*([\d.,]+)/);
            if (match) {
              const limpo = match[1].replace(/\.(?=\d{3}[,])/g, '').replace(',', '.');
              const val = parseFloat(limpo);
              if (!isNaN(val) && val > 0.1 && val < 100000) return val;
            }
            el = el.parentElement;
          }
        }
        return null;
      }, palavraChave);

      if (preco) {
        this.log(`Preco encontrado via JS para "${nomeProduto}": R$ ${preco}`);
      }
      return preco;
    } catch (err) {
      this.warn(`Busca via JS falhou: ${err.message}`);
      return null;
    }
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
      await page.waitForTimeout(2000);

      // Tentativa 1: extrair preco do card especifico do produto (URL com ?search=)
      preco = await this._extrairPrecoEspecifico(page, produto);

      // Tentativa 2: se nao achou, usa campo de busca da pagina para filtrar
      if (preco === null) {
        this.log('Tentando campo de busca da pagina...');
        const buscou = await this._usarCampoBusca(page, produto);
        if (buscou) {
          preco = await this._extrairPrecoEspecifico(page, produto);
        }
      }

      // Tentativa 3: busca via inspecao do DOM com JavaScript
      if (preco === null) {
        this.log('Tentando extracao via JavaScript DOM...');
        preco = await this._extrairViaJS(page, produto);
      }

      // Tentativa 4: scroll + nova tentativa
      if (preco === null) {
        this.log('Tentando scroll para carregar mais conteudo...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        preco = await this._extrairPrecoEspecifico(page, produto);
        if (preco === null) {
          preco = await this._extrairViaJS(page, produto);
        }
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
