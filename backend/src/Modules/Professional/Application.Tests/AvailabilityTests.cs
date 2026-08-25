using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre "configurar dias; configurar horários" (PROMPT 07 — <see cref="IProfessionalAvailabilityService"/>, agenda recorrente).</summary>
public sealed class AvailabilityTests
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
    public async Task AddAvailabilityAsync_WithValidRange_AddsTheSlot()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        Assert.Equal(DayOfWeek.Monday, slot.DayOfWeek);
        Assert.True(slot.Active);
    }

    [Fact]
    public async Task AddAvailabilityAsync_StartAfterOrEqualToEnd_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(12, 0), new TimeOnly(8, 0)));
    }

    [Fact]
    public async Task AddAvailabilityAsync_WithoutAProfile_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            sut.AddAvailabilityAsync(Guid.NewGuid(), DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0)));
    }

    [Fact]
    public async Task AddAvailabilityAsync_NonOverlappingSameDay_AddsBothSlots()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var afternoon = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(13, 0), new TimeOnly(17, 0));

        var overview = await sut.GetMyAvailabilityAsync(userId);
        Assert.Equal(2, overview.WeeklySchedule.Count);
        Assert.Contains(overview.WeeklySchedule, s => s.Id == afternoon.Id);
    }

    [Fact]
    public async Task AddAvailabilityAsync_OverlappingSameDay_ThrowsOverlappingAvailabilityException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() =>
            sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(11, 0), new TimeOnly(14, 0)));
    }

    [Fact]
    public async Task AddAvailabilityAsync_SameTimesDifferentDay_DoesNotOverlap()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var tuesday = await sut.AddAvailabilityAsync(userId, DayOfWeek.Tuesday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        Assert.Equal(DayOfWeek.Tuesday, tuesday.DayOfWeek);
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_ChangesTimes()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var updated = await sut.UpdateAvailabilityAsync(userId, slot.Id, DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(13, 0));

        Assert.Equal(new TimeOnly(9, 0), updated.StartTime);
        Assert.Equal(new TimeOnly(13, 0), updated.EndTime);
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_DoesNotConflictWithItself()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        // Só ajusta o término, mantendo o início — não deveria "colidir com
        // si mesmo" durante a checagem de sobreposição.
        var updated = await sut.UpdateAvailabilityAsync(userId, slot.Id, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(11, 0));

        Assert.Equal(new TimeOnly(11, 0), updated.EndTime);
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_OverlappingAnotherSlot_ThrowsOverlappingAvailabilityException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));
        var afternoon = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(13, 0), new TimeOnly(17, 0));

        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() =>
            sut.UpdateAvailabilityAsync(userId, afternoon.Id, DayOfWeek.Monday, new TimeOnly(11, 0), new TimeOnly(14, 0)));
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_SlotBelongingToAnotherProfessional_ThrowsProfessionalAvailabilityNotFoundException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var otherProfileSut = fixture.CreateProfileSut();
        var otherUserId = Guid.NewGuid();
        await otherProfileSut.CreateProfileAsync(otherUserId, "Outro Profissional", null, null, null);
        var otherAvailabilitySut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalAvailabilityNotFoundException>(() =>
            otherAvailabilitySut.UpdateAvailabilityAsync(otherUserId, slot.Id, DayOfWeek.Tuesday, new TimeOnly(8, 0), new TimeOnly(12, 0)));
    }

    [Fact]
    public async Task RemoveAvailabilityAsync_DeactivatesTheSlot_AndAllowsReaddingTheSameSchedule()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Wednesday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        await sut.RemoveAvailabilityAsync(userId, slot.Id);
        var readded = await sut.AddAvailabilityAsync(userId, DayOfWeek.Wednesday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var overview = await sut.GetMyAvailabilityAsync(userId);
        Assert.True(readded.Active);
        Assert.False(overview.WeeklySchedule.Single(s => s.Id == slot.Id).Active);
    }

    [Fact]
    public async Task RemoveAvailabilityAsync_SlotBelongingToAnotherProfessional_ThrowsProfessionalAvailabilityNotFoundException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        var slot = await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var otherProfileSut = fixture.CreateProfileSut();
        var otherUserId = Guid.NewGuid();
        await otherProfileSut.CreateProfileAsync(otherUserId, "Outro Profissional", null, null, null);
        var otherAvailabilitySut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalAvailabilityNotFoundException>(() =>
            otherAvailabilitySut.RemoveAvailabilityAsync(otherUserId, slot.Id));
    }
}
