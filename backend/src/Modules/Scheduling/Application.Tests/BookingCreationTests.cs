using Xunit;

namespace Alilu.Modules.Scheduling.Application.Tests;

/// <summary>
/// Cobre <see cref="BookingService.CreateBookingAsync"/> — em particular a
/// REGRA CRÍTICA "não permitir conflitos de agendamento" (checagem em
/// memória, dentro da transação — ver comentário de <see cref="TestDoubles.FakeUnitOfWork"/>
/// para o que este sandbox consegue e não consegue provar sobre a
/// concorrência real).
/// </summary>
public sealed class BookingCreationTests
{
    [Fact]
    public async Task CreateBookingAsync_ValidRequest_CreatesWithRequestedStatusAndItems()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        var booking = await sut.CreateBookingAsync(
            residentId: Guid.NewGuid(),
            professionalId: Guid.NewGuid(),
            condominiumId: Guid.NewGuid(),
            unitId: Guid.NewGuid(),
            scheduledDate,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0),
            notes: "Levar produtos de limpeza",
            items: BookingServiceTestFixture.OneItem());

        Assert.Equal(Domain.BookingStatus.Requested, booking.Status);
        Assert.Single(booking.Items);
    }

    [Fact]
    public async Task CreateBookingAsync_WithoutAnyItem_ThrowsInvalidBookingItems()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<InvalidBookingItemsException>(() => sut.CreateBookingAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow), new TimeOnly(9, 0), new TimeOnly(10, 0), null,
            items: Array.Empty<BookingItemInput>()));
    }

    [Fact]
    public async Task CreateBookingAsync_SecondResidentForTheExactSameSlot_ThrowsBookingConflict()
    {
        // "Dois moradores tentam agendar o mesmo horário" (teste explícito do PROMPT 08).
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        await sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());

        await Assert.ThrowsAsync<BookingConflictException>(() => sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem()));
    }

    [Fact]
    public async Task CreateBookingAsync_OverlappingButNotIdenticalWindow_ThrowsBookingConflict()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        await sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(11, 0), null, BookingServiceTestFixture.OneItem());

        // 10:00-12:00 sobrepõe parcialmente 09:00-11:00.
        await Assert.ThrowsAsync<BookingConflictException>(() => sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(10, 0), new TimeOnly(12, 0), null, BookingServiceTestFixture.OneItem()));
    }

    [Fact]
    public async Task CreateBookingAsync_SameSlotButDifferentProfessional_DoesNotConflict()
    {
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        await sut.CreateBookingAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());

        // Outro profissional, mesmo horário — sem conflito.
        var secondBooking = await sut.CreateBookingAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());

        Assert.Equal(Domain.BookingStatus.Requested, secondBooking.Status);
    }

    [Fact]
    public async Task CreateBookingAsync_AdjacentSlotsBackToBack_DoesNotConflict()
    {
        // [9,10) e [10,11) não se sobrepõem — intervalo semiaberto, mesma
        // regra de ProfessionalAvailability.OverlapsWith na Etapa 07.
        var fixture = new BookingServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        await sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());

        var secondBooking = await sut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(10, 0), new TimeOnly(11, 0), null, BookingServiceTestFixture.OneItem());

        Assert.Equal(Domain.BookingStatus.Requested, secondBooking.Status);
    }

    [Fact]
    public async Task CreateBookingAsync_SameSlotAfterFirstBookingWasRejected_DoesNotConflict()
    {
        // Rejeitado/cancelado/no-show liberam o horário (Booking.OccupiesSlot).
        var fixture = new BookingServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var professionalSut = fixture.CreateProfessionalSut();
        var professionalId = Guid.NewGuid();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        var firstBooking = await residentSut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());
        await professionalSut.RejectAsync(professionalId, firstBooking.Id);

        var secondBooking = await residentSut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());

        Assert.Equal(Domain.BookingStatus.Requested, secondBooking.Status);
    }
}
