using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>
/// Varredura dedicada ao cenário "autorização" do PROMPT 04: nenhuma das 6
/// operações administrativas deste módulo pode ser executada por um
/// usuário comum (Resident/Professional) — só CondominiumAdmin/SuperAdmin.
/// Os testes de cada operação (Create*/List*/Get*Tests.cs) já cobrem o
/// caso de recusa individualmente; esta classe garante que as duas
/// funções (recusar não-admin, aceitar admin) valem para as 6 ao mesmo
/// tempo, em um único lugar.
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
            sut.CreateInvitationAsync(nonAdminRole, new CreateInvitationRequest(condominium.Id, unit.Id, "outro@example.com", null)));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetInvitationAsync(nonAdminRole, invitation.Id));
    }

    [Theory]
    [InlineData(CondominiumRequesterRole.CondominiumAdmin)]
    [InlineData(CondominiumRequesterRole.SuperAdmin)]
    public async Task EveryAdministrativeOperation_WithAdminRole_Succeeds(CondominiumRequesterRole adminRole)
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut, requesterRole: adminRole);
        var list = await sut.ListCondominiumsAsync(adminRole);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id, requesterRole: adminRole);
        var units = await sut.ListUnitsAsync(adminRole, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            adminRole, new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));
        var fetchedInvitation = await sut.GetInvitationAsync(adminRole, invitation.Id);

        Assert.Single(list);
        Assert.Single(units);
        Assert.Equal(invitation.Id, fetchedInvitation.Id);
    }
}
