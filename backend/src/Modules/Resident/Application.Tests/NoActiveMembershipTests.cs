using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// "Acesso sem vínculo" (PROMPT 05) — no backend, isso é
/// <see cref="MembershipService.GetMyActiveMembershipAsync"/> devolvendo
/// <c>null</c>; é esse <c>null</c> (204 no Api, ver
/// ResidentMembershipsController.GetActive) que o app usa para decidir
/// mostrar o fluxo de validação em vez da área do morador.
/// </summary>
public sealed class NoActiveMembershipTests
{
    [Fact]
    public async Task GetMyActiveMembershipAsync_WithNoMembershipAtAll_ReturnsNull()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var result = await sut.GetMyActiveMembershipAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetMyActiveMembershipAsync_WithOnlyAPendingMembership_ReturnsNull()
    {
        // Uma solicitação Pending ainda não dá acesso — só Active.
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        await sut.RequestResidentAccessAsync(userId, Guid.NewGuid(), Guid.NewGuid());

        var result = await sut.GetMyActiveMembershipAsync(userId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetMyActiveMembershipAsync_WithAnActiveMembership_ReturnsIt()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var created = await sut.CreateMembershipFromInvitationAsync(userId, Guid.NewGuid(), Guid.NewGuid());

        var result = await sut.GetMyActiveMembershipAsync(userId);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result!.Id);
    }
}
