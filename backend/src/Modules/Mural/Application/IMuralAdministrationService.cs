namespace Alilu.Modules.Mural.Application;

/// <summary>
/// Casos de uso administrativos deste módulo ("síndico/admin pode
/// bloquear/remover um post depois", decisão de Rodrigo confirmada via
/// AskUserQuestion) — mesmo raciocínio de
/// <c>Alilu.Modules.Recommendations.Application.IRecommendationAdministrationService</c>.
/// Toda operação aqui começa com uma checagem de papel (<c>EnsureIsAdmin</c>).
///
/// <c>scopeCondominiumId</c> — resolvido pela Api via
/// <c>Administration.Application.IAdminScopeService</c> (nunca confiando no
/// que o frontend envia). Nulo = sem restrição (SuperAdmin); não-nulo
/// restringe ao condomínio do CondominiumAdmin — mesmo padrão de todos os
/// módulos administrativos desde a Etapa 12.
/// </summary>
public interface IMuralAdministrationService
{
    /// <summary>admin-web: página Mural — todos os posts (qualquer status) de um condomínio.</summary>
    Task<IReadOnlyList<MuralPostResponse>> ListByCondominiumAsync(
        MuralRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>admin-web: botão "Bloquear". Só a partir de <see cref="Domain.MuralPostStatus.Visible"/> — lança <see cref="MuralPostAlreadyBlockedException"/> caso contrário.</summary>
    Task<MuralPostResponse> BlockAsync(
        MuralRequesterRole requesterRole,
        Guid blockedByUserId,
        Guid muralPostId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);
}
