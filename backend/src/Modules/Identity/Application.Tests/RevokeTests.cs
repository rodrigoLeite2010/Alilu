using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

public sealed class RevokeTests
{
    private const string ValidPassword = "Sup3rSecret!";

    [Fact]
    public async Task RevokeAsync_WithValidToken_MarksItAsRevoked()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);
        var tokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));

        await sut.RevokeAsync(new RevokeRequest(tokens.RefreshToken));

        var tokenHash = fixture.RefreshTokenGenerator.Hash(tokens.RefreshToken);
        var revokedToken = Assert.Single(fixture.RefreshTokenRepository.Tokens, t => t.TokenHash == tokenHash);
        Assert.True(revokedToken.IsRevoked);
    }

    [Fact]
    public async Task RevokeAsync_TokenCannotBeUsedToRefreshAfterwards()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);
        var tokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));
        await sut.RevokeAsync(new RevokeRequest(tokens.RefreshToken));

        // Este é o efeito prático de "logout": o token não serve mais para nada.
        await Assert.ThrowsAsync<InvalidRefreshTokenException>(() =>
            sut.RefreshAsync(new RefreshRequest(tokens.RefreshToken)));
    }

    [Fact]
    public async Task RevokeAsync_WithUnknownToken_ThrowsInvalidRefreshTokenException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InvalidRefreshTokenException>(() =>
            sut.RevokeAsync(new RevokeRequest("token-que-nunca-existiu")));
    }

    [Fact]
    public async Task RevokeAsync_CalledTwiceOnTheSameToken_IsIdempotentAndDoesNotThrow()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);
        var tokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));

        await sut.RevokeAsync(new RevokeRequest(tokens.RefreshToken));
        var exception = await Record.ExceptionAsync(() => sut.RevokeAsync(new RevokeRequest(tokens.RefreshToken)));

        Assert.Null(exception);
    }
}
