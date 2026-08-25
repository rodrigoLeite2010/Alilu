using Alilu.Modules.Identity.Domain;
using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

public sealed class RefreshTests
{
    private const string ValidPassword = "Sup3rSecret!";

    [Fact]
    public async Task RefreshAsync_WithValidToken_RotatesToANewToken()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);
        var loginTokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));

        var refreshed = await sut.RefreshAsync(new RefreshRequest(loginTokens.RefreshToken));

        Assert.NotEqual(loginTokens.RefreshToken, refreshed.RefreshToken);
        Assert.Equal(2, fixture.RefreshTokenRepository.Tokens.Count);

        var oldTokenHash = fixture.RefreshTokenGenerator.Hash(loginTokens.RefreshToken);
        var oldToken = Assert.Single(fixture.RefreshTokenRepository.Tokens, t => t.TokenHash == oldTokenHash);
        Assert.True(oldToken.IsRevoked);
    }

    [Fact]
    public async Task RefreshAsync_WithAlreadyUsedToken_ThrowsInvalidRefreshTokenException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);
        var loginTokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));
        await sut.RefreshAsync(new RefreshRequest(loginTokens.RefreshToken));

        // O mesmo refresh token usado uma vez (já rotacionado/revogado) não
        // pode ser reutilizado — proteção contra replay de token roubado.
        await Assert.ThrowsAsync<InvalidRefreshTokenException>(() =>
            sut.RefreshAsync(new RefreshRequest(loginTokens.RefreshToken)));
    }

    [Fact]
    public async Task RefreshAsync_WithUnknownToken_ThrowsInvalidRefreshTokenException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InvalidRefreshTokenException>(() =>
            sut.RefreshAsync(new RefreshRequest("token-que-nunca-existiu")));
    }

    [Fact]
    public async Task RefreshAsync_WithExpiredToken_ThrowsInvalidRefreshTokenException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var user = await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);

        var (rawToken, tokenHash) = fixture.RefreshTokenGenerator.Generate();
        var almostExpiredToken = RefreshToken.Create(user.Id, tokenHash, DateTime.UtcNow.AddMilliseconds(100));
        await fixture.RefreshTokenRepository.AddAsync(almostExpiredToken);

        await Task.Delay(250);

        await Assert.ThrowsAsync<InvalidRefreshTokenException>(() =>
            sut.RefreshAsync(new RefreshRequest(rawToken)));
    }
}
