import { useEffect, useState } from 'react';
import api from '../lib/api';

const ETAPAS = [
  { msg: 'Conectando aos fornecedores...', pct: 8 },
  { msg: 'Buscando precos no Atacadao...', pct: 28 },
  { msg: 'Buscando precos na Slap Comercial...', pct: 52 },
  { msg: 'Buscando precos na Metta (VendiZap)...', pct: 74 },
  { msg: 'Calculando menores precos e margens...', pct: 88 },
  { msg: 'Gerando PDF e atualizando Sheets...', pct: 96 },
];

function StatusBadge({ status }) {
  const map = {
    concluido: 'bg-green-100 text-green-700',
    erro: 'bg-red-100 text-red-600',
    em_andamento: 'bg-yellow-100 text-yellow-700',
  };
  const label = { concluido: 'Concluido', erro: 'Erro', em_andamento: 'Em andamento' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {label[status] || status}
    </span>
  );
}

function formatarDuracao(seg) {
  if (!seg) return '-';
  if (seg < 60) return `${seg}s`;
  return `${Math.floor(seg / 60)}min ${Math.round(seg % 60)}s`;
}

export default function Cotacao() {
  const [executando, setExecutando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState('');
  const [tabelaAtual, setTabelaAtual] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [erroExec, setErroExec] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const [tab, prod, logsData] = await Promise.all([
        api.get('/tabela'),
        api.get('/produtos'),
        api.get('/cotacao/logs'),
      ]);
      setTabelaAtual(tab);
      setProdutos(prod);
      setLogs(logsData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function executarCotacao() {
    setExecutando(true);
    setRelatorio(null);
    setErroExec('');
    setProgresso(0);
    setEtapa(ETAPAS[0].msg);

    // Simula progresso visual enquanto a API processa (resposta sincrona)
    let i = 0;
    const timer = setInterval(() => {
      if (i < ETAPAS.length - 1) {
        i++;
        setEtapa(ETAPAS[i].msg);
        setProgresso(ETAPAS[i].pct);
      }
    }, 4000);

    try {
      // POST /api/cotacao/executar — sincrono, aguarda o ciclo completo
      const resultado = await api.post('/cotacao/executar', {});
      clearInterval(timer);
      setProgresso(100);
      setEtapa('Concluido com sucesso!');
      setRelatorio(resultado);
      // Atualiza tabela e logs apos execucao
      await carregarDados();
    } catch (err) {
      clearInterval(timer);
      setErroExec(err.message || 'Erro desconhecido');
      setProgresso(0);
      setEtapa('');
    } finally {
      setExecutando(false);
    }
  }

  const linhasRelatorio = relatorio?.relatorio || [];

  return (
    <div>
      <div className="mb-8">
        <div className="gold-divider" />
        <h1 className="page-title">Cotacao de Precos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca automatica de precos nos fornecedores, gera PDF e atualiza o Google Sheets.
        </p>
      </div>

      {/* Painel de controle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Card: executar */}
        <div className="card col-span-2">
          <h3 className="font-semibold text-navy-800 mb-1">Executar cotacao agora</h3>
          <p className="text-sm text-gray-500 mb-4">
            Serao cotados <strong>{produtos.filter(p => p.ativo).length}</strong> produto(s)
            ativo(s) em <strong>3</strong> fornecedores. O processo pode levar varios minutos.
          </p>

          {!executando && !relatorio && (
            <>
              <button className="btn-gold" onClick={executarCotacao}>
                ⚡ Executar Cotacao Agora
              </button>
              {erroExec && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
                  ✗ {erroExec}
                </p>
              )}
            </>
          )}

          {executando && (
            <div className="space-y-3">
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gold-500 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy-600 font-medium">{etapa}</span>
                <span className="text-gray-400">{progresso}%</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                Aguarde, nao feche esta janela...
              </div>
            </div>
          )}

          {relatorio && !executando && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-600 text-xl">✓</span>
                <div>
                  <p className="font-semibold text-green-700 text-sm">Cotacao concluida</p>
                  <p className="text-xs text-gray-500">
                    {relatorio.geradas} produto(s) | {formatarDuracao(relatorio.duracao_segundos)}
                    {relatorio.erros > 0 && ` | ${relatorio.erros} erro(s)`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border text-sm ${relatorio.pdf_url ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className="font-semibold text-navy-700 mb-1">📄 PDF</p>
                  {relatorio.pdf_url ? (
                    <a href={relatorio.pdf_url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all">
                      Abrir catalogo PDF →
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400">Nao gerado</p>
                  )}
                </div>
                <div className={`p-3 rounded-xl border text-sm ${relatorio.sheets_atualizado ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className="font-semibold text-navy-700 mb-1">📊 Google Sheets</p>
                  <p className={`text-xs ${relatorio.sheets_atualizado ? 'text-green-600' : 'text-gray-400'}`}>
                    {relatorio.sheets_atualizado ? 'Atualizado com sucesso' : 'Nao atualizado'}
                  </p>
                </div>
              </div>

              <button
                className="text-sm text-gold-600 hover:underline font-medium"
                onClick={() => { setRelatorio(null); setErroExec(''); }}>
                ← Nova cotacao
              </button>
            </div>
          )}
        </div>

        {/* Card: agendamento */}
        <div className="card bg-navy-50 border-navy-100">
          <h3 className="font-semibold text-navy-800 mb-3">Agendamento automatico</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="mt-1 w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-medium text-navy-700">Segunda-feira — 7h</p>
                <p className="text-xs text-gray-400">Cotacao completa semanal</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-medium text-navy-700">PDF gerado automaticamente</p>
                <p className="text-xs text-gray-400">Enviado ao Supabase Storage</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-medium text-navy-700">Google Sheets sincronizado</p>
                <p className="text-xs text-gray-400">Aba "Tabela Semanal" atualizada</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 border-t border-navy-100 pt-3">
            Horario de Brasilia (America/Sao_Paulo) · Roda na nuvem (Railway)
          </p>
        </div>
      </div>

      {/* Resultado detalhado da cotacao */}
      {relatorio && linhasRelatorio.length > 0 && (
        <div className="card mb-8 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-navy-800">Resultado detalhado</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-600 text-white text-xs uppercase">
                  <th className="px-4 py-2.5 text-left">Produto</th>
                  <th className="px-4 py-2.5 text-left">Atacadao</th>
                  <th className="px-4 py-2.5 text-left">Slap</th>
                  <th className="px-4 py-2.5 text-left">Metta</th>
                  <th className="px-4 py-2.5 text-left">Menor</th>
                  <th className="px-4 py-2.5 text-right">Venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhasRelatorio.map((linha, idx) => {
                  const cotForn = {};
                  (linha.cotacoes || []).forEach(c => { cotForn[c.fornecedor] = c.preco; });

                  return (
                    <tr key={idx} className="hover:bg-navy-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-navy-800">{linha.produto}</td>
                      {['Atacadao', 'Slap Comercial', 'Metta'].map(f => {
                        const p = cotForn[f];
                        const isMin = f === linha.fornecedor;
                        return (
                          <td key={f} className={`px-4 py-2.5 ${isMin ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                            {p ? `R$ ${Number(p).toFixed(2)}` : <span className="text-gray-200">—</span>}
                            {isMin && p && <span className="ml-1 text-xs">★</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-green-700 font-medium">
                        R$ {Number(linha.menor_preco).toFixed(2)}
                        <span className="text-xs text-gray-400 ml-1">({linha.margem}%)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-navy-800">
                        R$ {Number(linha.preco_venda).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela semanal atual */}
      {tabelaAtual.length > 0 && (
        <div className="card p-0 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-navy-800">Tabela semanal atual</h3>
            <a href="/catalogo" className="text-sm text-gold-600 hover:underline font-medium">
              Ver catalogo completo →
            </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-right">Menor Preco</th>
                <th className="px-4 py-3 text-right">Margem</th>
                <th className="px-4 py-3 text-right">Preco Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tabelaAtual.slice(0, 10).map(t => (
                <tr key={t.id} className="hover:bg-navy-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-navy-800">{t.produtos?.nome}</td>
                  <td className="px-4 py-2.5 capitalize text-gray-500">{t.produtos?.categoria}</td>
                  <td className="px-4 py-2.5 text-gray-600">{t.fornecedores?.nome}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">R$ {Number(t.menor_preco).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-gold-600">{t.margem}%</td>
                  <td className="px-4 py-2.5 text-right font-bold text-navy-700">R$ {Number(t.preco_venda).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tabelaAtual.length > 10 && (
            <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400 text-center">
              Mostrando 10 de {tabelaAtual.length} itens.{' '}
              <a href="/catalogo" className="text-gold-600 hover:underline">Ver todos no catalogo</a>
            </div>
          )}
        </div>
      )}

      {/* Historico de execucoes */}
      {logs.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-navy-800">Historico de execucoes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Data/Hora</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Produtos</th>
                  <th className="px-4 py-3 text-right">Erros</th>
                  <th className="px-4 py-3 text-right">Duracao</th>
                  <th className="px-4 py-3 text-center">PDF</th>
                  <th className="px-4 py-3 text-center">Sheets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-navy-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-600 text-xs">
                      {new Date(log.iniciado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.origem === 'manual'
                          ? 'bg-navy-100 text-navy-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {log.origem === 'manual' ? '⚡ Manual' : '🕐 Auto'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-navy-700">
                      {log.produtos_cotados ?? '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${log.erros > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {log.erros ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {formatarDuracao(log.duracao_segundos)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {log.pdf_url ? (
                        <a href={log.pdf_url} target="_blank" rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-xs" title="Abrir PDF">
                          📄
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {log.sheets_atualizado
                        ? <span className="text-green-500 text-xs">✓</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
