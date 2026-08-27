import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../modules/auth/AuthProvider';
import { condominiumApi } from '../modules/condominium/api';
import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';
import type { Condominium, CreateCondominiumPayload } from '../modules/condominium/types';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const EMPTY_FORM: CreateCondominiumPayload = {
  name: '',
  cnpj: '',
  address: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

/** Exibe só os dígitos formatados — o backend já normaliza/valida (Cnpj.Create), aqui é só cosmético. */
function formatCnpj(digits: string): string {
  if (digits.length !== 14) {
    return digits;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { title?: string } } }).response;
    if (response?.data?.title) {
      return response.data.title;
    }
  }
  return fallback;
}

/**
 * Criar/listar condomínios (SuperAdmin-only — POST /api/admin/condominiums
 * rejeita CondominiumAdmin, ver CondominiumsController.Create). Faltava no
 * admin-web até agora: a criação só existia via chamada direta à Api
 * (Postman/curl) — esta tela cobre exatamente isso, sem inventar nenhum
 * campo além dos que CreateCondominiumRequest já pede.
 */
export function CondominiosPage() {
  const { user } = useAuth();
  const { reload: reloadScope } = useCondominiumScope();
  const isSuperAdmin = user?.role === 'SuperAdmin';

  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateCondominiumPayload>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);

    condominiumApi
      .list()
      .then(setCondominiums)
      .catch(() => setError('Não foi possível carregar os condomínios.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateField<K extends keyof CreateCondominiumPayload>(field: K, value: CreateCondominiumPayload[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsCreating(true);

    try {
      const created = await condominiumApi.create({
        ...form,
        cnpj: form.cnpj.trim(),
        state: form.state.trim().toUpperCase(),
        zipCode: form.zipCode.trim(),
      });
      setCondominiums((current) => [...current, created]);
      setForm(EMPTY_FORM);
      // O seletor de condomínio (header) busca a lista separadamente —
      // recarrega para o recém-criado aparecer lá sem precisar de F5.
      reloadScope();
    } catch (creationError) {
      setFormError(
        extractErrorMessage(creationError, 'Não foi possível criar o condomínio — confira os dados (CNPJ, CEP e estado são validados).'),
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div>
        <div className="page-title">
          <h1>Condomínios</h1>
        </div>
        <div className="empty-state">
          Apenas o SuperAdmin pode cadastrar novos condomínios. Como administrador deste condomínio, use o menu
          "Unidades" para gerenciar as unidades dele.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">
        <h1>Condomínios</h1>
        <p>Cadastro de novos condomínios na plataforma (SuperAdmin)</p>
      </div>

      <form onSubmit={(event) => void handleCreate(event)} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, gridColumn: 'span 2' }}>
            Nome
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Ex.: Monte Carlo"
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            CNPJ
            <input
              value={form.cnpj}
              onChange={(event) => updateField('cnpj', event.target.value)}
              placeholder="00.000.000/0001-00"
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, gridColumn: 'span 2' }}>
            Endereço
            <input
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              placeholder="Ex.: Av. Paulista"
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            Número
            <input value={form.number} onChange={(event) => updateField('number', event.target.value)} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            Bairro
            <input
              value={form.neighborhood}
              onChange={(event) => updateField('neighborhood', event.target.value)}
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            Cidade
            <input value={form.city} onChange={(event) => updateField('city', event.target.value)} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            Estado
            <select value={form.state} onChange={(event) => updateField('state', event.target.value)} required>
              <option value="" disabled>
                UF…
              </option>
              {BRAZILIAN_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            CEP
            <input
              value={form.zipCode}
              onChange={(event) => updateField('zipCode', event.target.value)}
              placeholder="00000-000"
              required
            />
          </label>
        </div>

        {formError && (
          <div className="error-banner" role="alert" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}

        <button type="submit" className="btn btn-accent" disabled={isCreating} style={{ marginTop: 12 }}>
          {isCreating ? 'Criando…' : 'Criar condomínio'}
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

      {!isLoading && condominiums.length === 0 && !error && (
        <div className="empty-state">Nenhum condomínio cadastrado ainda.</div>
      )}

      {condominiums.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Cidade/UF</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {condominiums.map((condominium) => (
                <tr key={condominium.id}>
                  <td style={{ fontWeight: 600 }}>{condominium.name}</td>
                  <td>{formatCnpj(condominium.cnpj)}</td>
                  <td>
                    {condominium.city}/{condominium.state}
                  </td>
                  <td>
                    <StatusBadge status={condominium.status} />
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
