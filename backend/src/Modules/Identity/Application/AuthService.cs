using Alilu.Modules.Identity.Domain;
using Alilu.Shared;

namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Orquestra os casos de uso de autenticação. Toda regra de "quem pode
/// fazer o quê" fica aqui (ou nas entidades de Domain); esta classe não
/// sabe nada de HTTP, EF Core ou JWT — apenas das portas (interfaces)
/// que injeta.
/// </summary>
public sealed class AuthService(
    IUserRepository userRepository,
    IRefreshTokenRepository refreshTokenRepository,
    IPasswordHasher passwordHasher,
    IRefreshTokenGenerator refreshTokenGenerator,
    IJwtTokenGenerator jwtTokenGenerator,
    IUnitOfWork unitOfWork,
    AuthOptions options) : IAuthService
{
    private const int MinimumPasswordLength = 8;

    public async Task<UserResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < MinimumPasswordLength)
        {
            throw new WeakPasswordException();
        }

        var email = Email.Create(request.Email);

        if (await userRepository.ExistsByEmailAsync(email.Value, cancellationToken))
        {
            throw new EmailAlreadyInUseException();
        }

        // Segunda camada de defesa: mesmo que a validação da entidade também
        // rejeite papéis privilegiados, falhar cedo aqui produz um erro mais
        // claro e evita hashear a senha à toa.
        if (request.Role is UserRole.CondominiumAdmin or UserRole.SuperAdmin)
        {
            throw new InvalidRoleForSelfRegistrationException();
        }

        var passwordHash = passwordHasher.Hash(request.Password);
        var user = User.Register(request.Name, email, request.Phone, passwordHash, request.Role);

        await userRepository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(user);
    }

    public async Task<AuthTokensResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        Email email;
        try
        {
            email = Email.Create(request.Email);
        }
        catch (DomainException)
        {
            // E-mail com formato inválido é, para quem está tentando logar,
            // indistinguível de "credenciais inválidas".
            throw new InvalidCredentialsException();
        }

        var user = await userRepository.GetByEmailAsync(email.Value, cancellationToken);
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new InvalidCredentialsException();
        }

        if (!user.IsActive)
        {
            throw new UserBlockedException();
        }

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthTokensResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default)
    {
        var incomingHash = refreshTokenGenerator.Hash(request.RefreshToken);
        var existingToken = await refreshTokenRepository.GetByTokenHashAsync(incomingHash, cancellationToken);

        if (existingToken is null || !existingToken.IsActive)
        {
            throw new InvalidRefreshTokenException();
        }

        var user = await userRepository.GetByIdAsync(existingToken.UserId, cancellationToken);
        if (user is null || !user.IsActive)
        {
            throw new InvalidRefreshTokenException();
        }

        // Rotação: o token usado é revogado e nunca mais pode ser reutilizado.
        existingToken.Revoke();

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task RevokeAsync(RevokeRequest request, CancellationToken cancellationToken = default)
    {
        var incomingHash = refreshTokenGenerator.Hash(request.RefreshToken);
        var existingToken = await refreshTokenRepository.GetByTokenHashAsync(incomingHash, cancellationToken);

        if (existingToken is null)
        {
            throw new InvalidRefreshTokenException();
        }

        existingToken.Revoke();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserResponse> GetMeAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            throw new UserNotFoundException();
        }

        return ToResponse(user);
    }

    public async Task<IReadOnlyList<UserResponse>> GetUsersByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        var users = await userRepository.ListByIdsAsync(userIds, cancellationToken);
        return users.Select(ToResponse).ToList();
    }

    private async Task<AuthTokensResponse> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var (accessToken, accessTokenExpiresAtUtc) = jwtTokenGenerator.GenerateAccessToken(user);

        var (rawRefreshToken, refreshTokenHash) = refreshTokenGenerator.Generate();
        var refreshTokenExpiresAtUtc = DateTime.UtcNow.Add(options.RefreshTokenLifetime);
        var refreshToken = RefreshToken.Create(user.Id, refreshTokenHash, refreshTokenExpiresAtUtc);

        await refreshTokenRepository.AddAsync(refreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new AuthTokensResponse(
            accessToken,
            accessTokenExpiresAtUtc,
            rawRefreshToken,
            refreshTokenExpiresAtUtc,
            ToResponse(user));
    }

    private static UserResponse ToResponse(User user) => new(
        user.Id,
        user.Name,
        user.Email.Value,
        user.Phone,
        user.Role,
        user.Status,
        user.CreatedAt);
}
