import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import { muralApi } from '../modules/mural/api';
import { MURAL_POST_TYPE_LABEL } from '../modules/mural/muralFormat';
import type { MuralPost } from '../modules/mural/types';

/** "Mural: bloquear" (Etapa 23 — síndico/admin pode bloquear um post depois de publicado), mesmo padrão de `RecomendacoesPage`. */
export function MuralPage() {
  const { selected } = useCondominiumScope();
  const [posts, setPosts] = useState<MuralPost[]>([]);
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

    muralApi
      .listByCondominium(selected.id)
      .then(setPosts)
      .catch(() => setError('Não foi possível carregar o mural.'))
      .finally(() => setIsLoading(false));
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function runBlock(id: string) {
    setActionError(null);
    setBusyId(id);

    try {
      const updated = await muralApi.block(id);
      setPosts((current) => current.map((p) => (p.id === updated.id ? updated : p)));
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
        <h1>Mural</h1>
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

      {!isLoading && posts.length === 0 && !error && (
        <div className="empty-state">Nenhum post no mural deste condomínio ainda.</div>
      )}

      {posts.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Texto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td style={{ fontWeight: 600 }}>{MURAL_POST_TYPE_LABEL[post.type]}</td>
                  <td style={{ maxWidth: 320 }}>{post.content}</td>
                  <td>
                    <StatusBadge status={post.status} />
                  </td>
                  <td>
                    {post.status === 'Visible' && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === post.id}
                        onClick={() => void runBlock(post.id)}
                      >
                        Bloquear
                      </button>
                    )}
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
