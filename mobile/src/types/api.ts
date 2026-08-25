/**
 * Tipos genéricos compartilhados de comunicação com a API. Tipos
 * específicos de cada domínio (ex.: Agendamento, Profissional) serão
 * definidos dentro do respectivo módulo em `src/modules/*` quando
 * implementados.
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
