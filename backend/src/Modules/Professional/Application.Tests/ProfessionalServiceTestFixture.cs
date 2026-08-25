using Alilu.Modules.Professional.Application.Tests.TestDoubles;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>
/// Monta os três serviços deste módulo
/// (<see cref="ProfessionalProfileService"/>/<see cref="ProfessionalDirectoryService"/>/
/// <see cref="ProfessionalAdministrationService"/>) reais com dependências
/// fake (em memória) — mesmo espírito de MembershipServiceTestFixture no
/// módulo Resident.
/// </summary>
internal sealed class ProfessionalServiceTestFixture
{
    public InMemoryProfessionalRepository ProfessionalRepository { get; }

    public InMemoryServiceCategoryRepository ServiceCategoryRepository { get; } = new();

    public InMemoryProfessionalServiceRepository ProfessionalServiceRepository { get; } = new();

    public InMemoryProfessionalCondominiumRepository ProfessionalCondominiumRepository { get; } = new();

    public ProfessionalServiceTestFixture()
    {
        ProfessionalRepository = new InMemoryProfessionalRepository(ProfessionalServiceRepository);
    }

    public ProfessionalProfileService CreateProfileSut() => new(
        ProfessionalRepository, ServiceCategoryRepository, ProfessionalServiceRepository, ProfessionalCondominiumRepository, new NoOpUnitOfWork());

    public ProfessionalDirectoryService CreateDirectorySut() => new(
        ProfessionalRepository, ServiceCategoryRepository, ProfessionalServiceRepository);

    public ProfessionalAdministrationService CreateAdministrationSut() => new(
        ProfessionalCondominiumRepository, new NoOpUnitOfWork());
}
