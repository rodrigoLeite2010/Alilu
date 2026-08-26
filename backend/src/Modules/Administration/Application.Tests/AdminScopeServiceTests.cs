using Alilu.Modules.Administration.Application.Tests.TestDoubles;
using Xunit;

namespace Alilu.Modules.Administration.Application.Tests;

/// <summary>
/// Cobre <see cref="AdminScopeService"/> — o núcleo do PROMPT 12
/// (AUTORIZAÇÃO): "CondominiumAdmin somente pode administrar seu próprio
/// condomínio", "SuperAdmin pode administrar todos os condomínios", "nunca
/// confiar no condominiumId enviado pelo frontend — obter o escopo do
/// usuário autenticado no backend".
/// </summary>
public sealed class AdminScopeServiceTests
{
    private static AdminScopeService CreateSut(out InMemoryCondominiumAdministratorRepository repository)
    {
        repository = new InMemoryCondominiumAdministratorRepository();
        return new AdminScopeService(repository, new FakeUnitOfWork());
    }

    [Fact]
    public async Task ResolveScopeAsync_SuperAdmin_ReturnsGlobalScope()
    {
        var sut = CreateSut(out _);
        var userId = Guid.NewGuid();

        var scope = await sut.ResolveScopeAsync(AdministrationRequesterRole.SuperAdmin, userId);

        Assert.True(scope.IsGlobal);
        Assert.Null(scope.CondominiumId);
        Assert.Equal(userId, scope.AdminUserId);
        Assert.True(scope.CanAccess(Guid.NewGuid()));
    }

    [Fact]
    public async Task ResolveScopeAsync_AssignedCondominiumAdmin_ReturnsScopedToOwnCondominium()
    {
        var sut = CreateSut(out _);
        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        await sut.AssignAsync(AdministrationRequesterRole.SuperAdmin, userId, condominiumId);

        var scope = await sut.ResolveScopeAsync(AdministrationRequesterRole.CondominiumAdmin, userId);

        Assert.False(scope.IsGlobal);
        Assert.Equal(condominiumId, scope.CondominiumId);
        Assert.True(scope.CanAccess(condominiumId));
        Assert.False(scope.CanAccess(Guid.NewGuid()));
    }

    [Fact]
    public async Task ResolveScopeAsync_UnassignedCondominiumAdmin_ThrowsAdminNotAssignedToCondominium()
    {
        var sut = CreateSut(out _);

        await Assert.ThrowsAsync<AdminNotAssignedToCondominiumException>(
            () => sut.ResolveScopeAsync(AdministrationRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }

    [Theory]
    [InlineData(AdministrationRequesterRole.Resident)]
    [InlineData(AdministrationRequesterRole.Professional)]
    public async Task ResolveScopeAsync_NonAdminRole_ThrowsInsufficientPermissions(AdministrationRequesterRole role)
    {
        var sut = CreateSut(out _);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(
            () => sut.ResolveScopeAsync(role, Guid.NewGuid()));
    }

    [Fact]
    public async Task AssignAsync_NonSuperAdmin_ThrowsInsufficientPermissions()
    {
        var sut = CreateSut(out _);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(
            () => sut.AssignAsync(AdministrationRequesterRole.CondominiumAdmin, Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task AssignAsync_CalledTwiceForSameUser_ReplacesPreviousCondominium()
    {
        // Upsert (ver decisão de escopo em Domain.CondominiumAdministrator):
        // um único condomínio por administrador, a atribuição mais recente
        // sempre vale.
        var sut = CreateSut(out var repository);
        var userId = Guid.NewGuid();
        var firstCondominiumId = Guid.NewGuid();
        var secondCondominiumId = Guid.NewGuid();
        await sut.AssignAsync(AdministrationRequesterRole.SuperAdmin, userId, firstCondominiumId);

        var reassigned = await sut.AssignAsync(AdministrationRequesterRole.SuperAdmin, userId, secondCondominiumId);

        Assert.Equal(secondCondominiumId, reassigned.CondominiumId);
        var allAssignments = await repository.ListAsync();
        var onlyAssignment = Assert.Single(allAssignments);
        Assert.Equal(secondCondominiumId, onlyAssignment.CondominiumId);
    }

    [Fact]
    public async Task ListAssignmentsAsync_NonSuperAdmin_ThrowsInsufficientPermissions()
    {
        var sut = CreateSut(out _);

        await Assert.ThrowsAsync<InsufficientPermissionsException>(
            () => sut.ListAssignmentsAsync(AdministrationRequesterRole.CondominiumAdmin));
    }

    [Fact]
    public async Task ListAssignmentsAsync_SuperAdmin_ReturnsAllAssignments()
    {
        var sut = CreateSut(out _);
        await sut.AssignAsync(AdministrationRequesterRole.SuperAdmin, Guid.NewGuid(), Guid.NewGuid());
        await sut.AssignAsync(AdministrationRequesterRole.SuperAdmin, Guid.NewGuid(), Guid.NewGuid());

        var assignments = await sut.ListAssignmentsAsync(AdministrationRequesterRole.SuperAdmin);

        Assert.Equal(2, assignments.Count);
    }
}
