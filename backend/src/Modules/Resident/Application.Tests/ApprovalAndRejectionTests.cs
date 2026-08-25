using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>Cobre <see cref="MembershipAdministrationService"/> — "aprovação", "rejeição" e "bloqueio" (PROMPT 05).</summary>
public sealed class ApprovalAndRejectionTests
{
    [Fact]
    public async Task ApproveAsync_WithPendingMembership_ActivatesIt()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var adminId = Guid.NewGuid();

        var approved = await adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, adminId, membership.Id);

        Assert.Equal(Domain.MembershipStatus.Active, approved.Status);
        Assert.Equal(adminId, approved.ValidatedBy);
        Assert.NotNull(approved.ValidatedAt);
    }

    [Fact]
    public async Task ApproveAsync_WithAlreadyActiveMembership_ThrowsMembershipNotPendingException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), membership.Id);

        await Assert.ThrowsAsync<MembershipNotPendingException>(() =>
            adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), membership.Id));
    }

    [Fact]
    public async Task RejectAsync_WithPendingMembership_RejectsIt()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var adminId = Guid.NewGuid();

        var rejected = await adminSut.RejectAsync(ResidentRequesterRole.CondominiumAdmin, adminId, membership.Id);

        Assert.Equal(Domain.MembershipStatus.Rejected, rejected.Status);
        Assert.Equal(adminId, rejected.ValidatedBy);
    }

    [Fact]
    public async Task RejectAsync_AfterRejection_UserCanRequestAgain()
    {
        // O índice único filtrado (ver MembershipConfiguration) e
        // ExistsActiveOrPendingAsync propositalmente NÃO contam Rejected —
        // uma solicitação rejeitada não deve travar uma nova tentativa.
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        var firstRequest = await sut.RequestResidentAccessAsync(userId, condominiumId, unitId);
        await adminSut.RejectAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), firstRequest.Id);

        var secondRequest = await sut.RequestResidentAccessAsync(userId, condominiumId, unitId);

        Assert.Equal(Domain.MembershipStatus.Pending, secondRequest.Status);
    }

    [Fact]
    public async Task BlockAsync_WithActiveMembership_BlocksIt()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var membership = await sut.CreateMembershipFromInvitationAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var adminId = Guid.NewGuid();

        var blocked = await adminSut.BlockAsync(ResidentRequesterRole.CondominiumAdmin, adminId, membership.Id);

        Assert.Equal(Domain.MembershipStatus.Blocked, blocked.Status);
        Assert.Equal(adminId, blocked.ValidatedBy);
    }

    [Fact]
    public async Task BlockAsync_WithPendingMembership_ThrowsMembershipNotActiveException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<MembershipNotActiveException>(() =>
            adminSut.BlockAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), membership.Id));
    }

    [Fact]
    public async Task ListPendingAsync_ReturnsOnlyPendingMemberships()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();

        await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var toApprove = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), toApprove.Id);

        var pending = await adminSut.ListPendingAsync(ResidentRequesterRole.CondominiumAdmin);

        Assert.Single(pending);
    }

    [Fact]
    public async Task ApproveAsync_WithUnknownMembershipId_ThrowsMembershipNotFoundException()
    {
        var fixture = new MembershipServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();

        await Assert.ThrowsAsync<MembershipNotFoundException>(() =>
            adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), Guid.NewGuid()));
    }
}
