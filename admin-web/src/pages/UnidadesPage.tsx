import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { condominiumApi } from '../modules/condominium/api';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import type { CondominiumUnit, UnitType } from '../modules/condominium/types';
import { residentApi } from '../modules/resident/api';
import type { Membership } from '../modules/resident/types';

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: 'Apartment', label: 'Apartamento' },
  { value: 'House', label: 'Casa' },
  { value: 'Commercial', label: 'Comercial' },
];

/** "Unidades: criar, editar, bloquear, visualizar morador vinculado" (PROMPT 12). */
export function UnidadesPage() {
  const { selected } = useCondominiumScope();
  const [units, setUnits] = useState<CondominiumUnit[]>([]);
  const [activeMemberships, setActiveMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState<UnitType>('Apartment');

  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<UnitType>('Apartment');
  const [isCreating, setIsCreating] = useState(false);

  const residentByUnitId = useMemo(() => {
    const map = new Map<string, Membership>();
    for (const membership of activeMemberships) {
      if (membership.status === 'Active') {
        map.set(membership.unitId, membership);
      }
    }
    return map;
  }, [activeMemberships]);

  const load = useCallback(() => {
    if (!selected) {
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([condominiumApi.listUnits(selected.id), residentApi.listByCondominium(selected.id)])
      .then(([unitList, memberships]) => {
        setUnits(unitList);
        setActiveMemberships(memberships);
      })
      .catch(() => setError('Não foi possível carregar as unidades.'))
      .finally(() => setIsLoading(false));
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!selected || !newCode.trim()) {
      return;
    }

    setActionError(null);
    setIsCreating(true);

    try {
      const unit = await condominiumApi.createUnit(selected.id, { code: newCode.trim(), type: newType });
      setUnits((current) => [...current, unit]);
      setNewCode('');
      setNewType('Apartment');
    } catch {
      setActionError('Não foi possível criar a unidade — verifique se o código já existe.');
    } finally {
      setIsCreating(false);
    }
  }

  function startEdit(unit: CondominiumUnit) {
    setEditingId(unit.id);
    setEditCode(unit.code);
    setEditType(unit.type);
  }

  async function saveEdit(unitId: string) {
    setActionError(null);
    setBusyId(unitId);

    try {
      const updated = await condominiumApi.editUnit(unitId, { code: editCode.trim(), type: editType });
      setUnits((current) => current.map((unit) => (unit.id === updated.id ? updated : unit)));
      setEditingId(null);
    } catch {
      setActionError('Não foi possível salvar a edição — verifique se o código já existe.');
    } finally {
      setBusyId(null);
    }
  }

  async function blockUnit(unitId: string) {
    setActionError(null);
    setBusyId(unitId);

    try {
      const updated = await condominiumApi.blockUnit(unitId);
      setUnits((current) => current.map((unit) => (unit.id === updated.id ? updated : unit)));
    } catch {
      setActionError('Não foi possível bloquear a unidade.');
    } finally {
      setBusyId(null);
    }
  }

  if (!selected) {
    return <p>Selecione um condomínio.</p>;
  }

  return (
    <div>
      <h1>Unidades</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{selected.name}</p>

      <form
        onSubmit={(event) => void handleCreate(event)}
        className="card"
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          Código
          <input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="Ex.: 101" required />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          Tipo
          <select value={newType} onChange={(event) => setNewType(event.target.value as UnitType)}>
            {UNIT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-accent" disabled={isCreating}>
          {isCreating ? 'Criando…' : 'Nova unidade'}
        </button>
      </form>

      {isLoading && <p>Carregando…</p>}
      {error && <p style={{ color: 'var(--alilu-error)' }}>{error}</p>}
      {actionError && <p style={{ color: 'var(--alilu-error)' }}>{actionError}</p>}

      {!isLoading && units.length === 0 && !error && <p>Nenhuma unidade cadastrada ainda.</p>}

      {units.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Morador vinculado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const resident = residentByUnitId.get(unit.id);
                const isEditing = editingId === unit.id;

                return (
                  <tr key={unit.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input value={editCode} onChange={(event) => setEditCode(event.target.value)} />
                        </td>
                        <td>
                          <select value={editType} onChange={(event) => setEditType(event.target.value as UnitType)}>
                            {UNIT_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <StatusBadge status={unit.status} />
                        </td>
                        <td>{resident ? resident.userName ?? '(sem nome)' : <span style={{ color: 'var(--text-muted)' }}>Vaga</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn"
                              disabled={busyId === unit.id}
                              onClick={() => void saveEdit(unit.id)}
                            >
                              Salvar
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 600 }}>{unit.code}</td>
                        <td>{UNIT_TYPES.find((type) => type.value === unit.type)?.label ?? unit.type}</td>
                        <td>
                          <StatusBadge status={unit.status} />
                        </td>
                        <td>
                          {resident ? (
                            <div>
                              <div>{resident.userName ?? '(nome indisponível)'}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{resident.userEmail}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Vaga</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn btn-secondary" onClick={() => startEdit(unit)}>
                              Editar
                            </button>
                            {unit.status === 'Active' && (
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={busyId === unit.id}
                                onClick={() => void blockUnit(unit.id)}
                              >
                                Bloquear
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
