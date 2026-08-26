using Xunit;

namespace Alilu.Modules.Notifications.Application.Tests;

/// <summary>Cobre <see cref="DeviceTokenService"/> — "Configurar device token" (PROMPT 11): registro upsert (um token por usuário) e remoção (logout).</summary>
public sealed class DeviceTokenTests
{
    [Fact]
    public async Task RegisterMyTokenAsync_FirstTime_CreatesToken()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDeviceTokenSut();
        var userId = Guid.NewGuid();

        await sut.RegisterMyTokenAsync(userId, "ExponentPushToken[abc]");

        var token = Assert.Single(fixture.DeviceTokenRepository.Tokens);
        Assert.Equal(userId, token.UserId);
        Assert.Equal("ExponentPushToken[abc]", token.Token);
    }

    [Fact]
    public async Task RegisterMyTokenAsync_SecondTimeSameUser_OverwritesExistingToken()
    {
        // "Um usuário tem um único token guardado" (ver DeviceToken) — o app
        // reabriu e o Expo devolveu um token novo.
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDeviceTokenSut();
        var userId = Guid.NewGuid();
        await sut.RegisterMyTokenAsync(userId, "ExponentPushToken[old]");

        await sut.RegisterMyTokenAsync(userId, "ExponentPushToken[new]");

        var token = Assert.Single(fixture.DeviceTokenRepository.Tokens);
        Assert.Equal("ExponentPushToken[new]", token.Token);
    }

    [Fact]
    public async Task RemoveMyTokenAsync_ExistingToken_Removes()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDeviceTokenSut();
        var userId = Guid.NewGuid();
        await sut.RegisterMyTokenAsync(userId, "ExponentPushToken[abc]");

        await sut.RemoveMyTokenAsync(userId);

        Assert.Empty(fixture.DeviceTokenRepository.Tokens);
    }

    [Fact]
    public async Task RemoveMyTokenAsync_NoTokenRegistered_DoesNotThrow()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDeviceTokenSut();

        await sut.RemoveMyTokenAsync(Guid.NewGuid());

        Assert.Empty(fixture.DeviceTokenRepository.Tokens);
    }
}
