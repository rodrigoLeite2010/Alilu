using Alilu.Modules.Resident.Domain;

namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Porta de persistência de <see cref="CondominiumMembership"/>.
/// Implementada em Infrastructure (EF Core); aqui é só a abstração usada
/// pela Application.
/// </summary>
public interface IMembershipRepository
{
    Task<CondominiumMembership?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Todos os vínculos do usuário, mais recente primeiro — usado tanto para achar o vínculo Active (gate do app) quanto para listar o histórico.</summary>
    Task<IReadOnlyList<CondominiumMembership>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Checagem de duplicidade (ver <see cref="DuplicateMembershipException"/>) — Pending e Active contam como "já vinculado"; Rejected/Blocked não impedem uma nova tentativa.</summary>
    Task<bool> ExistsActiveOrPendingAsync(Guid userId, Guid condominiumId, Guid unitId, CancellationToken cancellationToken = default);

    /// <summary>Fila de aprovação administrativa (FLUXO 2) — ver <see cref="IMembershipAdministrationService.ListPendingAsync"/>.</summary>
    Task<IReadOnlyList<CondominiumMembership>> ListPendingAsync(CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumMembership membership, CancellationToken cancellationToken = default);
}
