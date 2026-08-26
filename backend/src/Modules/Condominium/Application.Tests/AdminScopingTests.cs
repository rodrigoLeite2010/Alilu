using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO): "CondominiumAdmin somente pode
/// administrar seu próprio condomínio". Estes testes simulam o que a Api
/// faz de verdade — resolve o escopo (aqui, só um <c>Guid?</c> literal,
/// já que este módulo nunca referencia <c>Administration</c>) e passa em
/// <c>scopeCondominiumId</c>. <c>AuthorizationTests</c> cobre o eixo
/// "papel" (Resident/Professional sempre recusados); esta classe cobre o
/// eixo ortogonal "escopo" (CondominiumAdmin de A não pode mexer em B).
/// </summary>
public sealed class AdminScopingTests
{
    [Fact]
    public async Task ListCondominiumsAsync_ScopedToOwnCondominium_ReturnsOnlyThatCondominium()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        var result = await sut.ListCondominiumsAsync(CondominiumRequesterRole.CondominiumAdmin, scopeCondominiumId: condominiumA.Id);

        var onlyCondominium = Assert.Single(result);
        Assert.Equal(condominiumA.Id, onlyCondominium.Id);
    }

    [Fact]
    public async Task CreateUnitAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.CreateUnitAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new CreateUnitRequest(otherCondominium.Id, "101", Domain.UnitType.Apartment),
                scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task ListUnitsAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.ListUnitsAsync(CondominiumRequesterRole.CondominiumAdmin, otherCondominium.Id, scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task GetUnitAsync_ForUnitOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var otherUnit = await fixture.RegisterUnitAsync(sut, otherCondominium.Id);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetUnitAsync(CondominiumRequesterRole.CondominiumAdmin, otherUnit.Id, scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task EditUnitAsync_ForUnitOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var otherUnit = await fixture.RegisterUnitAsync(sut, otherCondominium.Id);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.EditUnitAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new EditUnitRequest(otherUnit.Id, "999", Domain.UnitType.House),
                scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task BlockUnitAsync_ForUnitOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var otherUnit = await fixture.RegisterUnitAsync(sut, otherCondominium.Id);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.BlockUnitAsync(CondominiumRequesterRole.CondominiumAdmin, otherUnit.Id, scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task CreateInvitationAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var otherUnit = await fixture.RegisterUnitAsync(sut, otherCondominium.Id);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.CreateInvitationAsync(
                CondominiumRequesterRole.CondominiumAdmin,
                new CreateInvitationRequest(otherCondominium.Id, otherUnit.Id, "convidado@example.com", null),
                scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task GetInvitationAsync_ForInvitationOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var ownCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var otherCondominium = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");
        var otherUnit = await fixture.RegisterUnitAsync(sut, otherCondominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(otherCondominium.Id, otherUnit.Id, "convidado@example.com", null));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, invitation.Id, scopeCondominiumId: ownCondominium.Id));
    }

    [Fact]
    public async Task SuperAdmin_WithNullScope_CanAccessAnyCondominium()
    {
        // SuperAdmin sempre passa scopeCondominiumId nulo (resolvido assim
        // pela Api) — confirma que nenhuma das checagens de escopo
        // restringe esse caso.
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominiumA = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        var condominiumB = await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        var unitA = await sut.CreateUnitAsync(
            CondominiumRequesterRole.SuperAdmin,
            new CreateUnitRequest(condominiumA.Id, "101", Domain.UnitType.Apartment),
            scopeCondominiumId: null);
        var unitB = await sut.CreateUnitAsync(
            CondominiumRequesterRole.SuperAdmin,
            new CreateUnitRequest(condominiumB.Id, "201", Domain.UnitType.Apartment),
            scopeCondominiumId: null);

        Assert.Equal(condominiumA.Id, unitA.CondominiumId);
        Assert.Equal(condominiumB.Id, unitB.CondominiumId);
    }
}
