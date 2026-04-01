import axios from 'axios';

/**
 * Em desenvolvimento: usa o proxy do Vite (/api → localhost:3001)
 * Em producao (Vercel): usa VITE_API_URL apontando para o backend no Railway
 */
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 300_000, // 5 minutos — cotacao pode demorar
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
    return Promise.reject(new Error(msg));
  }
);

export default api;
