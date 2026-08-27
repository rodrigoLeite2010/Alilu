import { translateStatus } from '../utils/statusLabels';

const POSITIVE_STATUSES = new Set(['Active', 'Approved']);
const NEGATIVE_STATUSES = new Set(['Rejected', 'Blocked', 'Inactive']);

/**
 * Badge de status genérico — verde para estados "positivos" (Active/Approved),
 * vermelho para negativos (Rejected/Blocked/Inactive), neutro para o resto
 * (Pending). A cor é decidida pelo valor BRUTO que a Api devolve (`status`)
 * — só o TEXTO mostrado (Etapa 23) é traduzido via `translateStatus`, pra
 * não depender de nenhuma tradução cobrir os dois Sets acima.
 */
export function StatusBadge({ status }: { status: string }) {
  const variant = POSITIVE_STATUSES.has(status)
    ? 'badge-success'
    : NEGATIVE_STATUSES.has(status)
      ? 'badge-error'
      : 'badge-warning';

  return <span className={`badge ${variant}`}>{translateStatus(status)}</span>;
}
