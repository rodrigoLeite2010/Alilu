import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import { professionalApi, professionalDirectoryApi } from '../modules/professional/api';
import type { ProfessionalCondominium, ProfessionalDirectoryItem } from '../modules/professional/types';

/** "Profissionais: aprovar, bloquear, associar ao condomínio, visualizar histórico" (PROMPT 12). */
export function ProfissionaisPage() {
  const { selected } = useCondominiumScope();
  const [links, setLinks] = useState<ProfessionalCondominium[]>([]);
  const [directory, setDirectory] = useState<ProfessionalDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [associateProfessionalId, setAssociateProfessionalId] = useState('');
  const [isAssociating, setIsAssociating] = useState(false);

  const directoryById = useMemo(() => {
    const map = new Map<string, ProfessionalDirectoryItem>();
    for (const item of directory) {
      map.set(item.id, item);
    }
    return map;
  }, [directory]);

  const load = useCallback(() => {
    if (!selected) {
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([professionalApi.listByCondominium(selected.id), professionalDirectoryApi.list()])
      .then(([linkList, directoryList]) => {
        setLinks(linkList);
        setDirectory(directoryList);
      })
      .catch(() => setError('Não foi possível carregar os profissionais.'))
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
          ? await professionalApi.approve(id)
          : action === 'reject'
            ? await professionalApi.reject(id)
            : await professionalApi.block(id);

      setLinks((current) => current.map((link) => (link.id === updated.id ? updated : link)));
    } catch {
      setActionError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssociate(event: FormEvent) {
    event.preventDefault();
    if (!selected || !associateProfessionalId) {
      return;
    }

    setActionError(null);
    setIsAssociating(true);

    try {
      const link = await professionalApi.associate(associateProfessionalId, selected.id);
      setLinks((current) => [...current, link]);
      setAssociateProfessionalId('');
    } catch {
      setActionError('Não foi possível associar — verifique se o profissional já não está vinculado a este condomínio.');
    } finally {
      setIsAssociating(false);
    }
  }

  // Profissionais que já têm QUALQUER vínculo (Pending/Active/Rejected/
  // Inactive) com este condomínio saem da lista do formulário de
  // associação — associar de novo duplicaria o vínculo (a Application já
  // rejeita isso, mas evitar o erro na UI é mais amigável).
  const availableForAssociation = directory.filter(
    (item) => !links.some((link) => link.professionalId === item.id),
  );

  if (!selected) {
    return <div className="empty-state">Selecione um condomínio.</div>;
  }

  return (
    <div>
      <div className="page-title">
        <h1>Profissionais</h1>
        <p>{selected.name}</p>
      </div>

      <form
        onSubmit={(event) => void handleAssociate(event)}
        className="card"
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, minWidth: 240 }}>
          Associar profissional diretamente
          <select
            value={associateProfessionalId}
            onChange={(event) => setAssociateProfessionalId(event.target.value)}
            required
          >
            <option value="" disabled>
              Selecione um profissional…
            </option>
            {availableForAssociation.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-accent" disabled={isAssociating || !associateProfessionalId}>
          {isAssociating ? 'Associando…' : 'Associar'}
        </button>
      </form>

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

      {!isLoading && links.length === 0 && !error && (
        <div className="empty-state">Nenhum profissional vinculado a este condomínio ainda.</div>
      )}

      {links.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td style={{ fontWeight: 600 }}>
                    {directoryById.get(link.professionalId)?.displayName ?? link.professionalId}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{link.source}</td>
                  <td>
                    <StatusBadge status={link.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {link.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId === link.id}
                            onClick={() => void runAction(link.id, 'approve')}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busyId === link.id}
                            onClick={() => void runAction(link.id, 'reject')}
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {link.status === 'Active' && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === link.id}
                          onClick={() => void runAction(link.id, 'block')}
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
