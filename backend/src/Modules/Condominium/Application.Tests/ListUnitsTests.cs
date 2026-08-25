using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class ListUnitsTests
{
    [Fact]
    public async Task ListUnitsAsync_ReturnsOnlyUnitsOfTheGivenCondominium()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var condominiumB = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        await fixture.RegisterUnitAsync(sut, condominiumA.Id, code: "101");
        await fixture.RegisterUnitAsync(sut, condominiumA.Id, code: "102");
        await fixture.RegisterUnitAsync(sut, condominiumB.Id, code: "201");

        var result = await sut.ListUnitsAsync(CondominiumRequesterRole.CondominiumAdmin, condominiumA.Id);

        Assert.Equal(2, result.Count);
        Assert.All(result, u => Assert.Equal(condominiumA.Id, u.CondominiumId));
    }

    [Fact]
    public async Task ListUnitsAsync_WithUnknownCondominium_ThrowsCondominiumNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumNotFoundException>(() =>
            sut.ListUnitsAsync(CondominiumRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }

    [Fact]
    public async Task ListUnitsAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.ListUnitsAsync(CondominiumRequesterRole.Professional, condominium.Id));
    }
}
