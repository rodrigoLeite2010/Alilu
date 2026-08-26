using Alilu.Modules.Reviews.Application.Tests.TestDoubles;

namespace Alilu.Modules.Reviews.Application.Tests;

/// <summary>
/// Monta <see cref="ReviewService"/>/<see cref="ProfessionalReviewService"/>
/// reais com dependências fake (em memória) — mesmo espírito de
/// BookingServiceTestFixture no módulo Scheduling.
/// </summary>
internal sealed class ReviewServiceTestFixture
{
    public InMemoryReviewRepository ReviewRepository { get; } = new();

    public ReviewService CreateResidentSut() => new(ReviewRepository, new FakeUnitOfWork());

    public ProfessionalReviewService CreateProfessionalSut() => new(ReviewRepository);
}
