using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// Cobre <see cref="MembershipService.CreateMembershipFromInvitationAsync"/>
/// — a metade "módulo Resident" do FLUXO 1 (a validação do convite em si,
/// que é do módulo Condominium, é coberta em
/// Condominium.Application.Tests/InvitationRedemptionTests.cs; aqui o
/// convite já está validado, como a Api de fato entrega — ver
/// ResidentMembershipsController.RedeemInvitation).
/// </summary>
public sealed class RedeemInvitationTests
{
    [Fact]
    public async Task CreateMembershipFromInvitationAsync_CreatesAnActiveMembership()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        var membership = await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, unitId);

        Assert.Equal(Domain.MembershipStatus.Active, membership.Status);
        Assert.Equal(userId, membership.UserId);
        Assert.Equal(condominiumId, membership.CondominiumId);
        Assert.Equal(unitId, membership.UnitId);
        Assert.NotNull(membership.ValidatedAt);
        Assert.Null(membership.ValidatedBy); // ver comentário em CondominiumMembership.CreateActiveFromInvitation
    }

    [Fact]
    public async Task CreateMembershipFromInvitationAsync_WhenUserAlreadyHasAMembershipForTheSameUnit_ThrowsDuplicateMembershipException()
    {
        // "Usuário já vinculado" (PROMPT 05).
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, unitId);

        await Assert.ThrowsAsync<DuplicateMembershipException>(() =>
            sut.CreateMembershipFromInvitationAsync(userId, condominiumId, unitId));
    }

    [Fact]
    public async Task CreateMembershipFromInvitationAsync_SameUserDifferentUnit_DoesNotConflict()
    {
        // A duplicidade é por (usuário, condomínio, unidade) — o mesmo
        // usuário pode ter vínculos com unidades diferentes.
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();

        await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, Guid.NewGuid());
        var second = await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, Guid.NewGuid());

        Assert.Equal(Domain.MembershipStatus.Active, second.Status);
    }
}
