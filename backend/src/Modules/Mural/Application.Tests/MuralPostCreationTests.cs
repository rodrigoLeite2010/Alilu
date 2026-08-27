using Alilu.Modules.Mural.Domain;
using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Mural.Application.Tests;

/// <summary>
/// Cobre <see cref="MuralService.CreateAsync"/>/<see cref="MuralService.ListForResidentFeedAsync"/>
/// — Etapa 23, pedido 3: post nasce Visible (sem aprovação prévia), texto
/// obrigatório e limitado, e o feed do morador mostra os posts visíveis do
/// condomínio MAIS os próprios (mesmo bloqueados). "Morador Active pode
/// publicar" é REGRA CRÍTICA validada pela Api (composição raiz) ANTES
/// deste serviço ser chamado — não é testada aqui, pois este módulo
/// recebe <c>condominiumId</c> já resolvido/validado.
/// </summary>
public sealed class MuralPostCreationTests
{
    [Fact]
    public async Task CreateAsync_ValidContent_CreatesVisiblePost()
    {
        var fixture = new MuralServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        var post = await sut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), MuralPostType.Complaint, "O elevador social está quebrado há 3 dias.");

        Assert.Equal(MuralPostStatus.Visible, post.Status);
        Assert.Equal(MuralPostType.Complaint, post.Type);
    }

    [Fact]
    public async Task CreateAsync_BlankContent_ThrowsDomainException()
    {
        var fixture = new MuralServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), MuralPostType.Suggestion, "   "));
    }

    [Fact]
    public async Task CreateAsync_ContentTooLong_ThrowsDomainException()
    {
        var fixture = new MuralServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var tooLong = new string('a', MuralPost.MaxContentLength + 1);

        await Assert.ThrowsAsync<DomainException>(() =>
            sut.CreateAsync(Guid.NewGuid(), Guid.NewGuid(), MuralPostType.Warning, tooLong));
    }

    [Fact]
    public async Task ListForResidentFeedAsync_IncludesOwnBlockedPost_ButNotOthersBlockedPost()
    {
        var fixture = new MuralServiceTestFixture();
        var residentSut = fixture.CreateResidentSut();
        var adminSut = fixture.CreateAdminSut();
        var condominiumId = Guid.NewGuid();
        var authorA = Guid.NewGuid();
        var authorB = Guid.NewGuid();

        var postA = await residentSut.CreateAsync(condominiumId, authorA, MuralPostType.Complaint, "Post do morador A");
        var postB = await residentSut.CreateAsync(condominiumId, authorB, MuralPostType.Warning, "Post do morador B");

        await adminSut.BlockAsync(MuralRequesterRole.SuperAdmin, Guid.NewGuid(), postA.Id);
        await adminSut.BlockAsync(MuralRequesterRole.SuperAdmin, Guid.NewGuid(), postB.Id);

        var feedForAuthorA = await residentSut.ListForResidentFeedAsync(condominiumId, authorA);

        var only = Assert.Single(feedForAuthorA);
        Assert.Equal(postA.Id, only.Id);
    }
}
