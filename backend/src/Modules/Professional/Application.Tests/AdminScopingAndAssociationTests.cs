using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>
/// Etapa 12 (PROMPT 12) — "bloquear"/"associar ao condomínio" (novos casos
/// de uso administrativos deste módulo) e o escopo por condomínio
/// ("CondominiumAdmin somente pode administrar seu próprio condomínio").
/// <c>AdministrationTests</c> continua cobrindo aprovar/rejeitar/listar
/// pendentes e a autorização por papel.
/// </summary>
public sealed class AdminScopingAndAssociationTests
{
    private static async Task<(ProfessionalServiceTestFixture Fixture, Guid ProfessionalId)> WithProfessionalProfileAsync()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var profile = await profileSut.CreateProfileAsync(Guid.NewGuid(), "Maria Diarista", null, null, null);
        return (fixture, profile.Id);
    }

    [Fact]
    public async Task AssociateAsync_WithValidData_CreatesActiveAssociationWithAdminApprovedSource()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var condominiumId = Guid.NewGuid();

        var association = await adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, condominiumId);

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Active, association.Status);
        Assert.Equal(Domain.ProfessionalCondominiumSource.AdminApproved, association.Source);
        Assert.Equal(condominiumId, association.CondominiumId);
    }

    [Fact]
    public async Task AssociateAsync_WithUnknownProfessional_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task AssociateAsync_AlreadyAssociated_ThrowsDuplicateProfessionalCondominiumException()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var condominiumId = Guid.NewGuid();
        await adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, condominiumId);

        await Assert.ThrowsAsync<DuplicateProfessionalCondominiumException>(() =>
            adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, condominiumId));
    }

    [Fact]
    public async Task AssociateAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, otherCondominiumId, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task BlockAsync_ActiveAssociation_DeactivatesIt()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var association = await adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, Guid.NewGuid());

        var blocked = await adminSut.BlockAsync(ProfessionalRequesterRole.CondominiumAdmin, association.Id);

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Inactive, blocked.Status);
    }

    [Fact]
    public async Task BlockAsync_WithUnknownId_ThrowsProfessionalCondominiumNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();

        await Assert.ThrowsAsync<ProfessionalCondominiumNotFoundException>(() =>
            adminSut.BlockAsync(ProfessionalRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }

    [Fact]
    public async Task BlockAsync_ForAssociationOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var otherCondominiumId = Guid.NewGuid();
        var association = await adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, otherCondominiumId);
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(ProfessionalRequesterRole.CondominiumAdmin, association.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ApproveCondominiumAsync_ForRequestOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var adminSut = fixture.CreateAdministrationSut();
        var userId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        var otherCondominiumId = Guid.NewGuid();
        var request = await profileSut.RequestCondominiumAsync(userId, otherCondominiumId);
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ApproveCondominiumAsync(ProfessionalRequesterRole.CondominiumAdmin, request.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ListByCondominiumAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ListByCondominiumAsync(ProfessionalRequesterRole.CondominiumAdmin, otherCondominiumId, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ListByCondominiumAsync_ReturnsAllAssociationsRegardlessOfStatus()
    {
        var (fixture, professionalId) = await WithProfessionalProfileAsync();
        var adminSut = fixture.CreateAdministrationSut();
        var condominiumId = Guid.NewGuid();
        var association = await adminSut.AssociateAsync(ProfessionalRequesterRole.CondominiumAdmin, professionalId, condominiumId);
        await adminSut.BlockAsync(ProfessionalRequesterRole.CondominiumAdmin, association.Id);

        var list = await adminSut.ListByCondominiumAsync(ProfessionalRequesterRole.CondominiumAdmin, condominiumId);

        var only = Assert.Single(list);
        Assert.Equal(Domain.ProfessionalCondominiumStatus.Inactive, only.Status);
    }

    [Fact]
    public async Task ListPendingCondominiumRequestsAsync_ScopedToOwnCondominium_ReturnsOnlyThatCondominiumsPending()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var adminSut = fixture.CreateAdministrationSut();
        var userA = Guid.NewGuid();
        var userB = Guid.NewGuid();
        await profileSut.CreateProfileAsync(userA, "Profissional A", null, null, null);
        await profileSut.CreateProfileAsync(userB, "Profissional B", null, null, null);
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();
        await profileSut.RequestCondominiumAsync(userA, condominiumA);
        await profileSut.RequestCondominiumAsync(userB, condominiumB);

        var scoped = await adminSut.ListPendingCondominiumRequestsAsync(ProfessionalRequesterRole.CondominiumAdmin, scopeCondominiumId: condominiumA);

        var only = Assert.Single(scoped);
        Assert.Equal(condominiumA, only.CondominiumId);
    }
}
