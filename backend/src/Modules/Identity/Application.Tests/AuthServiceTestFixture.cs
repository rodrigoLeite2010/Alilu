using Alilu.Modules.Identity.Application.Tests.TestDoubles;
using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application.Tests;

/// <summary>
/// Monta um <see cref="AuthService"/> real com dependências fake (em
/// memória) — exceto <see cref="IPasswordHasher"/> e
/// <see cref="IRefreshTokenGenerator"/>, que usam as implementações reais
/// de Domain (PBKDF2 / SHA-256, só BCL), porque são baratas e é
/// justamente esse comportamento (hash, rotação de token) que muitos
/// testes aqui querem exercitar de verdade.
/// </summary>
internal sealed class AuthServiceTestFixture
{
    public InMemoryUserRepository UserRepository { get; } = new();

    public InMemoryRefreshTokenRepository RefreshTokenRepository { get; } = new();

    public IPasswordHasher PasswordHasher { get; } = new PasswordHasher();

    public IRefreshTokenGenerator RefreshTokenGenerator { get; } = new RefreshTokenGenerator();

    public FakeJwtTokenGenerator JwtTokenGenerator { get; } = new();

    public AuthOptions Options { get; init; } = new() { RefreshTokenLifetime = TimeSpan.FromDays(30) };

    public AuthService CreateSut() => new(
        UserRepository,
        RefreshTokenRepository,
        PasswordHasher,
        RefreshTokenGenerator,
        JwtTokenGenerator,
        new NoOpUnitOfWork(),
        Options);

    /// <summary>Atalho para os testes que precisam de um usuário já cadastrado antes do cenário sob teste.</summary>
    public async Task<UserResponse> RegisterUserAsync(
        AuthService sut,
        string name = "Ana Souza",
        string email = "ana@example.com",
        string password = "Sup3rSecret!",
        UserRole role = UserRole.Resident)
    {
        return await sut.RegisterAsync(new RegisterRequest(name, email, "11999990000", password, role));
    }
}
