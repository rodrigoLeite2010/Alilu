using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>
/// Etapa 19 (agenda e disponibilidade) — cobre <see cref="IProfessionalAvailabilityService.SetBulkAvailabilityAsync"/>
/// e <see cref="IProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/>. A resolução de janelas em si
/// (bloqueios recortando, liberações somando, dia inteiro) já é coberta indiretamente por
/// <see cref="OpenWindowResolver"/> através dos testes existentes de <c>ListOpenWindowsAsync</c>
/// (<see cref="ProfessionalDirectoryService"/>) — aqui o foco é o que É NOVO: cadastro em massa e a
/// versão "por intervalo de datas" (várias datas de uma vez), incluindo o respeito a
/// <see cref="Domain.ProfessionalAvailability.EffectiveFrom"/>/<see cref="Domain.ProfessionalAvailability.EffectiveUntil"/>.
/// </summary>
public sealed class AgendaTests
{
    private static async Task<(ProfessionalServiceTestFixture Fixture, Guid UserId)> WithProfileAsync()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        return (fixture, userId);
    }

    // --- SetBulkAvailabilityAsync ---------------------------------------

    [Fact]
    public async Task SetBulkAvailabilityAsync_OneDayOnePeriod_CreatesExactlyOneSlot()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var created = await sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: null,
            effectiveUntil: null);

        var slot = Assert.Single(created);
        Assert.Equal(DayOfWeek.Monday, slot.DayOfWeek);
        Assert.Equal(new TimeOnly(7, 0), slot.StartTime);
        Assert.Equal(new TimeOnly(12, 0), slot.EndTime);
        Assert.True(slot.Active);
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_MultipleDaysAndPeriods_CreatesTheCartesianProduct()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var days = new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday };
        var periods = new[]
        {
            new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)),
            new AvailabilityPeriodInput(new TimeOnly(12, 0), new TimeOnly(18, 0)),
        };

        var created = await sut.SetBulkAvailabilityAsync(userId, days, periods, effectiveFrom: null, effectiveUntil: null);

        Assert.Equal(6, created.Count);
        foreach (var day in days)
        {
            Assert.Equal(2, created.Count(slot => slot.DayOfWeek == day));
        }
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_WithoutDateBounds_IsRecurringForever()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Thursday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: null,
            effectiveUntil: null);

        // "Repetir toda semana" — sem data final, precisa valer em qualquer
        // quinta-feira, mesmo daqui a alguns anos: parte de uma data base
        // qualquer e avança até a próxima quinta-feira.
        var baseDate = new DateOnly(2030, 1, 1);
        var daysUntilThursday = ((int)DayOfWeek.Thursday - (int)baseDate.DayOfWeek + 7) % 7;
        var farFutureThursday = baseDate.AddDays(daysUntilThursday);
        Assert.Equal(DayOfWeek.Thursday, farFutureThursday.DayOfWeek);

        var windows = await sut.GetMyOpenWindowsRangeAsync(userId, farFutureThursday, farFutureThursday);
        Assert.Single(windows[0].OpenWindows);
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_WithDateBounds_OnlyEffectiveWithinRange()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        // "Personalizado" — só vale em setembro/2026 (uma quarta-feira: 2026-09-02).
        await sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Wednesday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: new DateOnly(2026, 9, 1),
            effectiveUntil: new DateOnly(2026, 9, 30));

        var withinRange = await sut.GetMyOpenWindowsRangeAsync(userId, new DateOnly(2026, 9, 2), new DateOnly(2026, 9, 2));
        var beforeRange = await sut.GetMyOpenWindowsRangeAsync(userId, new DateOnly(2026, 8, 26), new DateOnly(2026, 8, 26));
        var afterRange = await sut.GetMyOpenWindowsRangeAsync(userId, new DateOnly(2026, 10, 7), new DateOnly(2026, 10, 7));

        Assert.Single(withinRange[0].OpenWindows);
        Assert.Empty(beforeRange[0].OpenWindows);
        Assert.Empty(afterRange[0].OpenWindows);
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_ConflictingWithExistingSlot_ThrowsOverlappingAvailabilityException_AndCreatesNothing()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();
        await sut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(10, 0));

        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() => sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday, DayOfWeek.Tuesday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(9, 0), new TimeOnly(11, 0)) },
            effectiveFrom: null,
            effectiveUntil: null));

        // Tudo-ou-nada: a Terça-feira (que não colidia com nada) também não
        // deve ter sido gravada.
        var overview = await sut.GetMyAvailabilityAsync(userId);
        Assert.DoesNotContain(overview.WeeklySchedule, slot => slot.DayOfWeek == DayOfWeek.Tuesday);
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_ConflictingWithinTheSameBatch_ThrowsOverlappingAvailabilityException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        // Pedir "Manhã" duas vezes por engano, para a mesma Segunda.
        await Assert.ThrowsAsync<OverlappingAvailabilityException>(() => sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday },
            new[]
            {
                new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)),
                new AvailabilityPeriodInput(new TimeOnly(9, 0), new TimeOnly(11, 0)),
            },
            effectiveFrom: null,
            effectiveUntil: null));
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_NoDaysSelected_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() => sut.SetBulkAvailabilityAsync(
            userId,
            Array.Empty<DayOfWeek>(),
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: null,
            effectiveUntil: null));
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_NoPeriodsSelected_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() => sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday },
            Array.Empty<AvailabilityPeriodInput>(),
            effectiveFrom: null,
            effectiveUntil: null));
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_EffectiveFromAfterEffectiveUntil_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() => sut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: new DateOnly(2026, 9, 30),
            effectiveUntil: new DateOnly(2026, 9, 1)));
    }

    [Fact]
    public async Task SetBulkAvailabilityAsync_WithoutAProfile_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() => sut.SetBulkAvailabilityAsync(
            Guid.NewGuid(),
            new[] { DayOfWeek.Monday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(12, 0)) },
            effectiveFrom: null,
            effectiveUntil: null));
    }

    // --- GetMyOpenWindowsRangeAsync --------------------------------------

    [Fact]
    public async Task GetMyOpenWindowsRangeAsync_ReturnsOneEntryPerDateInRange()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        var from = new DateOnly(2026, 9, 1);
        var to = new DateOnly(2026, 9, 7);

        var windows = await sut.GetMyOpenWindowsRangeAsync(userId, from, to);

        Assert.Equal(7, windows.Count);
        Assert.Equal(from, windows[0].Date);
        Assert.Equal(to, windows[^1].Date);
    }

    [Fact]
    public async Task GetMyOpenWindowsRangeAsync_BlockedException_ReportsBlockedWindowWithReason()
    {
        var (fixture, userId) = await WithProfileAsync();
        var availabilitySut = fixture.CreateAvailabilitySut();
        await availabilitySut.SetBulkAvailabilityAsync(
            userId,
            new[] { DayOfWeek.Monday },
            new[] { new AvailabilityPeriodInput(new TimeOnly(7, 0), new TimeOnly(18, 0)) },
            effectiveFrom: null,
            effectiveUntil: null);

        // 2026-09-07 é uma segunda-feira.
        var blockedDate = new DateOnly(2026, 9, 7);
        await availabilitySut.AddExceptionAsync(
            userId, blockedDate, new TimeOnly(12, 0), new TimeOnly(13, 0),
            Domain.ProfessionalAvailabilityExceptionType.Blocked, "Compromisso pessoal");

        var windows = await availabilitySut.GetMyOpenWindowsRangeAsync(userId, blockedDate, blockedDate);

        var day = Assert.Single(windows);
        var blocked = Assert.Single(day.BlockedWindows);
        Assert.Equal("Compromisso pessoal", blocked.Reason);
        Assert.Equal(2, day.OpenWindows.Count); // 07-12 e 13-18, com o almoço bloqueado recortado no meio.
    }

    [Fact]
    public async Task GetMyOpenWindowsRangeAsync_RangeLongerThan62Days_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.GetMyOpenWindowsRangeAsync(userId, new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 1)));
    }

    [Fact]
    public async Task GetMyOpenWindowsRangeAsync_ToBeforeFrom_ThrowsDomainException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateAvailabilitySut();

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.GetMyOpenWindowsRangeAsync(userId, new DateOnly(2026, 9, 10), new DateOnly(2026, 9, 1)));
    }
}
