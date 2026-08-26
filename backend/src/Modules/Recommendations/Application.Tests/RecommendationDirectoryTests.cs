using Xunit;

namespace Alilu.Modules.Recommendations.Application.Tests;

/// <summary>
/// Cobre <see cref="RecommendationDirectoryService"/> — React Native:
/// ProfessionalRecommendationsScreen ("Recomendado por N moradores"). Só
/// recomendações Approved e vinculadas a um profissional do ALILU entram
/// na contagem/listagem pública.
/// </summary>
public sealed class RecommendationDirectoryTests
{
    [Fact]
    public async Task GetSummaryByProfessionalIdAsync_NoApprovedRecommendations_ReturnsZero()
    {
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateDirectorySut();

        var summary = await sut.GetSummaryByProfessionalIdAsync(Guid.NewGuid());

        Assert.Equal(0, summary.TotalApproved);
    }

    [Fact]
    public async Task GetSummaryByProfessionalIdAsync_CountsOnlyApproved()
    {
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var directorySut = fixture.CreateDirectorySut();
        var professionalId = Guid.NewGuid();

        var approved1 = await residentSut.RecommendAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, null, null, Guid.NewGuid(), "1");
        var approved2 = await residentSut.RecommendAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, null, null, Guid.NewGuid(), "2");
        await residentSut.RecommendAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, null, null, Guid.NewGuid(), "3 — fica Pending");
        await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), approved1.Id);
        await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), approved2.Id);

        var summary = await directorySut.GetSummaryByProfessionalIdAsync(professionalId);
        var list = await directorySut.ListApprovedByProfessionalIdAsync(professionalId);

        Assert.Equal(2, summary.TotalApproved);
        Assert.Equal(2, list.Count);
    }

    [Fact]
    public async Task ListApprovedByProfessionalIdAsync_ExternalRecommendationsNeverAppear()
    {
        // Indicações externas (sem ProfessionalId) nunca entram no perfil
        // público de um profissional do ALILU — não há profissional para
        // vincular.
        var fixture = new RecommendationServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var directorySut = fixture.CreateDirectorySut();

        var external = await residentSut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), null, "Fulano Externo", null, Guid.NewGuid(), "Indicação externa");
        await adminSut.ApproveAsync(RecommendationRequesterRole.CondominiumAdmin, Guid.NewGuid(), external.Id);

        var list = await directorySut.ListApprovedByProfessionalIdAsync(Guid.NewGuid());

        Assert.Empty(list);
    }
}
