using Alilu.Modules.Identity.Domain;
using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

public sealed class RegisterTests
{
    [Fact]
    public async Task RegisterAsync_WithValidData_CreatesUserWithNormalizedEmailAndRequestedRole()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        var result = await sut.RegisterAsync(
            new RegisterRequest("Ana Souza", "Ana@Example.com", "11999990000", "Sup3rSecret!", UserRole.Resident));

        Assert.Equal("ana@example.com", result.Email);
        Assert.Equal(UserRole.Resident, result.Role);
        Assert.Equal(UserStatus.Active, result.Status);
        Assert.Single(fixture.UserRepository.Users);
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateEmail_ThrowsEmailAlreadyInUseException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com");

        await Assert.ThrowsAsync<EmailAlreadyInUseException>(() =>
            sut.RegisterAsync(new RegisterRequest("Outra Ana", "ana@example.com", null, "Sup3rSecret!", UserRole.Resident)));
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateEmailInDifferentCasing_ThrowsEmailAlreadyInUseException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterUserAsync(sut, email: "ana@example.com");

        await Assert.ThrowsAsync<EmailAlreadyInUseException>(() =>
            sut.RegisterAsync(new RegisterRequest("Outra Ana", "ANA@EXAMPLE.COM", null, "Sup3rSecret!", UserRole.Resident)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234567")]
    public async Task RegisterAsync_WithPasswordShorterThanEightCharacters_ThrowsWeakPasswordException(string weakPassword)
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<WeakPasswordException>(() =>
            sut.RegisterAsync(new RegisterRequest("Beto", "beto@example.com", null, weakPassword, UserRole.Resident)));
    }

    [Theory]
    [InlineData(UserRole.CondominiumAdmin)]
    [InlineData(UserRole.SuperAdmin)]
    public async Task RegisterAsync_WithPrivilegedRole_ThrowsInvalidRoleForSelfRegistrationException(UserRole privilegedRole)
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InvalidRoleForSelfRegistrationException>(() =>
            sut.RegisterAsync(new RegisterRequest("Malicioso", "hacker@example.com", null, "Sup3rSecret!", privilegedRole)));
    }

    [Fact]
    public async Task RegisterAsync_NeverStoresThePasswordInPlainText()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        const string plainTextPassword = "Sup3rSecret!";

        await fixture.RegisterUserAsync(sut, password: plainTextPassword);

        var storedUser = Assert.Single(fixture.UserRepository.Users);
        Assert.NotEqual(plainTextPassword, storedUser.PasswordHash);
        Assert.True(fixture.PasswordHasher.Verify(plainTextPassword, storedUser.PasswordHash));
    }
}
