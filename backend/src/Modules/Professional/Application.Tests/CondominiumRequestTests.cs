using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre "solicitar atendimento em condomínios" (<see cref="IProfessionalProfileService.RequestCondominiumAsync"/>).</summary>
public sealed class CondominiumRequestTests
{
    [Fact]
    public async Task RequestCondominiumAsync_CreatesAPendingAssociation_WithProfessionalRequestedSource()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        var condominiumId = Guid.NewGuid();

        var association = await sut.RequestCondominiumAsync(userId, condominiumId);

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Pending, association.Status);
        Assert.Equal(Domain.ProfessionalCondominiumSource.ProfessionalRequested, association.Source);
        Assert.Equal(condominiumId, association.CondominiumId);
    }

    [Fact]
    public async Task RequestCondominiumAsync_WithoutAProfile_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            sut.RequestCondominiumAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task RequestCondominiumAsync_WhenAlreadyPendingForTheSameCondominium_ThrowsDuplicateProfessionalCondominiumException()
    {
        // "Não permitir vínculo duplicado" — mesma regra do módulo Resident.
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        var condominiumId = Guid.NewGuid();
        await sut.RequestCondominiumAsync(userId, condominiumId);

        await Assert.ThrowsAsync<DuplicateProfessionalCondominiumException>(() =>
            sut.RequestCondominiumAsync(userId, condominiumId));
    }

    [Fact]
    public async Task RequestCondominiumAsync_SameProfessionalDifferentCondominium_DoesNotConflict()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);

        await sut.RequestCondominiumAsync(userId, Guid.NewGuid());
        var second = await sut.RequestCondominiumAsync(userId, Guid.NewGuid());

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Pending, second.Status);
        var mine = await sut.ListMyCondominiumsAsync(userId);
        Assert.Equal(2, mine.Count);
    }
}
