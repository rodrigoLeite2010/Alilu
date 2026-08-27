import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import { recommendationsApi } from '../modules/recommendations/api';
import type { Recommendation } from '../modules/recommendations/types';

/** "Recomendações: aprovar, rejeitar, bloquear" (PROMPT 12 — "Administrador pode moderar", PROMPT 10). */
export function RecomendacoesPage() {
  const { selected } = useCondominiumScope();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!selected) {
      return;
    }

    setIsLoading(true);
    setError(null);

    recommendationsApi
      .listByCondominium(selected.id)
      .then(setRecommendations)
      .catch(() => setError('Não foi possível carregar as recomendações.'))
      .finally(() => setIsLoading(false));
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(id: string, action: 'approve' | 'reject' | 'block') {
    setActionError(null);
    setBusyId(id);

    try {
      const updated =
        action === 'approve'
          ? await recommendationsApi.approve(id)
          : action === 'reject'
            ? await recommendationsApi.reject(id)
            : await recommendationsApi.block(id);

      setRecommendations((current) => current.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setActionError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  if (!selected) {
    return <div className="empty-state">Selecione um condomínio.</div>;
  }

  return (
    <div>
      <div className="page-title">
        <h1>Recomendações</h1>
        <p>{selected.name}</p>
      </div>

      {isLoading && (
        <div className="loading-row">
          <span className="spinner" aria-hidden /> Carregando…
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {actionError && (
        <div className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      {!isLoading && recommendations.length === 0 && !error && (
        <div className="empty-state">Nenhuma recomendação neste condomínio ainda.</div>
      )}

      {recommendations.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profissional indicado</th>
                <th>Comentário</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation) => (
                <tr key={recommendation.id}>
                  <td style={{ fontWeight: 600 }}>
                    {recommendation.externalProfessionalName ?? recommendation.professionalId ?? '—'}
                  </td>
                  <td style={{ maxWidth: 320 }}>{recommendation.comment}</td>
                  <td>
                    <StatusBadge status={recommendation.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {recommendation.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId === recommendation.id}
                            onClick={() => void runAction(recommendation.id, 'approve')}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busyId === recommendation.id}
                            onClick={() => void runAction(recommendation.id, 'reject')}
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {recommendation.status === 'Approved' && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === recommendation.id}
                          onClick={() => void runAction(recommendation.id, 'block')}
                        >
                          Bloquear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
