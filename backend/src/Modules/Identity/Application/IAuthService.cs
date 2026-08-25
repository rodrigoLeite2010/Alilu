namespace Alilu.Modules.Identity.Application;

public interface IAuthService
{
    Task<UserResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<AuthTokensResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default);

    Task RevokeAsync(RevokeRequest request, CancellationToken cancellationToken = default);

    Task<UserResponse> GetMeAsync(Guid userId, CancellationToken cancellationToken = default);
}
