namespace Alilu.Modules.Identity.Application;

public interface IAuthService
{
    Task<UserResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default);

    Task RevokeAsync(RevokeRequest request, CancellationToken cancellationToken = default);

    Task<UserResponse> GetMeAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Define a foto pessoal do usuário autenticado (Etapa 21 — React
    /// Native: avatar clicável ao lado do nome, em qualquer papel).
    /// <paramref name="photoUrl"/> já deve ser uma URL absoluta pronta para
    /// uso (ver <c>Alilu.Api.Services.IUserPhotoStorage</c>, que decodifica
    /// e valida o upload antes de chamar este método) — este serviço só
    /// persiste o resultado.
    /// </summary>
    Task<UserResponse> SetMyPhotoAsync(Guid userId, string photoUrl, CancellationToken cancellationToken = default);

    /// <summary>Remove a foto pessoal do usuário autenticado — volta ao fallback de iniciais (React Native: componente `Avatar`).</summary>
    Task<UserResponse> RemoveMyPhotoAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca em lote (Etapa 12) — do lado de quem é consultado, mesmo
    /// espírito de <c>IProfessionalDirectoryService.GetProfessionalUserIdAsync</c>
    /// (Etapa 11): usado pela Api para enriquecer listagens administrativas
    /// (nome/email de moradores/profissionais) sem nenhuma query N+1. Ids
    /// desconhecidos são omitidos do resultado, nunca lançam.
    /// </summary>
    Task<IReadOnlyList<UserResponse>> GetUsersByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
}
