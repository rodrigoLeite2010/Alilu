namespace Alilu.Modules.Condominium.Application;

public interface ICondominiumService
{
    /// <summary>
    /// Etapa 12 (PROMPT 12): restrito a SuperAdmin — ver comentário de
    /// design em <c>CondominiumService.EnsureIsSuperAdmin</c>. Explícita
    /// mudança de comportamento em relação à Etapa 04 (antes,
    /// CondominiumAdmin-ou-SuperAdmin).
    /// </summary>
    Task<CondominiumResponse> CreateCondominiumAsync(
        CondominiumRequesterRole requesterRole,
        CreateCondominiumRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// <paramref name="scopeCondominiumId"/> (Etapa 12, opcional — nulo
    /// preserva o comportamento anterior a esta etapa): quando informado
    /// pela Api (resolvido via <c>Administration.IAdminScopeService</c>,
    /// nunca vindo do frontend), restringe o resultado ao condomínio do
    /// CondominiumAdmin autenticado. SuperAdmin sempre passa nulo (escopo
    /// global).
    /// </summary>
    Task<IReadOnlyList<CondominiumResponse>> ListCondominiumsAsync(
        CondominiumRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary><paramref name="scopeCondominiumId"/>: ver <see cref="ListCondominiumsAsync"/>. Aqui, quando informado, precisa bater com <c>request.CondominiumId</c> — senão <see cref="InsufficientPermissionsException"/>.</summary>
    Task<CondominiumUnitResponse> CreateUnitAsync(
        CondominiumRequesterRole requesterRole,
        CreateUnitRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary><paramref name="scopeCondominiumId"/>: ver <see cref="CreateUnitAsync"/> — precisa bater com <paramref name="condominiumId"/>.</summary>
    Task<IReadOnlyList<CondominiumUnitResponse>> ListUnitsAsync(
        CondominiumRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Unidades: visualizar morador vinculado" (PROMPT 12) parte do lado do Condominium — devolve os dados da unidade; quem é o morador vinculado é responsabilidade do módulo Resident, composta pela Api (nenhum módulo referencia outro).</summary>
    Task<CondominiumUnitResponse> GetUnitAsync(
        CondominiumRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Unidades: editar" (PROMPT 12). <paramref name="scopeCondominiumId"/>: ver <see cref="CreateUnitAsync"/> — precisa bater com o condomínio ATUAL da unidade (<see cref="EditUnitRequest"/> não permite trocar de condomínio).</summary>
    Task<CondominiumUnitResponse> EditUnitAsync(
        CondominiumRequesterRole requesterRole,
        EditUnitRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>"Unidades: bloquear" (PROMPT 12) — desativa a unidade (<see cref="Domain.CondominiumUnit.Deactivate"/>). Reativar não foi pedido nesta etapa (ver README) — o Domain já suporta (<see cref="Domain.CondominiumUnit.Activate"/>), sem endpoint/Application correspondente ainda.</summary>
    Task<CondominiumUnitResponse> BlockUnitAsync(
        CondominiumRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary><paramref name="scopeCondominiumId"/>: ver <see cref="CreateUnitAsync"/> — precisa bater com <c>request.CondominiumId</c>.</summary>
    Task<CondominiumInvitationCreatedResponse> CreateInvitationAsync(
        CondominiumRequesterRole requesterRole,
        CreateInvitationRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary><paramref name="scopeCondominiumId"/>: ver <see cref="CreateUnitAsync"/> — precisa bater com o condomínio do convite já buscado.</summary>
    Task<CondominiumInvitationResponse> GetInvitationAsync(
        CondominiumRequesterRole requesterRole,
        Guid invitationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);
}
