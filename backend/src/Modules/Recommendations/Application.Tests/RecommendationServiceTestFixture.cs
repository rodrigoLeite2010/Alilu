using Alilu.Modules.Recommendations.Application.Tests.TestDoubles;

namespace Alilu.Modules.Recommendations.Application.Tests;

/// <summary>
/// Monta <see cref="RecommendationService"/>/<see cref="RecommendationDirectoryService"/>/
/// <see cref="RecommendationAdministrationService"/> reais com dependências
/// fake (em memória) — mesmo espírito de ReviewServiceTestFixture no módulo
/// Reviews.
/// </summary>
internal sealed class RecommendationServiceTestFixture
{
    public InMemoryRecommendationRepository RecommendationRepository { get; } = new();

    public RecommendationService CreateResidentSut() => new(RecommendationRepository, new FakeUnitOfWork());

    public RecommendationDirectoryService CreateDirectorySut() => new(RecommendationRepository);

    public RecommendationAdministrationService CreateAdminSut() => new(RecommendationRepository, new FakeUnitOfWork());
}
