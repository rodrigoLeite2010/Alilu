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

    /// <summary>
    /// Fila de aprovação administrativa (FLUXO 2) — ver
    /// <see cref="IMembershipAdministrationService.ListPendingAsync"/>.
    /// <paramref name="condominiumId"/> (Etapa 12, opcional) filtra para um
    /// único condomínio — usado quando quem pede é um CondominiumAdmin
    /// (escopo resolvido pela Api); nulo lista de todos os condomínios
    /// (SuperAdmin).
    /// </summary>
    Task<IReadOnlyList<CondominiumMembership>> ListPendingAsync(Guid? condominiumId = null, CancellationToken cancellationToken = default);

    /// <summary>"Moradores: listar" (Etapa 12) — todos os vínculos de um condomínio, qualquer status, mais recente primeiro.</summary>
    Task<IReadOnlyList<CondominiumMembership>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary>
    /// "Unidades: visualizar morador vinculado" (Etapa 12) — o vínculo
    /// Active de uma unidade específica (no máximo um, pela regra de
    /// duplicidade — ver <see cref="DuplicateMembershipException"/>).
    /// Usado pela Api ao compor a tela de detalhe de uma unidade
    /// (Resident não referencia Condominium, então quem junta os dois é a
    /// Api).
    /// </summary>
    Task<CondominiumMembership?> GetActiveByUnitIdAsync(Guid unitId, CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumMembership membership, CancellationToken cancellationToken = default);
}
