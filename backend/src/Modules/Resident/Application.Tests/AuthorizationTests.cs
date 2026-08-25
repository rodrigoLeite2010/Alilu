using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// Varredura dedicada ao cenário "autorização" das 4 operações
/// administrativas deste módulo (ListPending/Approve/Reject/Block) —
/// mesmo espírito de AuthorizationTests no módulo Condominium. As
/// operações self-service (<see cref="MembershipService"/>) não entram
/// aqui de propósito: elas não recebem papel nenhum, são sempre
/// restritas ao próprio usuário (ver comentário em IMembershipService).
/// </summary>
public sealed class AuthorizationTests
{
    [Theory]
    [InlineData(ResidentRequesterRole.Resident)]
    [InlineData(ResidentRequesterRole.Professional)]
    public async Task EveryAdministrativeOperation_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        ResidentRequesterRole nonAdminRole)
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ListPendingAsync(nonAdminRole));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ApproveAsync(nonAdminRole, Guid.NewGuid(), membership.Id));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.RejectAsync(nonAdminRole, Guid.NewGuid(), membership.Id));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(nonAdminRole, Guid.NewGuid(), membership.Id));
    }

    [Theory]
    [InlineData(ResidentRequesterRole.CondominiumAdmin)]
    [InlineData(ResidentRequesterRole.SuperAdmin)]
    public async Task ListPendingAsync_WithAdminRole_Succeeds(ResidentRequesterRole adminRole)
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var pending = await adminSut.ListPendingAsync(adminRole);

        Assert.Single(pending);
    }
}
