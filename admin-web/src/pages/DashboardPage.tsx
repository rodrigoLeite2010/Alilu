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
    return <p>Carregando…</p>;
  }

  if (scopeError) {
    return <p style={{ color: 'var(--alilu-error)' }}>{scopeError}</p>;
  }

  if (!selected) {
    return <p>Nenhum condomínio cadastrado ainda.</p>;
  }

  return (
    <div>
      <h1>{selected.name}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        {selected.city} — {selected.state}
      </p>

      {isLoading && <p>Carregando dashboard…</p>}
      {error && <p style={{ color: 'var(--alilu-error)' }}>{error}</p>}

      {dashboard && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {CARDS.map((card) => (
            <div key={card.key} className="card">
              <div style={{ fontSize: 32, fontWeight: 700 }}>{dashboard[card.key]}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
