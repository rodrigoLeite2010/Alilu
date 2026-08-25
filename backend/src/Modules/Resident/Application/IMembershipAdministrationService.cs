namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Casos de uso administrativos deste módulo (aprovar/rejeitar solicitação
/// do FLUXO 2, bloquear vínculo) — interface separada de
/// <see cref="IMembershipService"/> pelo mesmo motivo do módulo
/// Condominium separar <c>ICondominiumService</c> (admin) de operações
/// públicas: consumidores diferentes, autorização diferente. Toda operação
/// aqui começa com uma checagem de papel (<c>EnsureIsAdmin</c>), mesmo
/// padrão de <c>CondominiumService</c>.
/// </summary>
public interface IMembershipAdministrationService
{
    /// <summary>Fila de solicitações aguardando decisão (FLUXO 2).</summary>
    Task<IReadOnlyList<MembershipResponse>> ListPendingAsync(
        ResidentRequesterRole requesterRole,
        CancellationToken cancellationToken = default);

    Task<MembershipResponse> ApproveAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default);

    Task<MembershipResponse> RejectAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default);

    /// <summary>Bloqueia um vínculo já Active (ex.: morador se mudou, fraude identificada) — não é "rejeitar", que só vale para Pending.</summary>
    Task<MembershipResponse> BlockAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default);
}
