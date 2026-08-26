using Alilu.Modules.Recommendations.Domain;
using Xunit;

namespace Alilu.Modules.Recommendations.Application.Tests;

/// <summary>
/// Cobre <see cref="RecommendationAdministrationService"/> — "Administrador
/// pode moderar" (REGRA do PROMPT 10): aprovar/recusar/bloquear, e a
/// checagem de papel (segunda camada de defesa, depois de
/// <c>[Authorize(Roles = ...)]</c> no controller).
/// </summary>
public sealed class RecommendationAdministrationTests
{
    [Fact]
    public async Task ApproveAsync_PendingRecommendation_ApprovesAndRecordsApprover()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");
        var adminUserId = Guid.NewGuid();

        var approved = await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, adminUserId, recommendation.Id);

        Assert.Equal(RecommendationStatus.Approved, approved.Status);
        Assert.Equal(adminUserId, approved.ApprovedBy);
        Assert.NotNull(approved.ApprovedAt);
    }

    [Fact]
    public async Task ApproveAsync_NonAdminRole_ThrowsInsufficientPermissions()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");

        await Assert.ThrowsAsync<InsufficientPermissionsException>(
            () => adminSut.ApproveAsync(RecommendationRequesterRole.Resident, Guid.NewGuid(), recommendation.Id));
    }

    [Fact]
    public async Task ApproveAsync_AlreadyApproved_ThrowsRecommendationNotPending()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");
        await adminSut.ApproveAsync(RecommendationRequesterRole.SuperAdmin, Guid.NewGuid(), recommendation.Id);

        await Assert.ThrowsAsync<RecommendationNotPendingException>(
            () => adminSut.ApproveAsync(RecommendationRequesterRole.SuperAdmin, Guid.NewGuid(), recommendation.Id));
    }

    [Fact]
    public async Task RejectAsync_PendingRecommendation_Rejects()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");

        var rejected = await adminSut.RejectAsync(RecommendationRequesterRole.CondominiumAdmin, recommendation.Id);

        Assert.Equal(RecommendationStatus.Rejected, rejected.Status);
    }

    [Fact]
    public async Task BlockAsync_PendingRecommendation_ThrowsRecommendationNotApproved()
    {
        // Block só a partir de Approved — Reject já cobre o caminho
        // Pending→negativo (ver Recommendation.Block).
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");

        await Assert.ThrowsAsync<RecommendationNotApprovedException>(
            () => adminSut.BlockAsync(RecommendationRequesterRole.CondominiumAdmin, recommendation.Id));
    }

    [Fact]
    public async Task BlockAsync_ApprovedRecommendation_Blocks()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var recommendation = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");
        await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), recommendation.Id);

        var blocked = await adminSut.BlockAsync(RecommendationRequesterRole.CondominiumAdmin, recommendation.Id);

        Assert.Equal(RecommendationStatus.Blocked, blocked.Status);
    }

    [Fact]
    public async Task ListPendingAsync_ReturnsOnlyPending()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var pending = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Pendente");
        var approved = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Será aprovada");
        await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), approved.Id);

        var pendingList = await adminSut.ListPendingAsync(RecommendationRequesterRole.CondominiumAdmin);

        var onlyPending = Assert.Single(pendingList);
        Assert.Equal(pending.Id, onlyPending.Id);
    }
}
