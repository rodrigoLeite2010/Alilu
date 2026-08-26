using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO): "CondominiumAdmin somente pode
/// administrar seu próprio condomínio" — mesmo espírito de
/// <c>AdminScopingTests</c> no módulo Condominium. <c>AuthorizationTests</c>
/// cobre o eixo "papel"; esta classe cobre o eixo ortogonal "escopo"
/// (CondominiumAdmin do condomínio A não pode mexer em vínculos do B).
/// </summary>
public sealed class AdminScopingTests
{
    [Fact]
    public async Task ListPendingAsync_ScopedToOwnCondominium_ReturnsOnlyThatCondominiumsPending()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();
        await sut.RequestResidentAccessAsync(Guid.NewGuid(), condominiumA, Guid.NewGuid());
        await sut.RequestResidentAccessAsync(Guid.NewGuid(), condominiumB, Guid.NewGuid());

        var scoped = await adminSut.ListPendingAsync(ResidentRequesterRole.CondominiumAdmin, scopeCondominiumId: condominiumA);

        var onlyPending = Assert.Single(scoped);
        Assert.Equal(condominiumA, onlyPending.CondominiumId);
    }

    [Fact]
    public async Task ListByCondominiumAsync_ForCondominiumOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ListByCondominiumAsync(ResidentRequesterRole.CondominiumAdmin, otherCondominiumId, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task GetByIdAsync_ForMembershipOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherMembership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.GetByIdAsync(ResidentRequesterRole.CondominiumAdmin, otherMembership.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ApproveAsync_ForMembershipOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherMembership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), otherMembership.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task RejectAsync_ForMembershipOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherMembership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.RejectAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), otherMembership.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task BlockAsync_ForMembershipOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherMembership = await sut.CreateMembershipFromInvitationAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), otherMembership.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task GetActiveByUnitAsync_ForUnitOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var ownCondominiumId = Guid.NewGuid();
        var otherUnitId = Guid.NewGuid();
        await sut.CreateMembershipFromInvitationAsync(Guid.NewGuid(), Guid.NewGuid(), otherUnitId);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.GetActiveByUnitAsync(ResidentRequesterRole.CondominiumAdmin, otherUnitId, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task GetActiveByUnitAsync_ForVacantUnit_ReturnsNull_EvenWithScope()
    {
        // Unidade sem morador vinculado é resultado válido — não deve
        // lançar por "não encontrado" nem por escopo (não há CondominiumId
        // nenhum para comparar).
        var fixture = new MembershipServiceTestFixture();
        var adminSut = fixture.CreateAdministrationSut();

        var result = await adminSut.GetActiveByUnitAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), scopeCondominiumId: Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task InScope_AllOperations_Succeed()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var adminSut = fixture.CreateAdministrationSut();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var membership = await sut.RequestResidentAccessAsync(Guid.NewGuid(), condominiumId, unitId);

        var fetched = await adminSut.GetByIdAsync(ResidentRequesterRole.CondominiumAdmin, membership.Id, scopeCondominiumId: condominiumId);
        var list = await adminSut.ListByCondominiumAsync(ResidentRequesterRole.CondominiumAdmin, condominiumId, scopeCondominiumId: condominiumId);
        var approved = await adminSut.ApproveAsync(ResidentRequesterRole.CondominiumAdmin, Guid.NewGuid(), membership.Id, scopeCondominiumId: condominiumId);
        var activeByUnit = await adminSut.GetActiveByUnitAsync(ResidentRequesterRole.CondominiumAdmin, unitId, scopeCondominiumId: condominiumId);

        Assert.Equal(membership.Id, fetched.Id);
        Assert.Single(list);
        Assert.Equal(Domain.MembershipStatus.Active, approved.Status);
        Assert.NotNull(activeByUnit);
        Assert.Equal(membership.Id, activeByUnit!.Id);
    }
}
