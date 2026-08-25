using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>Cobre <see cref="ICondominiumDirectoryService"/> (PROMPT 05, FLUXO 2).</summary>
public sealed class CondominiumDirectoryTests
{
    [Fact]
    public async Task ListActiveCondominiumsAsync_ReturnsOnlyActiveCondominiums()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var directorySut = fixture.CreateDirectorySut();

        await fixture.RegisterCondominiumAsync(sut);

        var condominiums = await directorySut.ListActiveCondominiumsAsync();

        Assert.Single(condominiums);
        Assert.Equal("Monte Carlo", condominiums[0].Name);
    }

    [Fact]
    public async Task ListActiveUnitsAsync_ReturnsOnlyUnitsOfTheGivenCondominium()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var directorySut = fixture.CreateDirectorySut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");
        await fixture.RegisterUnitAsync(sut, condominium.Id, code: "102");

        var units = await directorySut.ListActiveUnitsAsync(condominium.Id);

        Assert.Equal(2, units.Count);
    }

    [Fact]
    public async Task ListActiveUnitsAsync_WithUnknownCondominium_ThrowsCondominiumNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();

        await Assert.ThrowsAsync<CondominiumNotFoundException>(() =>
            directorySut.ListActiveUnitsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task ValidateUnitAsync_WithUnitBelongingToCondominium_Succeeds()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var directorySut = fixture.CreateDirectorySut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        await directorySut.ValidateUnitAsync(condominium.Id, unit.Id);
    }

    [Fact]
    public async Task ValidateUnitAsync_WithUnitFromAnotherCondominium_ThrowsUnitDoesNotBelongToCondominiumException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var directorySut = fixture.CreateDirectorySut();

        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var condominiumB = await fixture.RegisterCondominiumAsync(sut, name: "Outro", cnpj: "98765432000198");
        var unitOfB = await fixture.RegisterUnitAsync(sut, condominiumB.Id);

        await Assert.ThrowsAsync<UnitDoesNotBelongToCondominiumException>(() =>
            directorySut.ValidateUnitAsync(condominiumA.Id, unitOfB.Id));
    }
}
