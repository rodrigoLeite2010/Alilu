import { useEffect, useState } from 'react';

import { administrationApi } from '../modules/administration/api';
import type { AdminDashboard } from '../modules/administration/types';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';

const CARDS: { key: keyof Omit<AdminDashboard, 'condominiumId'>; label: string }[] = [
  { key: 'moradores', label: 'Moradores' },
  { key: 'unidades', label: 'Unidades' },
  { key: 'profissionais', label: 'Profissionais' },
  { key: 'agendamentos', label: 'Agendamentos' },
  { key: 'solicitacoesPendentes', label: 'Solicitações pendentes' },
  { key: 'recomendacoesPendentes', label: 'Recomendações pendentes' },
];

/** "Dashboard" (PROMPT 12) — os seis números administrativos do condomínio selecionado, vindos de `GET /api/admin/dashboard`. */
export function DashboardPage() {
  const { selected, isLoading: isLoadingScope, error: scopeError } = useCondominiumScope();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    administrationApi
      .getDashboard(selected.id)
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Não foi possível carregar o dashboard.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (isLoadingScope) {
    return (
      <div className="loading-row">
        <span className="spinner" aria-hidden /> Carregando…
      </div>
    );
  }

  if (scopeError) {
    return (
      <div className="error-banner" role="alert">
        {scopeError}
      </div>
    );
  }

  if (!selected) {
    return <div className="empty-state">Nenhum condomínio cadastrado ainda.</div>;
  }

  return (
    <div>
      <div className="page-title">
        <h1>{selected.name}</h1>
        <p>
          {selected.city} — {selected.state}
        </p>
      </div>

      {isLoading && (
        <div className="loading-row">
          <span className="spinner" aria-hidden /> Carregando dashboard…
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {dashboard && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {CARDS.map((card) => (
            <div key={card.key} className="card stat-card">
              <div className="stat-card__value">{dashboard[card.key]}</div>
              <div className="stat-card__label">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
