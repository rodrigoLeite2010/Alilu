using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>
/// Varredura dedicada ao cenário "autorização": nenhuma das operações
/// administrativas deste módulo pode ser executada por um usuário comum
/// (Resident/Professional) — só CondominiumAdmin/SuperAdmin. Os testes de
/// cada operação (Create*/List*/Get*Tests.cs) já cobrem o caso de recusa
/// individualmente; esta classe garante que as duas funções (recusar
/// não-admin, aceitar admin) valem para todas ao mesmo tempo, em um único
/// lugar.
///
/// Etapa 12 (PROMPT 12): "criar condomínio" saiu desta varredura de
/// "qualquer papel admin" — agora é SOMENTE SuperAdmin (ver
/// <see cref="CreateCondominium_OnlyAllowedForSuperAdmin_NotCondominiumAdmin"/>
/// e <c>CreateCondominiumTests</c>). O escopo por condomínio
/// (CondominiumAdmin restrito ao próprio) tem sua própria varredura em
/// <c>AdminScopingTests</c>.
/// </summary>
public sealed class AuthorizationTests
{
    [Theory]
    [InlineData(CondominiumRequesterRole.Resident)]
    [InlineData(CondominiumRequesterRole.Professional)]
    public async Task EveryAdministrativeOperation_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        CondominiumRequesterRole nonAdminRole)
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            fixture.RegisterCondominiumAsync(sut, name: "Outro", cnpj: "98765432000198", requesterRole: nonAdminRole));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.ListCondominiumsAsync(nonAdminRole));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            fixture.RegisterUnitAsync(sut, condominium.Id, code: "202", requesterRole: nonAdminRole));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.ListUnitsAsync(nonAdminRole, condominium.Id));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetUnitAsync(nonAdminRole, unit.Id));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.EditUnitAsync(nonAdminRole, new EditUnitRequest(unit.Id, "999", Domain.UnitType.Apartment)));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.BlockUnitAsync(nonAdminRole, unit.Id));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.CreateInvitationAsync(nonAdminRole, new CreateInvitationRequest(condominium.Id, unit.Id, "outro@example.com", null)));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetInvitationAsync(nonAdminRole, invitation.Id));
    }

    [Theory]
    [InlineData(CondominiumRequesterRole.CondominiumAdmin)]
    [InlineData(CondominiumRequesterRole.SuperAdmin)]
    public async Task NonCreationAdministrativeOperations_WithAdminRole_Succeeds(CondominiumRequesterRole adminRole)
    {
        // "Criar condomínio" fica de fora aqui de propósito (Etapa 12: só
        // SuperAdmin) — o condomínio de setup é sempre criado como
        // SuperAdmin (default da fixture), e o que este teste varre é que
        // as DEMAIS operações aceitam tanto CondominiumAdmin quanto
        // SuperAdmin (sem restrição de escopo aqui — scopeCondominiumId
        // nulo em todas as chamadas).
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);

        var list = await sut.ListCondominiumsAsync(adminRole);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id, requesterRole: adminRole);
        var units = await sut.ListUnitsAsync(adminRole, condominium.Id);
        var fetchedUnit = await sut.GetUnitAsync(adminRole, unit.Id);
        var editedUnit = await sut.EditUnitAsync(adminRole, new EditUnitRequest(unit.Id, "999", Domain.UnitType.House));
        var invitation = await sut.CreateInvitationAsync(
            adminRole, new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));
        var fetchedInvitation = await sut.GetInvitationAsync(adminRole, invitation.Id);
        var blockedUnit = await sut.BlockUnitAsync(adminRole, unit.Id);

        Assert.Single(list);
        Assert.Single(units);
        Assert.Equal(unit.Id, fetchedUnit.Id);
        Assert.Equal("999", editedUnit.Code);
        Assert.Equal(invitation.Id, fetchedInvitation.Id);
        Assert.Equal(Domain.UnitStatus.Inactive, blockedUnit.Status);
    }

    [Fact]
    public async Task CreateCondominium_OnlyAllowedForSuperAdmin_NotCondominiumAdmin()
    {
        // Etapa 12 (PROMPT 12): "criar um NOVO condomínio" deixou de ser
        // CondominiumAdmin-ou-SuperAdmin (Etapa 04) e passou a ser SOMENTE
        // SuperAdmin — ver CondominiumService.EnsureIsSuperAdmin.
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            fixture.RegisterCondominiumAsync(sut, requesterRole: CondominiumRequesterRole.CondominiumAdmin));
    }
}
