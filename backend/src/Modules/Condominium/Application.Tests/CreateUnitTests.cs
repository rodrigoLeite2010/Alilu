using Alilu.Modules.Condominium.Domain;
using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class CreateUnitTests
{
    [Fact]
    public async Task CreateUnitAsync_WithValidData_CreatesUnit()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);

        var result = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101", type: UnitType.Apartment);

        Assert.Equal("101", result.Code);
        Assert.Equal(condominium.Id, result.CondominiumId);
        Assert.Equal(UnitStatus.Active, result.Status);
        Assert.Single(fixture.UnitRepository.Units);
    }

    [Fact]
    public async Task CreateUnitAsync_WithDuplicateCodeInSameCondominium_ThrowsDuplicateUnitCodeException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");

        await Assert.ThrowsAsync<DuplicateUnitCodeException>(() =>
            fixture.RegisterUnitAsync(sut, condominium.Id, code: "101"));
    }

    [Fact]
    public async Task CreateUnitAsync_WithSameCodeInDifferentCondominiums_Succeeds()
    {
        // A unicidade do código é POR condomínio, não global — dois
        // condomínios diferentes podem ter, cada um, uma unidade "101".
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var condominiumB = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        await fixture.RegisterUnitAsync(sut, condominiumA.Id, code: "101");
        var unitB = await fixture.RegisterUnitAsync(sut, condominiumB.Id, code: "101");

        Assert.Equal("101", unitB.Code);
        Assert.Equal(2, fixture.UnitRepository.Units.Count);
    }

    [Fact]
    public async Task CreateUnitAsync_WithUnknownCondominium_ThrowsCondominiumNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumNotFoundException>(() =>
            fixture.RegisterUnitAsync(sut, Guid.NewGuid()));
    }

    [Theory]
    [InlineData(CondominiumRequesterRole.Resident)]
    [InlineData(CondominiumRequesterRole.Professional)]
    public async Task CreateUnitAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        CondominiumRequesterRole nonAdminRole)
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            fixture.RegisterUnitAsync(sut, condominium.Id, requesterRole: nonAdminRole));
    }
}
