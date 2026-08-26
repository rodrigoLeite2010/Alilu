using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Reviews.Application.Tests;

/// <summary>
/// Cobre <see cref="ReviewService.EditAsync"/> ("editar avaliação dentro da
/// regra definida" — mesma regra de autoria da criação, nenhuma janela de
/// tempo nova inventada, ver ARCHITECTURE.md "Etapa 09") e o lado do
/// profissional (<see cref="ProfessionalReviewService"/> — "visualizar
/// avaliações recebidas; visualizar média").
/// </summary>
public sealed class ReviewEditAndProfessionalViewTests
{
    [Fact]
    public async Task EditAsync_OwnReview_UpdatesRatingAndComment()
    {
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var residentId = Guid.NewGuid();
        var created = await sut.CreateAsync(residentId, Guid.NewGuid(), Guid.NewGuid(), 3, "Ok");

        var edited = await sut.EditAsync(residentId, created.Id, 5, "Na verdade, ótimo");

        Assert.Equal(5, edited.Rating);
        Assert.Equal("Na verdade, ótimo", edited.Comment);
    }

    [Fact]
    public async Task EditAsync_ReviewOfAnotherResident_ThrowsReviewNotFound()
    {
        // "Somente o Resident daquele Booking pode avaliar" também vale para editar.
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var created = await sut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 3, null);

        await Assert.ThrowsAsync<ReviewNotFoundException>(
            () => sut.EditAsync(Guid.NewGuid(), created.Id, 5, null));
    }

    [Fact]
    public async Task EditAsync_UnknownReview_ThrowsReviewNotFound()
    {
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<ReviewNotFoundException>(
            () => sut.EditAsync(Guid.NewGuid(), Guid.NewGuid(), 5, null));
    }

    [Fact]
    public async Task EditAsync_RatingOutOfRange_ThrowsDomainException()
    {
        var fixture = new ReviewServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var residentId = Guid.NewGuid();
        var created = await sut.CreateAsync(residentId, Guid.NewGuid(), Guid.NewGuid(), 3, null);

        await Assert.ThrowsAsync<DomainException>(() => sut.EditAsync(residentId, created.Id, 0, null));
    }

    [Fact]
    public async Task ListReceivedAsync_ReturnsOnlyThisProfessionalsReviews()
    {
        var fixture = new ReviewServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();
        await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, 4, null);
        await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 2, null);
        var professionalSut = fixture.CreateProfessionalSut();

        var received = await professionalSut.ListReceivedAsync(professionalId);

        Assert.Single(received);
    }

    [Fact]
    public async Task GetRatingSummaryAsync_NoReviews_ReturnsZeroAverage()
    {
        var fixture = new ReviewServiceTestFixture();
        var professionalSut = fixture.CreateProfessionalSut();

        var summary = await professionalSut.GetRatingSummaryAsync(Guid.NewGuid());

        Assert.Equal(0, summary.TotalReviews);
        Assert.Equal(0, summary.AverageRating);
    }

    [Fact]
    public async Task GetRatingSummaryAsync_WithReviews_ComputesAverage()
    {
        var fixture = new ReviewServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();
        await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, 5, null);
        await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), professionalId, 3, null);
        var professionalSut = fixture.CreateProfessionalSut();

        var summary = await professionalSut.GetRatingSummaryAsync(professionalId);

        Assert.Equal(2, summary.TotalReviews);
        Assert.Equal(4, summary.AverageRating);
    }
}
