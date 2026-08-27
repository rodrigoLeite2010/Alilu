using Alilu.Modules.Professional.Domain;
using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>
/// Cobre o diretório público (<see cref="IProfessionalDirectoryService"/> —
/// "listar profissionais; filtrar categoria; visualizar perfil") e, desde
/// o PROMPT 08, as duas validações usadas pela composição do módulo
/// Scheduling: <see cref="IProfessionalDirectoryService.ValidateAttendsCondominiumAsync"/>
/// ("profissional deve atender o condomínio") e
/// <see cref="IProfessionalDirectoryService.ValidateAvailableAsync"/> ("o
/// horário deve estar disponível", incluindo a resolução "exceções
/// sobrescrevem a agenda recorrente" herdada da Etapa 07).
/// </summary>
public sealed class DirectoryTests
{
    [Fact]
    public async Task ListProfessionalsAsync_WithoutFilter_ReturnsOnlyActiveProfessionals()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var directorySut = fixture.CreateDirectorySut();

        var activeUserId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(activeUserId, "Ativa", null, null, null);

        var inactiveUserId = Guid.NewGuid();
        var inactiveProfile = await profileSut.CreateProfileAsync(inactiveUserId, "Inativa", null, null, null);
        var inactiveEntity = fixture.ProfessionalRepository.Professionals.Single(p => p.Id == inactiveProfile.Id);
        inactiveEntity.Deactivate();

        var professionals = await directorySut.ListProfessionalsAsync(serviceCategoryId: null);

