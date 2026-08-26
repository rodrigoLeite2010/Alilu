namespace Alilu.Modules.Identity.Application;

public interface IAuthService
{
    Task<UserResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default);

    Task RevokeAsync(RevokeRequest request, CancellationToken cancellationToken = default);

    Task<UserResponse> GetMeAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca em lote (Etapa 12) — do lado de quem é consultado, mesmo
    /// espírito de <c>IProfessionalDirectoryService.GetProfessionalUserIdAsync</c>
    /// (Etapa 11): usado pela Api para enriquecer listagens administrativas
    /// (nome/email de moradores/profissionais) sem nenhuma query N+1. Ids
    /// desconhecidos são omitidos do resultado, nunca lançam.
    /// </summary>
    Task<IReadOnlyList<UserResponse>> GetUsersByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
}
