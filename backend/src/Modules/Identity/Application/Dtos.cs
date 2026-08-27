using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application;

public sealed record RegisterRequest(string Name, string Email, string? Phone, string Password, UserRole Role);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record RevokeRequest(string RefreshToken);

/// <summary>Dados públicos do usuário — nunca inclui PasswordHash.</summary>
public sealed record UserResponse(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    string? PhotoUrl,
    UserRole Role,
    UserStatus Status,
    DateTime CreatedAt);

public sealed record AuthTokensResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    UserResponse User);
