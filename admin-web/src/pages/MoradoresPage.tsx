import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import { condominiumApi } from '../modules/condominium/api';
import type { CondominiumUnit } from '../modules/condominium/types';
import { residentApi } from '../modules/resident/api';
import type { Membership } from '../modules/resident/types';

/** "Moradores: listar, visualizar, aprovar, bloquear, rejeitar" (PROMPT 12). */
export function MoradoresPage() {
  const { selected } = useCondominiumScope();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [units, setUnits] = useState<CondominiumUnit[]>([]);
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

    Promise.all([residentApi.listByCondominium(selected.id), condominiumApi.listUnits(selected.id)])
      .then(([membershipList, unitList]) => {
        setMemberships(membershipList);
        setUnits(unitList);
      })
      .catch(() => setError('Não foi possível carregar os moradores.'))
      .finally(() => setIsLoading(false));
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(membershipId: string, action: 'approve' | 'reject' | 'block') {
    setActionError(null);
    setBusyId(membershipId);

    try {
      const updated =
        action === 'approve'
          ? await residentApi.approve(membershipId)
          : action === 'reject'
            ? await residentApi.reject(membershipId)
            : await residentApi.block(membershipId);

      setMemberships((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      setActionError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  function unitLabel(unitId: string): string {
    return units.find((unit) => unit.id === unitId)?.code ?? unitId;
  }

  if (!selected) {
    return <p>Selecione um condomínio.</p>;
  }

  return (
    <div>
      <h1>Moradores</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{selected.name}</p>

      {isLoading && <p>Carregando…</p>}
      {error && <p style={{ color: 'var(--alilu-error)' }}>{error}</p>}
      {actionError && <p style={{ color: 'var(--alilu-error)' }}>{actionError}</p>}

      {!isLoading && memberships.length === 0 && !error && <p>Nenhum morador vinculado a este condomínio ainda.</p>}

      {memberships.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Morador</th>
                <th>Unidade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{membership.userName ?? '(nome indisponível)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{membership.userEmail}</div>
                  </td>
                  <td>{unitLabel(membership.unitId)}</td>
                  <td>
                    <StatusBadge status={membership.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {membership.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId === membership.id}
                            onClick={() => void runAction(membership.id, 'approve')}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busyId === membership.id}
                            onClick={() => void runAction(membership.id, 'reject')}
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {membership.status === 'Active' && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === membership.id}
                          onClick={() => void runAction(membership.id, 'block')}
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
