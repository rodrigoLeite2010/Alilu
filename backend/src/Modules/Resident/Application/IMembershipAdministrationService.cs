namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Casos de uso administrativos deste módulo (listar/visualizar vínculos,
/// aprovar/rejeitar solicitação do FLUXO 2, bloquear vínculo) — interface
/// separada de <see cref="IMembershipService"/> pelo mesmo motivo do módulo
/// Condominium separar <c>ICondominiumService</c> (admin) de operações
/// públicas: consumidores diferentes, autorização diferente. Toda operação
/// aqui começa com uma checagem de papel (<c>EnsureIsAdmin</c>), mesmo
/// padrão de <c>CondominiumService</c>.
///
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO) acrescentou <c>scopeCondominiumId</c> a
/// cada operação — resolvido pela Api via
/// <c>Administration.Application.IAdminScopeService</c> (nunca confiando no
/// que o frontend envia). Parâmetro opcional (nulo = sem restrição,
/// comportamento das etapas anteriores) para não quebrar nenhum chamador
/// existente — SuperAdmin sempre passa nulo.
/// </summary>
public interface IMembershipAdministrationService
{
    /// <summary>Fila de solicitações aguardando decisão (FLUXO 2).</summary>
    Task<IReadOnlyList<MembershipResponse>> ListPendingAsync(
        ResidentRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Moradores: listar" (PROMPT 12) — todos os vínculos do condomínio, qualquer status.</summary>
    Task<IReadOnlyList<MembershipResponse>> ListByCondominiumAsync(
        ResidentRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Moradores: visualizar" (PROMPT 12) — um vínculo específico.</summary>
    Task<MembershipResponse> GetByIdAsync(
        ResidentRequesterRole requesterRole,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Unidades: visualizar morador vinculado" (PROMPT 12) — o vínculo Active de uma unidade, se houver. Nunca lança por "não encontrado" (nulo é uma resposta válida — unidade vaga).</summary>
    Task<MembershipResponse?> GetActiveByUnitAsync(
        ResidentRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    Task<MembershipResponse> ApproveAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    Task<MembershipResponse> RejectAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Bloqueia um vínculo já Active (ex.: morador se mudou, fraude identificada) — não é "rejeitar", que só vale para Pending.</summary>
    Task<MembershipResponse> BlockAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);
}
