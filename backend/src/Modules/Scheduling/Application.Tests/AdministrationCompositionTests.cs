using Xunit;

namespace Alilu.Modules.Scheduling.Application.Tests;

/// <summary>
/// Cobre <see cref="BookingService.ListBookingsByCondominiumIdAsync"/> —
/// ponto de extensão Etapa 12 (PROMPT 12) para o módulo Administration
/// (dashboard "agendamentos" + "Profissionais: visualizar histórico"). Sem
/// checagem de papel aqui de propósito — ver comentário de design na
/// interface; quem autoriza é a Api, antes de chamar isto.
/// </summary>
public sealed class AdministrationCompositionTests
{
    [Fact]
    public async Task ListBookingsByCondominiumIdAsync_ReturnsOnlyBookingsOfThatCondominium()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();

        await sut.CreateBookingAsync(
            residentId: Guid.NewGuid(),
            professionalId: Guid.NewGuid(),
            condominiumId: condominiumA,
            unitId: Guid.NewGuid(),
            scheduledDate,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0),
            notes: null,
            items: BookingServiceTestFixture.OneItem());
        await sut.CreateBookingAsync(
            residentId: Guid.NewGuid(),
            professionalId: Guid.NewGuid(),
            condominiumId: condominiumB,
            unitId: Guid.NewGuid(),
            scheduledDate,
            new TimeOnly(11, 0),
            new TimeOnly(12, 0),
            notes: null,
            items: BookingServiceTestFixture.OneItem());

        var result = await sut.ListBookingsByCondominiumIdAsync(condominiumA);

        var onlyBooking = Assert.Single(result);
        Assert.Equal(condominiumA, onlyBooking.CondominiumId);
    }

    [Fact]
    public async Task ListBookingsByCondominiumIdAsync_WithNoBookings_ReturnsEmpty()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        var result = await sut.ListBookingsByCondominiumIdAsync(Guid.NewGuid());

        Assert.Empty(result);
    }
}
