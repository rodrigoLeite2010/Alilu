using Xunit;

namespace Alilu.Modules.Scheduling.Application.Tests;

/// <summary>
/// Cobre <see cref="BookingService.ValidateCompletedBookingForReviewAsync"/> —
/// o método de extensão do PROMPT 09 que o módulo Reviews (via a Api) chama
/// antes de criar/editar uma avaliação: "somente Booking Completed pode ser
/// avaliado" e "somente o Resident daquele Booking pode avaliar".
/// </summary>
public sealed class BookingReviewValidationTests
{
    private static async Task<(BookingResponse Booking, Guid ResidentId, Guid ProfessionalId)> CreateCompletedBookingAsync(
        BookingServiceTestFixture fixture)
    {
        var residentSut = fixture.CreateResidentSut();
        var professionalSut = fixture.CreateProfessionalSut();
        var residentId = Guid.NewGuid();
        var professionalId = Guid.NewGuid();

        var booking = await residentSut.CreateBookingAsync(
            residentId, professionalId, Guid.NewGuid(), Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), new TimeOnly(9, 0), new TimeOnly(10, 0),
            null, BookingServiceTestFixture.OneItem());
        await professionalSut.AcceptAsync(professionalId, booking.Id);
        await professionalSut.CompleteAsync(professionalId, booking.Id);

        return (booking, residentId, professionalId);
    }

    [Fact]
    public async Task ValidateCompletedBookingForReviewAsync_CompletedBookingOfThisResident_ReturnsProfessionalId()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, residentId, professionalId) = await CreateCompletedBookingAsync(fixture);
        var sut = fixture.CreateResidentSut();

        var resolvedProfessionalId = await sut.ValidateCompletedBookingForReviewAsync(residentId, booking.Id);

        Assert.Equal(professionalId, resolvedProfessionalId);
    }

    [Fact]
    public async Task ValidateCompletedBookingForReviewAsync_StillRequestedBooking_ThrowsBookingNotCompleted()
    {
        var fixture = new BookingServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var residentId = Guid.NewGuid();
        var booking = await residentSut.CreateBookingAsync(
            residentId, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), new TimeOnly(9, 0), new TimeOnly(10, 0),
            null, BookingServiceTestFixture.OneItem());

        await Assert.ThrowsAsync<BookingNotCompletedException>(
            () => residentSut.ValidateCompletedBookingForReviewAsync(residentId, booking.Id));
    }

    [Fact]
    public async Task ValidateCompletedBookingForReviewAsync_CancelledBooking_ThrowsBookingNotCompleted()
    {
        var fixture = new BookingServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var residentId = Guid.NewGuid();
        var booking = await residentSut.CreateBookingAsync(
            residentId, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), new TimeOnly(9, 0), new TimeOnly(10, 0),
            null, BookingServiceTestFixture.OneItem());
        await residentSut.CancelMyBookingAsync(residentId, booking.Id);

        await Assert.ThrowsAsync<BookingNotCompletedException>(
            () => residentSut.ValidateCompletedBookingForReviewAsync(residentId, booking.Id));
    }

    [Fact]
    public async Task ValidateCompletedBookingForReviewAsync_CompletedBookingOfAnotherResident_ThrowsBookingNotFound()
    {
        // "Somente o Resident daquele Booking pode avaliar" — segunda
        // camada de defesa, mesmo padrão de GetOwnBookingOrThrowAsync.
        var fixture = new BookingServiceTestFixture();
        var (booking, _, _) = await CreateCompletedBookingAsync(fixture);
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<BookingNotFoundException>(
            () => sut.ValidateCompletedBookingForReviewAsync(Guid.NewGuid(), booking.Id));
    }
}
