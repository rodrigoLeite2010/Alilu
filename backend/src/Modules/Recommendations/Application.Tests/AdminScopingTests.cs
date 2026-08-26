using Xunit;

namespace Alilu.Modules.Recommendations.Application.Tests;

/// <summary>
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO): "CondominiumAdmin somente pode
/// administrar seu próprio condomínio" — mesmo espírito de
/// <c>AdminScopingTests</c> nos módulos Condominium/Resident/Professional.
/// <c>RecommendationAdministrationTests</c> continua cobrindo a moderação em
/// si e a autorização por papel.
/// </summary>
public sealed class AdminScopingTests
{
    [Fact]
    public async Task ListPendingAsync_ScopedToOwnCondominium_ReturnsOnlyThatCondominiumsPending()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();
        await residentSut.RecommendAsync(condominiumA, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário A");
        await residentSut.RecommendAsync(condominiumB, Guid.NewGuid(), null, "Beltrano", null, Guid.NewGuid(), "Comentário B");

        var scoped = await adminSut.ListPendingAsync(RecommendationRequesterRole.CondominiumAdmin, scopeCondominiumId: condominiumA);

        var only = Assert.Single(scoped);
        Assert.Equal(condominiumA, only.CondominiumId);
    }

    [Fact]
    public async Task ApproveAsync_ForRecommendationOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var otherCondominiumId = Guid.NewGuid();
        var recommendation = await residentSut.RecommendAsync(
            otherCondominiumId, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário");
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), recommendation.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task RejectAsync_ForRecommendationOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var otherCondominiumId = Guid.NewGuid();
        var recommendation = await residentSut.RecommendAsync(
            otherCondominiumId, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário");
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.RejectAsync(RecommendationRequesterRole.CondominiumAdmin, recommendation.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task BlockAsync_ForRecommendationOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var otherCondominiumId = Guid.NewGuid();
        var recommendation = await residentSut.RecommendAsync(
            otherCondominiumId, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário");
        await adminSut.ApproveAsync(RecommendationRequesterRole.SuperAdmin, Guid.NewGuid(), recommendation.Id);
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(RecommendationRequesterRole.CondominiumAdmin, recommendation.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ListByCondominiumAsync_ForOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new RecommendationServiceTestFixture();
        var adminSut = fixture.CreateAdminSut();
        var otherCondominiumId = Guid.NewGuid();
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ListByCondominiumAsync(RecommendationRequesterRole.CondominiumAdmin, otherCondominiumId, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ListByCondominiumAsync_ReturnsAllStatusesForThatCondominium()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var condominiumId = Guid.NewGuid();
        var approved = await residentSut.RecommendAsync(
            condominiumId, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário A");
        await adminSut.ApproveAsync(RecommendationRequesterRole.SuperAdmin, Guid.NewGuid(), approved.Id);
        await residentSut.RecommendAsync(
            condominiumId, Guid.NewGuid(), null, "Beltrano", null, Guid.NewGuid(), "Comentário B");
        await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), null, "Outro condomínio", null, Guid.NewGuid(), "Comentário C");

        var result = await adminSut.ListByCondominiumAsync(RecommendationRequesterRole.SuperAdmin, condominiumId);

        Assert.Equal(2, result.Count);
        Assert.All(result, r => Assert.Equal(condominiumId, r.CondominiumId));
    }

    [Fact]
    public async Task InScope_ApproveAsync_Succeeds()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var condominiumId = Guid.NewGuid();
        var recommendation = await residentSut.RecommendAsync(
            condominiumId, Guid.NewGuid(), null, "Fulano", null, Guid.NewGuid(), "Comentário");

        var approved = await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), recommendation.Id, scopeCondominiumId: condominiumId);

        Assert.Equal(Domain.RecommendationStatus.Approved, approved.Status);
    }
}
