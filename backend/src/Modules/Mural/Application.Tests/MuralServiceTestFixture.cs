using Alilu.Modules.Mural.Application.Tests.TestDoubles;

namespace Alilu.Modules.Mural.Application.Tests;

/// <summary>
/// Monta <see cref="MuralService"/>/<see cref="MuralAdministrationService"/>
/// reais com dependências fake (em memória) — mesmo espírito de
/// RecommendationServiceTestFixture no módulo Recommendations.
/// </summary>
internal sealed class MuralServiceTestFixture
{
    public InMemoryMuralPostRepository MuralPostRepository { get; } = new();

    public MuralService CreateResidentSut() => new(MuralPostRepository, new FakeUnitOfWork());

    public MuralAdministrationService CreateAdminSut() => new(MuralPostRepository, new FakeUnitOfWork());
}
