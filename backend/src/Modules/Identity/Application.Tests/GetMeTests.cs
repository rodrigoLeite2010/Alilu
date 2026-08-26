using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

public sealed class GetMeTests
{
    [Fact]
    public async Task GetMeAsync_WithValidUserId_ReturnsThatUsersData()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var registered = await fixture.RegisterUserAsync(sut, email: "ana@example.com");

        var me = await sut.GetMeAsync(registered.Id);

        Assert.Equal(registered.Id, me.Id);
        Assert.Equal("ana@example.com", me.Email);
    }

    [Fact]
    public async Task GetMeAsync_WithUnknownUserId_ThrowsUserNotFoundException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<UserNotFoundException>(() => sut.GetMeAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetUsersByIdsAsync_MixOfKnownAndUnknownIds_ReturnsOnlyKnownUsers()
    {
        // Busca em lote (Etapa 12) — enriquecer listagens administrativas
        // sem N+1; ids desconhecidos são omitidos, nunca lançam.
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var ana = await fixture.RegisterUserAsync(sut, email: "ana@example.com");
        var bia = await fixture.RegisterUserAsync(sut, email: "bia@example.com");

        var users = await sut.GetUsersByIdsAsync(new[] { ana.Id, bia.Id, Guid.NewGuid() });

        Assert.Equal(2, users.Count);
        Assert.Contains(users, u => u.Id == ana.Id);
        Assert.Contains(users, u => u.Id == bia.Id);
    }
}
