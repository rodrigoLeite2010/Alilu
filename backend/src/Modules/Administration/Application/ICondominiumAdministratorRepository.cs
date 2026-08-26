using Alilu.Modules.Administration.Domain;

namespace Alilu.Modules.Administration.Application;

/// <summary>Porta de persistência de <see cref="CondominiumAdministrator"/>.</summary>
public interface ICondominiumAdministratorRepository
{
    /// <summary>A atribuição atual de um usuário (no máximo uma — ver decisão de escopo em <see cref="CondominiumAdministrator"/>). Base de <see cref="AdminScopeService.ResolveScopeAsync"/>.</summary>
    Task<CondominiumAdministrator?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Todas as atribuições — só SuperAdmin consulta (ver <see cref="IAdminScopeService.ListAssignmentsAsync"/>).</summary>
    Task<IReadOnlyList<CondominiumAdministrator>> ListAsync(CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumAdministrator administrator, CancellationToken cancellationToken = default);
}
