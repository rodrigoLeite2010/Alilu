using Alilu.Modules.Professional.Domain;
using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre "bloquear datas; liberar horários específicos" (PROMPT 07 — <see cref="IProfessionalAvailabilityService"/>, exceções).</summary>
public sealed class AvailabilityExceptionTests
{
    private static async Task<(ProfessionalServiceTestFixture Fixture, Guid UserId)> WithProfileAsync()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        return (fixture, userId);
    }

    [Fact]
    public async Task AddExceptionAsync_FullDayBlock_AddsWithNullTimes()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var exception = await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 12, 25), null, null, ProfessionalAvailabilityExceptionType.Blocked, "Feriado");

        Assert.Null(exception.StartTime);
        Assert.Null(exception.EndTime);
        Assert.Equal(ProfessionalAvailabilityExceptionType.Blocked, exception.Type);
    }

    [Fact]
    public async Task AddExceptionAsync_PartialAvailableWindow_AddsWithTimes()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var exception = await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        Assert.Equal(new TimeOnly(14, 0), exception.StartTime);
        Assert.Equal(ProfessionalAvailabilityExceptionType.Available, exception.Type);
    }

    [Fact]
    public async Task AddExceptionAsync_WithoutAProfile_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            sut.AddExceptionAsync(Guid.NewGuid(), new DateOnly(2026, 12, 25), null, null, ProfessionalAvailabilityExceptionType.Blocked, null));
    }

    [Fact]
    public async Task AddExceptionAsync_OnlyOneOfStartOrEndInformed_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.AddExceptionAsync(userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), null, ProfessionalAvailabilityExceptionType.Blocked, null));
    }

    [Fact]
    public async Task AddExceptionAsync_OverlappingAnotherExceptionSameDate_ThrowsOverlappingAvailabilityException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() =>
            sut.AddExceptionAsync(userId, new DateOnly(2026, 9, 2), new TimeOnly(15, 0), new TimeOnly(17, 0), ProfessionalAvailabilityExceptionType.Blocked, null));
    }

    [Fact]
    public async Task AddExceptionAsync_FullDayThenAnyOtherSameDate_ThrowsOverlappingAvailabilityException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddExceptionAsync(userId, new DateOnly(2026, 12, 25), null, null, ProfessionalAvailabilityExceptionType.Blocked, "Feriado");

        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() =>
            sut.AddExceptionAsync(userId, new DateOnly(2026, 12, 25), new TimeOnly(9, 0), new TimeOnly(10, 0), ProfessionalAvailabilityExceptionType.Available, null));
    }

    [Fact]
    public async Task AddExceptionAsync_SameTimesDifferentDate_DoesNotOverlap()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        var other = await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 3), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        Assert.Equal(new DateOnly(2026, 9, 3), other.Date);
    }

    [Fact]
    public async Task RemoveExceptionAsync_RemovesItPermanently()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var exception = await sut.AddExceptionAsync(userId, new DateOnly(2026, 12, 25), null, null, ProfessionalAvailabilityExceptionType.Blocked, "Feriado");

        await sut.RemoveExceptionAsync(userId, exception.Id);

        var overview = await sut.GetMyAvailabilityAsync(userId);
        Assert.Empty(overview.Exceptions);
    }

    [Fact]
    public async Task RemoveExceptionAsync_ThenReaddingSameWindow_Works()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var exception = await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);
        await sut.RemoveExceptionAsync(userId, exception.Id);

        var readded = await sut.AddExceptionAsync(
            userId, new DateOnly(2026, 9, 2), new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        Assert.NotEqual(exception.Id, readded.Id);
    }

    [Fact]
    public async Task RemoveExceptionAsync_BelongingToAnotherProfessional_ThrowsProfessionalAvailabilityExceptionNotFoundException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var exception = await sut.AddExceptionAsync(userId, new DateOnly(2026, 12, 25), null, null, ProfessionalAvailabilityExceptionType.Blocked, "Feriado");

        var otherProfileSut = fixture.CreateProfileSut();
        var otherUserId = Guid.NewGuid();
        await otherProfileSut.CreateProfileAsync(otherUserId, "Outro Profissional", null, null, null);
        var otherAvailabilitySut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalAvailabilityExceptionNotFoundException>(() =>
            otherAvailabilitySut.RemoveExceptionAsync(otherUserId, exception.Id));
    }
}
