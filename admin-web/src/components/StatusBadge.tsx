const POSITIVE_STATUSES = new Set(['Active', 'Approved']);
const NEGATIVE_STATUSES = new Set(['Rejected', 'Blocked', 'Inactive']);

/** Badge de status genérico — verde para estados "positivos" (Active/Approved), vermelho para negativos (Rejected/Blocked/Inactive), neutro para o resto (Pending). */
export function StatusBadge({ status }: { status: string }) {
  const variant = POSITIVE_STATUSES.has(status)
    ? 'badge-success'
    : NEGATIVE_STATUSES.has(status)
      ? 'badge-error'
      : 'badge-warning';

  return <span className={`badge ${variant}`}>{status}</span>;
}
