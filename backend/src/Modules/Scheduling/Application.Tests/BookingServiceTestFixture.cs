using Alilu.Modules.Scheduling.Application.Tests.TestDoubles;

namespace Alilu.Modules.Scheduling.Application.Tests;

/// <summary>
/// Monta <see cref="BookingService"/>/<see cref="ProfessionalBookingService"/>
/// reais com dependências fake (em memória) — mesmo espírito de
/// ProfessionalServiceTestFixture no módulo Professional.
/// </summary>
internal sealed class BookingServiceTestFixture
{
    public InMemoryBookingRepository BookingRepository { get; } = new();

    public InMemoryBookingItemRepository BookingItemRepository { get; } = new();

    public BookingService CreateResidentSut() => new(BookingRepository, BookingItemRepository, new FakeUnitOfWork());

    public ProfessionalBookingService CreateProfessionalSut() => new(BookingRepository, BookingItemRepository, new FakeUnitOfWork());

    /// <summary>Item padrão para os testes que não estão testando "selecionar serviços" em si — só precisam de uma lista não vazia.</summary>
    public static IReadOnlyList<BookingItemInput> OneItem() => new[] { new BookingItemInput(Guid.NewGuid(), null, 1) };
}
