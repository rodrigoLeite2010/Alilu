using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre o diretório público (<see cref="IProfessionalDirectoryService"/> — "listar profissionais; filtrar categoria; visualizar perfil").</summary>
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
}
