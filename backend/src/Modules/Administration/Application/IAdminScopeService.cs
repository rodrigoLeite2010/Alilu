namespace Alilu.Modules.Administration.Application;

/// <summary>
/// Núcleo do PROMPT 12 (AUTORIZAÇÃO): resolve, inteiramente no backend, qual
/// condomínio um <c>CondominiumAdmin</c> autenticado pode administrar — e
/// permite a um SuperAdmin atribuir/reatribuir essa vinculação (sem isto,
/// nenhum CondominiumAdmin jamais teria escopo algum, já que
/// <c>Identity.User.Role</c> só guarda o papel, nunca um condomínio).
/// </summary>
public interface IAdminScopeService
{
    /// <summary>
    /// Chamado pela Api no início de TODO endpoint administrativo (deste
    /// módulo e dos módulos Resident/Professional/Condominium/
    /// Recommendations), antes de qualquer outra chamada de módulo.
    /// SuperAdmin sempre recebe escopo global (<see cref="AdminScope.CondominiumId"/>
    /// nulo). CondominiumAdmin sem nenhuma atribuição lança
    /// <see cref="AdminNotAssignedToCondominiumException"/>. Qualquer outro
    /// papel (Resident/Professional) lança <see cref="InsufficientPermissionsException"/>
    /// — mesma segunda camada de defesa dos demais módulos.
    /// </summary>
    Task<AdminScope> ResolveScopeAsync(
        AdministrationRequesterRole requesterRole,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Associa (ou reatribui — upsert, ver <c>Domain.CondominiumAdministrator</c>)
    /// um usuário <c>CondominiumAdmin</c> a um condomínio. Só SuperAdmin — a
    /// existência do usuário/papel e do condomínio é confirmada pela Api
    /// (composição raiz) antes de chamar isto, ver
    /// <c>AdminCondominiumAdministratorsController</c>.
    /// </summary>
    Task<CondominiumAdministratorResponse> AssignAsync(
        AdministrationRequesterRole requesterRole,
        Guid targetUserId,
        Guid condominiumId,
        CancellationToken cancellationToken = default);

    /// <summary>Lista todas as atribuições existentes — só SuperAdmin.</summary>
    Task<IReadOnlyList<CondominiumAdministratorResponse>> ListAssignmentsAsync(
        AdministrationRequesterRole requesterRole,
        CancellationToken cancellationToken = default);
}
