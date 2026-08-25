using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class CreateInvitationTests
{
    [Fact]
    public async Task CreateInvitationAsync_WithValidData_CreatesInvitationAndReturnsRawCodeOnce()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        var result = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", ExpirationDays: null));

        Assert.Equal(condominium.Id, result.CondominiumId);
        Assert.Equal(unit.Id, result.UnitId);
        Assert.Equal("convidado@example.com", result.Email);
        Assert.NotEmpty(result.Code);

        // O que fica salvo é só o hash — nunca o código bruto.
        var stored = Assert.Single(fixture.InvitationRepository.Invitations);
        Assert.NotEqual(result.Code, stored.CodeHash);
        Assert.Equal(fixture.InvitationCodeGenerator.Hash(result.Code), stored.CodeHash);
    }

    [Fact]
    public async Task CreateInvitationAsync_WithoutExplicitExpiration_UsesDefaultExpirationDays()
    {
        var fixture = new CondominiumServiceTestFixture { Options = new CondominiumOptions { DefaultInvitationExpirationDays = 7 } };
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var before = DateTime.UtcNow;

        var result = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", ExpirationDays: null));

        var expectedMinimum = before.AddDays(7).AddSeconds(-5);
        var expectedMaximum = before.AddDays(7).AddSeconds(5);
        Assert.InRange(result.ExpiresAt, expectedMinimum, expectedMaximum);
    }

    [Fact]
    public async Task CreateInvitationAsync_WithUnknownCondominium_ThrowsCondominiumNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumNotFoundException>(() =>
            sut.CreateInvitationAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new CreateInvitationRequest(Guid.NewGuid(), Guid.NewGuid(), "convidado@example.com", null)));
    }

    [Fact]
    public async Task CreateInvitationAsync_WithUnknownUnit_ThrowsCondominiumUnitNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);

        await Assert.ThrowsAsync<CondominiumUnitNotFoundException>(() =>
            sut.CreateInvitationAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new CreateInvitationRequest(condominium.Id, Guid.NewGuid(), "convidado@example.com", null)));
    }

    [Fact]
    public async Task CreateInvitationAsync_WithUnitFromAnotherCondominium_ThrowsUnitDoesNotBelongToCondominiumException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var condominiumB = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var unitOfB = await fixture.RegisterUnitAsync(sut, condominiumB.Id, code: "101");

        await Assert.ThrowsAsync<UnitDoesNotBelongToCondominiumException>(() =>
            sut.CreateInvitationAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new CreateInvitationRequest(condominiumA.Id, unitOfB.Id, "convidado@example.com", null)));
    }

    [Theory]
    [InlineData(CondominiumRequesterRole.Resident)]
    [InlineData(CondominiumRequesterRole.Professional)]
    public async Task CreateInvitationAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        CondominiumRequesterRole nonAdminRole)
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.CreateInvitationAsync(
                nonAdminRole,
                new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null)));
    }
}
