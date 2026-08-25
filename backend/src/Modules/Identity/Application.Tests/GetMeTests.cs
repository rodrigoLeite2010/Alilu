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
}
