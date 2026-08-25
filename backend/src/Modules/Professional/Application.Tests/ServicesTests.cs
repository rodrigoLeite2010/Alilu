using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre "selecionar serviços" (adicionar/remover — <see cref="IProfessionalProfileService"/>).</summary>
public sealed class ServicesTests
{
    private static async Task<(ProfessionalServiceTestFixture Fixture, Guid UserId)> WithProfileAsync()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        return (fixture, userId);
    }

    [Fact]
    public async Task AddMyServiceAsync_WithActiveCategory_AddsTheService()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Diarista");

        var service = await sut.AddMyServiceAsync(userId, category.Id, "Faxina completa");

        Assert.Equal(category.Id, service.ServiceCategoryId);
        Assert.True(service.Active);
    }

    [Fact]
    public async Task AddMyServiceAsync_WithoutAProfile_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Diarista");

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            sut.AddMyServiceAsync(Guid.NewGuid(), category.Id, null));
    }

    [Fact]
    public async Task AddMyServiceAsync_WithUnknownCategory_ThrowsServiceCategoryNotFoundException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();

        await Assert.ThrowsAsync<ServiceCategoryNotFoundException>(() =>
            sut.AddMyServiceAsync(userId, Guid.NewGuid(), null));
    }

    [Fact]
    public async Task AddMyServiceAsync_WithInactiveCategory_ThrowsServiceCategoryInactiveException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Descontinuada", active: false);

        await Assert.ThrowsAsync<ServiceCategoryInactiveException>(() =>
            sut.AddMyServiceAsync(userId, category.Id, null));
    }

    [Fact]
    public async Task AddMyServiceAsync_WhenAlreadyActiveForTheSameCategory_ThrowsDuplicateProfessionalServiceException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Diarista");
        await sut.AddMyServiceAsync(userId, category.Id, null);

        await Assert.ThrowsAsync<DuplicateProfessionalServiceException>(() =>
            sut.AddMyServiceAsync(userId, category.Id, null));
    }

    [Fact]
    public async Task RemoveMyServiceAsync_DeactivatesTheService_AndAllowsReaddingTheSameCategory()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Jardineiro");
        var service = await sut.AddMyServiceAsync(userId, category.Id, null);

        await sut.RemoveMyServiceAsync(userId, service.Id);
        var readded = await sut.AddMyServiceAsync(userId, category.Id, null);

        var myServices = await sut.ListMyServicesAsync(userId);
        Assert.Equal(2, myServices.Count);
        Assert.True(readded.Active);
        Assert.False(myServices.Single(s => s.Id == service.Id).Active);
    }

    [Fact]
    public async Task RemoveMyServiceAsync_ServiceBelongingToAnotherProfessional_ThrowsProfessionalServiceNotFoundException()
    {
        var (fixture, userId) = await WithProfileAsync();
        var sut = fixture.CreateProfileSut();
        var category = fixture.ServiceCategoryRepository.Seed("Diarista");
        var service = await sut.AddMyServiceAsync(userId, category.Id, null);

        // Segundo profissional, tentando remover o serviço do primeiro.
        var otherProfileSut = fixture.CreateProfileSut();
        var otherUserId = Guid.NewGuid();
        await otherProfileSut.CreateProfileAsync(otherUserId, "Outro Profissional", null, null, null);

        await Assert.ThrowsAsync<ProfessionalServiceNotFoundException>(() =>
            otherProfileSut.RemoveMyServiceAsync(otherUserId, service.Id));
    }
}
