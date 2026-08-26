import { useCondominiumScope } from '../modules/condominium/CondominiumScopeContext';

/**
 * Seletor de condomínio — só aparece quando há mais de uma opção (na
 * prática, só para SuperAdmin: um CondominiumAdmin sempre recebe uma lista
 * de um único condomínio, o próprio, já filtrada pela Api — ver
 * `CondominiumScopeContext`). Escolher aqui nunca é o que autoriza nada:
 * é só "o que a tela mostra"; toda chamada segue restrita, no backend, ao
 * escopo real do usuário autenticado.
 */
export function CondominiumPicker() {
  const { condominiums, selected, selectCondominium } = useCondominiumScope();

  if (condominiums.length <= 1) {
    return null;
  }

  return (
    <select
      aria-label="Condomínio"
      value={selected?.id ?? ''}
      onChange={(event) => selectCondominium(event.target.value)}
    >
      {condominiums.map((condominium) => (
        <option key={condominium.id} value={condominium.id}>
          {condominium.name}
        </option>
      ))}
    </select>
  );
}
