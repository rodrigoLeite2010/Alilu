using Xunit;

namespace Alilu.Modules.Mural.Application.Tests;

/// <summary>
/// Cobre <see cref="MuralAdministrationService"/> — moderação
/// ("síndico/admin pode bloquear/remover um post depois", decisão de
/// Rodrigo) e escopo administrativo (Etapa 12: "CondominiumAdmin somente
/// pode administrar seu próprio condomínio"), mesmo espírito de
/// <c>AdminScopingTests</c> no módulo Recommendations.
/// </summary>
public sealed class MuralAdministrationServiceTests
{
    [Fact]
    public async Task BlockAsync_VisiblePost_BlocksIt()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var post = await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Domain.MuralPostType.Complaint, "Texto qualquer");

        var blocked = await adminSut.BlockAsync(MuralRequesterRole.SuperAdmin, Guid.NewGuid(), post.Id);

        Assert.Equal(Domain.MuralPostStatus.Blocked, blocked.Status);
        Assert.NotNull(blocked.BlockedAt);
        Assert.NotNull(blocked.BlockedBy);
    }

    [Fact]
    public async Task BlockAsync_AlreadyBlockedPost_ThrowsMuralPostAlreadyBlockedException()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var post = await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Domain.MuralPostType.Complaint, "Texto qualquer");
        await adminSut.BlockAsync(MuralRequesterRole.SuperAdmin, Guid.NewGuid(), post.Id);

        await Assert.ThrowsAsync<MuralPostAlreadyBlockedException>(() =>
            adminSut.BlockAsync(MuralRequesterRole.SuperAdmin, Guid.NewGuid(), post.Id));
    }

    [Fact]
    public async Task BlockAsync_RequesterIsResident_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var post = await residentSut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), Domain.MuralPostType.Complaint, "Texto qualquer");

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(MuralRequesterRole.Resident, Guid.NewGuid(), post.Id));
    }

    [Fact]
    public async Task BlockAsync_ForPostOutsideScope_ThrowsInsufficientPermissionsException()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var otherCondominiumId = Guid.NewGuid();
        var post = await residentSut.CreateAsync(otherCondominiumId, Guid.NewGuid(), Domain.MuralPostType.Complaint, "Texto qualquer");
        var ownCondominiumId = Guid.NewGuid();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            adminSut.BlockAsync(MuralRequesterRole.CondominiumAdmin, Guid.NewGuid(), post.Id, scopeCondominiumId: ownCondominiumId));
    }

    [Fact]
    public async Task ListByCondominiumAsync_ScopedToOwnCondominium_ReturnsOnlyThatCondominiumsPosts()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var condominiumA = Guid.NewGuid();
        var condominiumB = Guid.NewGuid();
        await residentSut.CreateAsync(condominiumA, Guid.NewGuid(), Domain.MuralPostType.Complaint, "Post A");
        await residentSut.CreateAsync(condominiumB, Guid.NewGuid(), Domain.MuralPostType.Suggestion, "Post B");

        var scoped = await adminSut.ListByCondominiumAsync(MuralRequesterRole.CondominiumAdmin, condominiumA, scopeCondominiumId: condominiumA);

        var only = Assert.Single(scoped);
        Assert.Equal(condominiumA, only.CondominiumId);
    }
}