        Assert.Single(professionals);
        Assert.Equal("Ativa", professionals[0].DisplayName);
    }

    [Fact]
    public async Task ListProfessionalsAsync_FilteredByCategory_ReturnsOnlyProfessionalsWithAnActiveServiceInThatCategory()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var directorySut = fixture.CreateDirectorySut();
        var gardening = fixture.ServiceCategoryRepository.Seed("Jardineiro");
        var electrics = fixture.ServiceCategoryRepository.Seed("Eletricista");

        var gardenerUserId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(gardenerUserId, "João Jardineiro", null, null, null);
        await profileSut.AddMyServiceAsync(gardenerUserId, gardening.Id, null);

        var electricianUserId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(electricianUserId, "Pedro Eletricista", null, null, null);
        await profileSut.AddMyServiceAsync(electricianUserId, electrics.Id, null);

        var gardeners = await directorySut.ListProfessionalsAsync(gardening.Id);

        Assert.Single(gardeners);
        Assert.Equal("João Jardineiro", gardeners[0].DisplayName);
        Assert.Single(gardeners[0].Categories);
        Assert.Equal("Jardineiro", gardeners[0].Categories[0].Name);
    }

    [Fact]
    public async Task GetProfessionalProfileAsync_ExistingActiveProfile_ReturnsIt()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Maria Diarista", "Descrição", null, null);

        var found = await directorySut.GetProfessionalProfileAsync(profile.Id);

        Assert.NotNull(found);
        Assert.Equal("Maria Diarista", found!.DisplayName);
    }

    [Fact]
    public async Task GetProfessionalProfileAsync_UnknownId_ReturnsNull()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();

        var found = await directorySut.GetProfessionalProfileAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task ListCategoriesAsync_ReturnsOnlyActiveCategories()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();
        fixture.ServiceCategoryRepository.Seed("Diarista");
        fixture.ServiceCategoryRepository.Seed("Descontinuada", active: false);

        var categories = await directorySut.ListCategoriesAsync();

        Assert.Single(categories);
        Assert.Equal("Diarista", categories[0].Name);
    }

    // ---- ValidateAttendsCondominiumAsync (PROMPT 08) ----

    [Fact]
    public async Task ValidateAttendsCondominiumAsync_WithActiveLink_DoesNotThrow()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();
        var professionalId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        await fixture.ProfessionalCondominiumRepository.AddAsync(
            ProfessionalCondominium.CreateActive(professionalId, condominiumId, ProfessionalCondominiumSource.AdminApproved));

        await directorySut.ValidateAttendsCondominiumAsync(professionalId, condominiumId);
    }

    [Fact]
    public async Task ValidateAttendsCondominiumAsync_WithoutAnyLink_Throws()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();

        await Assert.ThrowsAsync<ProfessionalDoesNotAttendCondominiumException>(
            () => directorySut.ValidateAttendsCondominiumAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task ValidateAttendsCondominiumAsync_WithOnlyAPendingLink_Throws()
    {
        // Uma solicitação Pending (ainda não aprovada por um administrador)
        // não conta como "atende o condomínio" — só Active.
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();
        var professionalId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        await fixture.ProfessionalCondominiumRepository.AddAsync(ProfessionalCondominium.RequestService(professionalId, condominiumId));

        await Assert.ThrowsAsync<ProfessionalDoesNotAttendCondominiumException>(
            () => directorySut.ValidateAttendsCondominiumAsync(professionalId, condominiumId));
    }

    [Fact]
    public async Task ValidateAttendsCondominiumAsync_LinkToADifferentCondominium_Throws()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();
        var professionalId = Guid.NewGuid();
        await fixture.ProfessionalCondominiumRepository.AddAsync(
            ProfessionalCondominium.CreateActive(professionalId, Guid.NewGuid(), ProfessionalCondominiumSource.AdminApproved));

        await Assert.ThrowsAsync<ProfessionalDoesNotAttendCondominiumException>(
            () => directorySut.ValidateAttendsCondominiumAsync(professionalId, Guid.NewGuid()));
    }

    // ---- ValidateAvailableAsync (PROMPT 08) ----

    [Fact]
    public async Task ValidateAvailableAsync_UnknownProfessional_ThrowsProfessionalNotFound()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var directorySut = fixture.CreateDirectorySut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            directorySut.ValidateAvailableAsync(Guid.NewGuid(), DateOnly.FromDateTime(DateTime.UtcNow), new TimeOnly(9, 0), new TimeOnly(10, 0)));
    }

    [Fact]
    public async Task ValidateAvailableAsync_WithinRecurringSchedule_DoesNotThrow()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var monday = NextDateForDayOfWeek(DayOfWeek.Monday);

        await directorySut.ValidateAvailableAsync(profile.Id, monday, new TimeOnly(9, 0), new TimeOnly(10, 0));
    }

    [Fact]
    public async Task ValidateAvailableAsync_OutsideRecurringSchedule_ThrowsTimeSlotUnavailable()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        // Quarta-feira: sem nenhum intervalo cadastrado — "indisponível" (exemplo do próprio PROMPT 07).
        var wednesday = NextDateForDayOfWeek(DayOfWeek.Wednesday);

        await Assert.ThrowsAsync<TimeSlotUnavailableException>(() =>
            directorySut.ValidateAvailableAsync(profile.Id, wednesday, new TimeOnly(9, 0), new TimeOnly(10, 0)));
    }

    [Fact]
    public async Task ValidateAvailableAsync_PartiallyOutsideRecurringWindow_ThrowsTimeSlotUnavailable()
    {
        // A janela pedida precisa caber INTEIRA no intervalo — 11:00-13:00
        // não cabe em 08:00-12:00.
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));

        var monday = NextDateForDayOfWeek(DayOfWeek.Monday);

        await Assert.ThrowsAsync<TimeSlotUnavailableException>(() =>
            directorySut.ValidateAvailableAsync(profile.Id, monday, new TimeOnly(11, 0), new TimeOnly(13, 0)));
    }

    [Fact]
    public async Task ValidateAvailableAsync_BlockedByExceptionOnTopOfRecurringSchedule_ThrowsTimeSlotUnavailable()
    {
        // "Exceções sobrescrevem a disponibilidade recorrente" (Etapa 07):
        // mesmo dentro do intervalo recorrente, um bloqueio pontual vence.
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0));
        var monday = NextDateForDayOfWeek(DayOfWeek.Monday);
        await availabilitySut.AddExceptionAsync(userId, monday, null, null, ProfessionalAvailabilityExceptionType.Blocked, "Feriado");

        await Assert.ThrowsAsync<TimeSlotUnavailableException>(() =>
            directorySut.ValidateAvailableAsync(profile.Id, monday, new TimeOnly(9, 0), new TimeOnly(10, 0)));
    }

    [Fact]
    public async Task ValidateAvailableAsync_OpenedByAvailableExceptionOnAnOtherwiseUnavailableDay_DoesNotThrow()
    {
        // Quarta normalmente indisponível (sem agenda recorrente), mas com
        // uma liberação pontual cobrindo a janela pedida.
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        var wednesday = NextDateForDayOfWeek(DayOfWeek.Wednesday);
        await availabilitySut.AddExceptionAsync(
            userId, wednesday, new TimeOnly(14, 0), new TimeOnly(16, 0), ProfessionalAvailabilityExceptionType.Available, null);

        await directorySut.ValidateAvailableAsync(profile.Id, wednesday, new TimeOnly(14, 0), new TimeOnly(15, 0));
    }

    [Fact]
    public async Task ValidateAvailableAsync_AvailableExceptionSmallerThanRequestedWindow_ThrowsTimeSlotUnavailable()
    {
        // A liberação pontual cobre só 14:00-15:00; pedir 14:00-16:00 não cabe inteiro nela.
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Ana Diarista", null, null, null);
        var wednesday = NextDateForDayOfWeek(DayOfWeek.Wednesday);
        await availabilitySut.AddExceptionAsync(
            userId, wednesday, new TimeOnly(14, 0), new TimeOnly(15, 0), ProfessionalAvailabilityExceptionType.Available, null);

        await Assert.ThrowsAsync<TimeSlotUnavailableException>(() =>
            directorySut.ValidateAvailableAsync(profile.Id, wednesday, new TimeOnly(14, 0), new TimeOnly(16, 0)));
    }

    [Fact]
    public async Task ValidateAvailableAsync_WindowSpanningTwoAdjacentRecurringSlots_DoesNotThrow()
    {
        // Etapa 19 — BUG REAL encontrado testando "Minha Agenda": a tela do
        // morador funde intervalos recorrentes adjacentes (ex.: "Manhã"
        // 07:00-12:00 + "Tarde" 12:00-18:00, criados juntos por
        // SetBulkAvailabilityAsync) num único bloco visível 07:00-18:00 —
        // mas a validação antiga só aceitava um horário que coubesse INTEIRO
        // dentro de UM único intervalo, então pedir exatamente o bloco
        // exibido ao morador era sempre recusado. Este teste fixa o
        // comportamento correto: a validação agora usa o mesmo
        // OpenWindowResolver (que já funde os dois), então os dois nunca
        // mais podem divergir.
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var availabilitySut = fixture.CreateAvailabilitySut();
        var directorySut = fixture.CreateDirectorySut();
        var userId = Guid.NewGuid();
        var profile = await profileSut.CreateProfileAsync(userId, "Thais Diarista", null, null, null);
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(7, 0), new TimeOnly(12, 0));
        await availabilitySut.AddAvailabilityAsync(userId, DayOfWeek.Monday, new TimeOnly(12, 0), new TimeOnly(18, 0));

        var monday = NextDateForDayOfWeek(DayOfWeek.Monday);

        await directorySut.ValidateAvailableAsync(profile.Id, monday, new TimeOnly(7, 0), new TimeOnly(18, 0));
    }

    /// <summary>Próxima ocorrência (a partir de hoje) de um dia da semana — evita depender da data em que os testes rodam.</summary>
    private static DateOnly NextDateForDayOfWeek(DayOfWeek dayOfWeek)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysToAdd = ((int)dayOfWeek - (int)today.DayOfWeek + 7) % 7;
        return today.AddDays(daysToAdd);
    }
}
