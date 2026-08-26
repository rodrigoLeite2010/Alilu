using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>Cobre <c>CondominiumService.EditUnitAsync</c>/<c>BlockUnitAsync</c>/<c>GetUnitAsync</c> — "Unidades: editar"/"bloquear"/"visualizar" (PROMPT 12). Autorização por papel e por escopo já cobertas em <c>AuthorizationTests</c>/<c>AdminScopingTests</c>; esta classe cobre as regras específicas destas operações.</summary>
public sealed class EditAndBlockUnitTests
{
    [Fact]
    public async Task EditUnitAsync_WithValidData_UpdatesCodeAndType()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101", type: Domain.UnitType.Apartment);

        var edited = await sut.EditUnitAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new EditUnitRequest(unit.Id, "101-A", Domain.UnitType.Commercial));

        Assert.Equal("101-A", edited.Code);
        Assert.Equal(Domain.UnitType.Commercial, edited.Type);
    }

    [Fact]
    public async Task EditUnitAsync_KeepingTheSameCode_Succeeds()
    {
        // O código pode continuar igual ao da própria unidade sendo
        // editada — só é duplicidade se pertencer a OUTRA unidade (ver
        // ICondominiumUnitRepository.ExistsByCondominiumIdAndCodeAsync,
        // parâmetro excludingUnitId).
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");

        var edited = await sut.EditUnitAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new EditUnitRequest(unit.Id, "101", Domain.UnitType.House));

        Assert.Equal("101", edited.Code);
        Assert.Equal(Domain.UnitType.House, edited.Type);
    }

    [Fact]
    public async Task EditUnitAsync_WithCodeAlreadyUsedByAnotherUnit_ThrowsDuplicateUnitCodeException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");
        var unitToEdit = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "102");

        await Assert.ThrowsAsync<DuplicateUnitCodeException>(() =>
            sut.EditUnitAsync(CondominiumRequesterRole.CondominiumAdmin, new EditUnitRequest(unitToEdit.Id, "101", Domain.UnitType.Apartment)));
    }

    [Fact]
    public async Task EditUnitAsync_WithUnknownUnit_ThrowsCondominiumUnitNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumUnitNotFoundException>(() =>
            sut.EditUnitAsync(CondominiumRequesterRole.CondominiumAdmin, new EditUnitRequest(Guid.NewGuid(), "101", Domain.UnitType.Apartment)));
    }

    [Fact]
    public async Task BlockUnitAsync_ActiveUnit_DeactivatesIt()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        var blocked = await sut.BlockUnitAsync(CondominiumRequesterRole.CondominiumAdmin, unit.Id);

        Assert.Equal(Domain.UnitStatus.Inactive, blocked.Status);
    }

    [Fact]
    public async Task BlockUnitAsync_WithUnknownUnit_ThrowsCondominiumUnitNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumUnitNotFoundException>(() =>
            sut.BlockUnitAsync(CondominiumRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }

    [Fact]
    public async Task GetUnitAsync_WithKnownUnit_ReturnsIt()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");

        var result = await sut.GetUnitAsync(CondominiumRequesterRole.CondominiumAdmin, unit.Id);

        Assert.Equal(unit.Id, result.Id);
        Assert.Equal("101", result.Code);
    }

    [Fact]
    public async Task GetUnitAsync_WithUnknownUnit_ThrowsCondominiumUnitNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumUnitNotFoundException>(() =>
            sut.GetUnitAsync(CondominiumRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }
}
