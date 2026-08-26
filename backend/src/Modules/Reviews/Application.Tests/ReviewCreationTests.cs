using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Reviews.Application.Tests;

/// <summary>
/// Cobre <see cref="ReviewService.CreateAsync"/> — REGRAS do PROMPT 09:
/// "somente uma Review por Booking", "Rating entre 1 e 5", "não permitir
/// avaliação anônima". As regras "somente Booking Completed pode ser
/// avaliado" e "somente o Resident daquele Booking pode avaliar" são
/// validadas pelo módulo Scheduling ANTES deste serviço ser chamado (ver
/// <c>Alilu.Modules.Scheduling.Application.Tests.BookingReviewValidationTests</c>)
/// — não são testadas aqui, pois este módulo recebe <c>bookingId</c>/
/// <c>professionalId</c> já validados pela Api (composição raiz).
/// </summary>
public sealed class ReviewCreationTests
{
    [Fact]
    public async Task CreateAsync_ValidRequest_CreatesReview()
    {
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        var review = await sut.CreateAsync(
            residentId: Guid.NewGuid(),
            bookingId: Guid.NewGuid(),
            professionalId: Guid.NewGuid(),
            rating: 5,
            comment: "Excelente atendimento");

        Assert.Equal(5, review.Rating);
        Assert.Equal("Excelente atendimento", review.Comment);
    }

    [Fact]
    public async Task CreateAsync_SecondReviewForTheSameBooking_ThrowsDuplicateReview()
    {
        // "Somente uma Review por Booking" (REGRA CRÍTICA).
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var bookingId = Guid.NewGuid();
        var professionalId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await sut.CreateAsync(residentId, bookingId, professionalId, 4, null);

        await Assert.ThrowsAsync<DuplicateReviewException>(
            () => sut.CreateAsync(residentId, bookingId, professionalId, 5, "Tentando de novo"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public async Task CreateAsync_RatingOutOfRange_ThrowsDomainException(int invalidRating)
    {
        // "Rating entre 1 e 5" (REGRA).
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(
            () => sut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), invalidRating, null));
    }

    [Fact]
    public async Task CreateAsync_WithoutResidentId_ThrowsDomainException()
    {
        // "Não permitir avaliação anônima" (REGRA).
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(
            () => sut.CreateAsync(Guid.Empty, Guid.NewGuid(), Guid.NewGuid(), 5, null));
    }

    [Fact]
    public async Task GetMyReviewForBookingAsync_NoReviewYet_ReturnsNull()
    {
        // Mesmo padrão "204 sem corpo" de outros módulos — usado pela rota
        // hospedeira (React Native) para decidir "avaliar" vs. "ver avaliação".
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        var review = await sut.GetMyReviewForBookingAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Null(review);
    }

    [Fact]
    public async Task GetMyReviewForBookingAsync_ReviewOfAnotherResident_ReturnsNull()
    {
        // Segunda camada de defesa: não vaza a avaliação de outro morador
        // mesmo pelo lookup "nullable" por BookingId.
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var bookingId = Guid.NewGuid();
        await sut.CreateAsync(Guid.NewGuid(), bookingId, Guid.NewGuid(), 5, null);

        var review = await sut.GetMyReviewForBookingAsync(Guid.NewGuid(), bookingId);

        Assert.Null(review);
    }
}
