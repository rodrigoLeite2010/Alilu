using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

public sealed class LoginTests
{
    private const string ValidPassword = "Sup3rSecret!";

    [Fact]
    public async Task LoginAsync_WithValidCredentials_ReturnsAccessAndRefreshTokens()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);

        var tokens = await sut.LoginAsync(new LoginRequest("ana@example.com", ValidPassword));

        Assert.False(string.IsNullOrEmpty(tokens.AccessToken));
        Assert.False(string.IsNullOrEmpty(tokens.RefreshToken));
        Assert.Equal("ana@example.com", tokens.User.Email);
        Assert.Single(fixture.RefreshTokenRepository.Tokens);
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPassword_ThrowsInvalidCredentialsException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            sut.LoginAsync(new LoginRequest("ana@example.com", "senha-errada")));
    }

    [Fact]
    public async Task LoginAsync_WithNonexistentUser_ThrowsInvalidCredentialsException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            sut.LoginAsync(new LoginRequest("ninguem@example.com", ValidPassword)));
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPasswordAndWithNonexistentUser_ThrowTheSameExceptionType()
    {
        // Proteção contra enumeração de usuários: quem tenta logar não pode
        // distinguir "senha errada" de "e-mail não cadastrado" pela resposta.
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com", password: ValidPassword);

        var wrongPasswordException = await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            sut.LoginAsync(new LoginRequest("ana@example.com", "senha-errada")));

        var nonexistentUserException = await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            sut.LoginAsync(new LoginRequest("ninguem@example.com", ValidPassword)));

        Assert.Equal(wrongPasswordException.Message, nonexistentUserException.Message);
    }
}
