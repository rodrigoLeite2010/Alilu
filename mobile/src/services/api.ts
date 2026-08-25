import axios from 'axios';

/**
 * Instância Axios compartilhada da aplicação.
 *
 * Nesta etapa nenhuma chamada real é feita — apenas a instância base está
 * preparada, com um ponto único para configurar a URL da API e injetar o
 * token de autenticação (via interceptor) quando o módulo Identity/auth
 * for implementado.
 *
 * `EXPO_PUBLIC_API_URL` deve ser definida em um `.env` local (não
 * versionado) quando a API estiver disponível.
 */
// eslint-disable-next-line import/no-named-as-default-member -- falso positivo conhecido do eslint-plugin-import com o default export do axios
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5205',
  timeout: 15000,
});

// Ponto de extensão futuro (não implementado nesta etapa):
// api.interceptors.request.use((config) => { ...anexar token do SecureStore... });
// api.interceptors.response.use((res) => res, (error) => { ...refresh token / logout... });
