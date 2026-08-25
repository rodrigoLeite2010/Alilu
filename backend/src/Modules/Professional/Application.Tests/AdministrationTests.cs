using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>
/// Cobre a fila administrativa de solicitações de atendimento
/// (<see cref="IProfessionalAdministrationService"/>) e autorização — mesmo
/// espírito de ApprovalAndRejectionTests + AuthorizationTests no módulo
/// Resident, combinados em um único arquivo dado o escopo menor desta
/// etapa.
/// </summary>
public sealed class AdministrationTests
{
    private static async Task<(ProfessionalServiceTestFixture Fixture, Guid AssociationId)> WithPendingRequestAsync()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var profileSut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await profileSut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);
        var association = await profileSut.RequestCondominiumAsync(userId, Guid.NewGuid());
        return (fixture, association.Id);
    }

    [Fact]
    public async Task ListPendingCondominiumRequestsAsync_WithAdminRole_ReturnsThePendingRequest()
    {
        var (fixture, _) = await WithPendingRequestAsync();
        var adminSut = fixture.CreateAdministrationSut();

        var pending = await adminSut.ListPendingCondominiumRequestsAsync(ProfessionalRequesterRole.CondominiumAdmin);

        Assert.Single(pending);
    }

    [Fact]
    public async Task ApproveCondominiumAsync_MovesTheAssociationToActive()
    {
        var (fixture, associationId) = await WithPendingRequestAsync();
        var adminSut = fixture.CreateAdministrationSut();

        var approved = await adminSut.ApproveCondominiumAsync(ProfessionalRequesterRole.SuperAdmin, associationId);

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Active, approved.Status);
    }

    [Fact]
    public async Task RejectCondominiumAsync_MovesTheAssociationToRejected()
    {
        var (fixture, associationId) = await WithPendingRequestAsync();
        var adminSut = fixture.CreateAdministrationSut();

        var rejected = await adminSut.RejectCondominiumAsync(ProfessionalRequesterRole.CondominiumAdmin, associationId);

        Assert.Equal(Domain.ProfessionalCondominiumStatus.Rejected, rejected.Status);
    }

    [Fact]
    public async Task ApproveCondominiumAsync_AlreadyApproved_ThrowsProfessionalCondominiumNotPendingException()
    {
        var (fixture, associationId) = await WithPendingRequestAsync();
        var adminSut = fixture.CreateAdministrationSut();
        await adminSut.ApproveCondominiumAsync(ProfessionalRequesterRole.SuperAdmin, associationId);

        await Assert.ThrowsAsync<ProfessionalCondominiumNotPendingException>(() =>
            adminSut.ApproveCondominiumAsync(ProfessionalRequesterRole.SuperAdmin, associationId));
    }

    [Fact]
    public async Task ApproveCondominiumAsync_UnknownId_ThrowsProfessionalCondominiumNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();

        await Assert.ThrowsAsync<ProfessionalCondominiumNotFoundException>(() =>
            adminSut.ApproveCondominiumAsync(ProfessionalRequesterRole.SuperAdmin, Guid.NewGuid()));
    }

    [Theory]
    [InlineData(ProfessionalRequesterRole.Resident)]
    [InlineData(ProfessionalRequesterRole.Professional)]
    public async Task EveryAdministrativeOperation_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        ProfessionalRequesterRole nonAdminRole)
    {
        var (fixture, associationId) = await WithPendingRequestAsync();
        var adminSut = fixture.CreateAdministrationSut();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ListPendingCondominiumRequestsAsync(nonAdminRole));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ApproveCondominiumAsync(nonAdminRole, associationId));

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.RejectCondominiumAsync(nonAdminRole, associationId));
    }
}
