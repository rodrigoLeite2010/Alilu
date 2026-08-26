using Alilu.Shared;
using Xunit;

namespace Alilu.Modules.Recommendations.Application.Tests;

/// <summary>
/// Cobre <see cref="RecommendationService.RecommendAsync"/> — REGRAS do
/// PROMPT 10: indicação interna (vincula ProfessionalId) vs. externa
/// (armazena nome/telefone externos), Comment obrigatório e "não permitir
/// spam ilimitado". "Morador Active pode recomendar" e "se o profissional
/// já existir no ALILU, vincular ProfessionalId" são REGRAS CRÍTICAS
/// validadas pela Api (composição raiz) ANTES deste serviço ser chamado —
/// não são testadas aqui, pois este módulo recebe <c>condominiumId</c>/
/// <c>professionalId</c> já resolvidos/validados.
/// </summary>
public sealed class RecommendationCreationTests
{
    [Fact]
    public async Task RecommendAsync_LinkedToExistingProfessional_CreatesPendingRecommendation()
    {
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var professionalId = Guid.NewGuid();

        var recommendation = await sut.RecommendAsync(
            condominiumId: Guid.NewGuid(),
            recommendedByUserId: Guid.NewGuid(),
            professionalId: professionalId,
            externalProfessionalName: null,
            externalPhone: null,
            serviceCategoryId: Guid.NewGuid(),
            comment: "Ótimo eletricista, super pontual");

        Assert.Equal(professionalId, recommendation.ProfessionalId);
        Assert.Null(recommendation.ExternalProfessionalName);
        Assert.Equal(Domain.RecommendationStatus.Pending, recommendation.Status);
    }

    [Fact]
    public async Task RecommendAsync_ExternalProfessional_StoresExternalNameAndPhone()
    {
        // "Caso contrário: armazenar indicação externa" (REGRA).
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        var recommendation = await sut.RecommendAsync(
            condominiumId: Guid.NewGuid(),
            recommendedByUserId: Guid.NewGuid(),
            professionalId: null,
            externalProfessionalName: "João Pedreiro",
            externalPhone: "11999998888",
            serviceCategoryId: Guid.NewGuid(),
            comment: "Fez uma reforma excelente no meu apartamento");

        Assert.Null(recommendation.ProfessionalId);
        Assert.Equal("João Pedreiro", recommendation.ExternalProfessionalName);
        Assert.Equal("11999998888", recommendation.ExternalPhone);
    }

    [Fact]
    public async Task RecommendAsync_NeitherProfessionalIdNorExternalName_ThrowsDomainException()
    {
        // XOR: precisa indicar um profissional do ALILU OU um nome externo.
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() => sut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), null, null, null, Guid.NewGuid(), "Comentário válido"));
    }

    [Fact]
    public async Task RecommendAsync_BothProfessionalIdAndExternalName_ThrowsDomainException()
    {
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() => sut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Nome Externo", null, Guid.NewGuid(), "Comentário válido"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RecommendAsync_WithoutComment_ThrowsDomainException(string? emptyComment)
    {
        // Comment é obrigatório (diferente de Review.Comment, Etapa 09) —
        // decisão de escopo documentada em ARCHITECTURE.md, "Etapa 10".
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();

        await Assert.ThrowsAsync<DomainException>(() => sut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), emptyComment!));
    }

    [Fact]
    public async Task RecommendAsync_AtPendingCap_ThrowsTooManyPendingRecommendations()
    {
        // "Não permitir spam ilimitado" (REGRA) — teto de recomendações
        // Pending simultâneas por morador.
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var recommendedByUserId = Guid.NewGuid();

        for (var i = 0; i < RecommendationService.MaxPendingRecommendationsPerResident; i++)
        {
            await sut.RecommendAsync(
                Guid.NewGuid(), recommendedByUserId, Guid.NewGuid(), null, null, Guid.NewGuid(), $"Recomendação {i}");
        }

        await Assert.ThrowsAsync<TooManyPendingRecommendationsException>(() => sut.RecommendAsync(
            Guid.NewGuid(), recommendedByUserId, Guid.NewGuid(), null, null, Guid.NewGuid(), "Mais uma recomendação"));
    }

    [Fact]
    public async Task ListMyRecommendationsAsync_ReturnsOnlyOwnRecommendations()
    {
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var recommendedByUserId = Guid.NewGuid();
        await sut.RecommendAsync(Guid.NewGuid(), recommendedByUserId, Guid.NewGuid(), null, null, Guid.NewGuid(), "Minha recomendação");
        await sut.RecommendAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "De outro morador");

        var recommendations = await sut.ListMyRecommendationsAsync(recommendedByUserId);

        var recommendation = Assert.Single(recommendations);
        Assert.Equal("Minha recomendação", recommendation.Comment);
    }

    [Fact]
    public async Task GetMyRecommendationAsync_RecommendationOfAnotherResident_ThrowsRecommendationNotFound()
    {
        // Segunda camada de defesa: não vaza a recomendação de outro morador.
        var fixture = new RecommendationServiceTestFixture();
        var sut = fixture.CreateResidentSut();
        var recommendation = await sut.RecommendAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), "Comentário");

        await Assert.ThrowsAsync<RecommendationNotFoundException>(
            () => sut.GetMyRecommendationAsync(Guid.NewGuid(), recommendation.Id));
    }
}
