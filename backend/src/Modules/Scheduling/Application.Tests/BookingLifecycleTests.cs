using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Scheduling.Application.Tests;

/// <summary>
/// Cobre o restante do ciclo de vida de <see cref="Domain.Booking"/>: fluxo
/// do profissional ("receber solicitação → aceitar ou recusar",
/// conclusão) e cancelamentos — os testes explícitos do PROMPT 08
/// ("cancelamento, aceite, rejeição, conclusão") — além do isolamento
/// entre usuários (segunda camada de defesa, mesmo padrão dos demais
/// módulos).
/// </summary>
public sealed class BookingLifecycleTests
{
    private static async Task<(BookingResponse Booking, Guid ResidentId, Guid ProfessionalId)> CreateRequestedBookingAsync(
        BookingServiceTestFixture fixture)
    {
        var residentSut = fixture.CreateResidentSut();
        var residentId = Guid.NewGuid();
        var professionalId = Guid.NewGuid();

        var booking = await residentSut.CreateBookingAsync(
            residentId, professionalId, Guid.NewGuid(), Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), new TimeOnly(9, 0), new TimeOnly(10, 0),
            null, BookingServiceTestFixture.OneItem());

        return (booking, residentId, professionalId);
    }

    // ---- Aceite / recusa (profissional) ----

    [Fact]
    public async Task AcceptAsync_RequestedBooking_TransitionsToConfirmed()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();

        var confirmed = await professionalSut.AcceptAsync(professionalId, booking.Id);

        Assert.Equal(Domain.BookingStatus.Confirmed, confirmed.Status);
    }

    [Fact]
    public async Task RejectAsync_RequestedBooking_TransitionsToRejected()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();

        var rejected = await professionalSut.RejectAsync(professionalId, booking.Id);

        Assert.Equal(Domain.BookingStatus.Rejected, rejected.Status);
    }

    [Fact]
    public async Task AcceptAsync_AlreadyConfirmedBooking_ThrowsDomainException()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);

        await Assert.ThrowsAsync<DomainException>(() => professionalSut.AcceptAsync(professionalId, booking.Id));
    }

    // ---- Conclusão ----

    [Fact]
    public async Task CompleteAsync_ConfirmedBooking_TransitionsToCompleted()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);

        var completed = await professionalSut.CompleteAsync(professionalId, booking.Id);

        Assert.Equal(Domain.BookingStatus.Completed, completed.Status);
    }

    [Fact]
    public async Task CompleteAsync_StillRequestedBooking_ThrowsDomainException()
    {
        // Não dá para concluir sem antes aceitar.
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();

        await Assert.ThrowsAsync<DomainException>(() => professionalSut.CompleteAsync(professionalId, booking.Id));
    }

    [Fact]
    public async Task MarkNoShowAsync_ConfirmedBooking_TransitionsToNoShow()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);

        var noShow = await professionalSut.MarkNoShowAsync(professionalId, booking.Id);

        Assert.Equal(Domain.BookingStatus.NoShow, noShow.Status);
    }

    // ---- Cancelamento ----

    [Fact]
    public async Task CancelMyBookingAsync_RequestedBooking_TransitionsToCancelledByResident()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, residentId, _) = await CreateRequestedBookingAsync(fixture);
        var residentSut = fixture.CreateResidentSut();

        var cancelled = await residentSut.CancelMyBookingAsync(residentId, booking.Id);

        Assert.Equal(Domain.BookingStatus.CancelledByResident, cancelled.Status);
    }

    [Fact]
    public async Task CancelMyBookingAsync_ConfirmedBooking_TransitionsToCancelledByResident()
    {
        // "Cancelamentos devem respeitar regras de negócio": ainda é
        // permitido cancelar depois de Confirmed, só não depois de começar.
        var fixture = new BookingServiceTestFixture();
        var (booking, residentId, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);
        var residentSut = fixture.CreateResidentSut();

        var cancelled = await residentSut.CancelMyBookingAsync(residentId, booking.Id);

        Assert.Equal(Domain.BookingStatus.CancelledByResident, cancelled.Status);
    }

    [Fact]
    public async Task CancelMyBookingAsync_AlreadyInProgressBooking_ThrowsDomainException()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, residentId, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);
        await professionalSut.MarkInProgressAsync(professionalId, booking.Id);
        var residentSut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() => residentSut.CancelMyBookingAsync(residentId, booking.Id));
    }

    [Fact]
    public async Task CancelMyBookingAsync_AlreadyCompletedBooking_ThrowsDomainException()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, residentId, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();
        await professionalSut.AcceptAsync(professionalId, booking.Id);
        await professionalSut.CompleteAsync(professionalId, booking.Id);
        var residentSut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() => residentSut.CancelMyBookingAsync(residentId, booking.Id));
    }

    [Fact]
    public async Task CancelAsync_ByProfessional_RequestedBooking_TransitionsToCancelledByProfessional()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, professionalId) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();

        var cancelled = await professionalSut.CancelAsync(professionalId, booking.Id);

        Assert.Equal(Domain.BookingStatus.CancelledByProfessional, cancelled.Status);
    }

    // ---- Isolamento entre usuários (segunda camada de defesa) ----

    [Fact]
    public async Task GetMyBookingAsync_BookingOfAnotherResident_ThrowsBookingNotFound()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, _) = await CreateRequestedBookingAsync(fixture);
        var residentSut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<BookingNotFoundException>(
            () => residentSut.GetMyBookingAsync(Guid.NewGuid(), booking.Id));
    }

    [Fact]
    public async Task CancelMyBookingAsync_BookingOfAnotherResident_ThrowsBookingNotFound()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, _) = await CreateRequestedBookingAsync(fixture);
        var residentSut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<BookingNotFoundException>(
            () => residentSut.CancelMyBookingAsync(Guid.NewGuid(), booking.Id));
    }

    [Fact]
    public async Task AcceptAsync_BookingOfAnotherProfessional_ThrowsBookingNotFound()
    {
        var fixture = new BookingServiceTestFixture();
        var (booking, _, _) = await CreateRequestedBookingAsync(fixture);
        var professionalSut = fixture.CreateProfessionalSut();

        await Assert.ThrowsAsync<BookingNotFoundException>(
            () => professionalSut.AcceptAsync(Guid.NewGuid(), booking.Id));
    }

    [Fact]
    public async Task ListMyRequestsAsync_FilteredByStatus_ReturnsOnlyMatching()
    {
        var fixture = new BookingServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var professionalSut = fixture.CreateProfessionalSut();
        var professionalId = Guid.NewGuid();
        var scheduledDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        var firstBooking = await residentSut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(9, 0), new TimeOnly(10, 0), null, BookingServiceTestFixture.OneItem());
        await residentSut.CreateBookingAsync(
            Guid.NewGuid(), professionalId, Guid.NewGuid(), Guid.NewGuid(), scheduledDate,
            new TimeOnly(11, 0), new TimeOnly(12, 0), null, BookingServiceTestFixture.OneItem());
        await professionalSut.AcceptAsync(professionalId, firstBooking.Id);

        var requested = await professionalSut.ListMyRequestsAsync(professionalId, Domain.BookingStatus.Requested);

        Assert.Single(requested);
    }
}
