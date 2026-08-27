using Xunit;

namespace Alilu.Modules.Identity.Application.Tests;

/// <summary>
/// Etapa 21 (foto pessoal) — cobre só <see cref="AuthService.SetMyPhotoAsync"/>/
/// <see cref="AuthService.RemoveMyPhotoAsync"/> (persistir a URL no
/// usuário). A decodificação/validação do upload em si
/// (<c>Alilu.Api.Services.UserPhotoStorage</c>) não pode ser testada aqui —
/// vive em <c>Alilu.Api</c>, que não builda neste sandbox (sem acesso a
/// NuGet); revisada por leitura cuidadosa (ver ARCHITECTURE.md).
/// </summary>
public sealed class UserPhotoTests
{
    [Fact]
    public async Task SetMyPhotoAsync_WithValidUserId_UpdatesPhotoUrlAndReturnsIt()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var registered = await fixture.RegisterUserAsync(sut);

        var updated = await sut.SetMyPhotoAsync(registered.Id, "https://api.alilu.example/uploads/user-photos/x.jpg");

        Assert.Equal("https://api.alilu.example/uploads/user-photos/x.jpg", updated.PhotoUrl);

        var me = await sut.GetMeAsync(registered.Id);
        Assert.Equal("https://api.alilu.example/uploads/user-photos/x.jpg", me.PhotoUrl);
    }

    [Fact]
    public async Task SetMyPhotoAsync_CalledAgain_OverwritesThePreviousPhotoUrl()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var registered = await fixture.RegisterUserAsync(sut);

        await sut.SetMyPhotoAsync(registered.Id, "https://api.alilu.example/uploads/user-photos/old.jpg");
        var updated = await sut.SetMyPhotoAsync(registered.Id, "https://api.alilu.example/uploads/user-photos/new.jpg");

        Assert.Equal("https://api.alilu.example/uploads/user-photos/new.jpg", updated.PhotoUrl);
    }

    [Fact]
    public async Task SetMyPhotoAsync_WithUnknownUserId_ThrowsUserNotFoundException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<UserNotFoundException>(
            () => sut.SetMyPhotoAsync(Guid.NewGuid(), "https://api.alilu.example/uploads/user-photos/x.jpg"));
    }

    [Fact]
    public async Task RemoveMyPhotoAsync_AfterSettingAPhoto_ClearsPhotoUrlBackToNull()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();
        var registered = await fixture.RegisterUserAsync(sut);
        await sut.SetMyPhotoAsync(registered.Id, "https://api.alilu.example/uploads/user-photos/x.jpg");

        var updated = await sut.RemoveMyPhotoAsync(registered.Id);

        Assert.Null(updated.PhotoUrl);
    }

    [Fact]
    public async Task RemoveMyPhotoAsync_WithUnknownUserId_ThrowsUserNotFoundException()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<UserNotFoundException>(() => sut.RemoveMyPhotoAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task RegisterAsync_NewUser_HasNullPhotoUrlByDefault()
    {
        var fixture = new AuthServiceTestFixture();
        var sut = fixture.CreateSut();

        var registered = await fixture.RegisterUserAsync(sut);

        Assert.Null(registered.PhotoUrl);
    }
}
