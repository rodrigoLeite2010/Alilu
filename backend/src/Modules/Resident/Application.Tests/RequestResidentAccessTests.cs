using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>Cobre <see cref="MembershipService.RequestResidentAccessAsync"/> — FLUXO 2 ("solicitação", PROMPT 05).</summary>
public sealed class RequestResidentAccessTests
{
    [Fact]
    public async Task RequestResidentAccessAsync_CreatesAPendingMembership()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        var membership = await sut.RequestResidentAccessAsync(userId, condominiumId, unitId);

        Assert.Equal(Domain.MembershipStatus.Pending, membership.Status);
        Assert.Null(membership.ValidatedAt);
        Assert.Null(membership.ValidatedBy);
    }

    [Fact]
    public async Task RequestResidentAccessAsync_WhenAlreadyPendingForTheSameUnit_ThrowsDuplicateMembershipException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        await sut.RequestResidentAccessAsync(userId, condominiumId, unitId);

        await Assert.ThrowsAsync<DuplicateMembershipException>(() =>
            sut.RequestResidentAccessAsync(userId, condominiumId, unitId));
    }
}
