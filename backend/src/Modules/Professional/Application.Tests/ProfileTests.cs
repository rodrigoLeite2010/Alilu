using Xunit;

namespace Alilu.Modules.Professional.Application.Tests;

/// <summary>Cobre criação/consulta/edição do perfil profissional (<see cref="IProfessionalProfileService"/>).</summary>
public sealed class ProfileTests
{
    [Fact]
    public async Task GetMyProfileAsync_WhenNoProfileExists_ReturnsNull()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();

        var profile = await sut.GetMyProfileAsync(Guid.NewGuid());

        Assert.Null(profile);
    }

    [Fact]
    public async Task CreateProfileAsync_CreatesAnActiveProfile()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();

        var profile = await sut.CreateProfileAsync(userId, "Maria Diarista", "Atendo de segunda a sexta.", "11999990000", null);

        Assert.Equal(userId, profile.UserId);
        Assert.Equal("Maria Diarista", profile.DisplayName);
        Assert.Equal(Domain.ProfessionalStatus.Active, profile.Status);
    }

    [Fact]
    public async Task CreateProfileAsync_WhenUserAlreadyHasAProfile_ThrowsProfessionalAlreadyExistsException()
    {
        // "Professional NÃO é automaticamente morador" não impede que um
        // mesmo usuário tenha os dois papéis, mas um usuário só pode ter
        // UM perfil profissional (PROMPT 06).
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);

        await Assert.ThrowsAsync<ProfessionalAlreadyExistsException>(() =>
            sut.CreateProfileAsync(userId, "Maria Diarista 2", null, null, null));
    }

    [Fact]
    public async Task UpdateMyProfileAsync_UpdatesTheFields()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();
        var userId = Guid.NewGuid();
        await sut.CreateProfileAsync(userId, "Maria Diarista", null, null, null);

        var updated = await sut.UpdateMyProfileAsync(userId, "Maria D. Silva", "Atualizado", "11888887777", "https://x/photo.png");

        Assert.Equal("Maria D. Silva", updated.DisplayName);
        Assert.Equal("Atualizado", updated.Description);
        Assert.Equal("11888887777", updated.Phone);
    }

    [Fact]
    public async Task UpdateMyProfileAsync_WhenNoProfileExists_ThrowsProfessionalNotFoundException()
    {
        var fixture = new ProfessionalServiceTestFixture();
        var sut = fixture.CreateProfileSut();

        await Assert.ThrowsAsync<ProfessionalNotFoundException>(() =>
            sut.UpdateMyProfileAsync(Guid.NewGuid(), "Novo Nome", null, null, null));
    }
}
