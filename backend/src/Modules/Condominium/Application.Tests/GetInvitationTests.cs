using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class GetInvitationTests
{
    [Fact]
    public async Task GetInvitationAsync_WithFreshInvitation_ReturnsPendingStatus()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var created = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));

        var result = await sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, created.Id);

        Assert.Equal(InvitationStatus.Pending, result.Status);
        Assert.Null(result.UsedAt);
    }

    [Fact]
    public async Task GetInvitationAsync_WithUnknownId_ThrowsCondominiumInvitationNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<CondominiumInvitationNotFoundException>(() =>
            sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, Guid.NewGuid()));
    }

    [Fact]
    public async Task GetInvitationAsync_WithExpiredInvitation_ReturnsExpiredStatus()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        // Convite com validade de fração de segundo — mesma técnica usada
        // em RefreshTests (módulo Identity) para testar expiração sem
        // precisar de um relógio injetável.
        var created = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", ExpirationDays: null));

        // Não dá para pedir 0 dias de validade (o domínio exige expiração
        // no futuro) — em vez disso, cria diretamente a entidade expirada
        // para simular o estado, e substitui no repositório fake.
        var invitation = Domain.CondominiumInvitation.Create(
            condominium.Id,
            unit.Id,
            "convidado@example.com",
            fixture.InvitationCodeGenerator.Hash("QUALQUERCODIGO"),
            DateTime.UtcNow.AddMilliseconds(100));
        await fixture.InvitationRepository.AddAsync(invitation);

        await Task.Delay(250);

        var result = await sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, invitation.Id);

        Assert.Equal(InvitationStatus.Expired, result.Status);

        // O convite original (não expirado) continua Pending — confirma
        // que os dois convites são independentes.
        var stillPending = await sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, created.Id);
        Assert.Equal(InvitationStatus.Pending, stillPending.Status);
    }

    [Fact]
    public async Task GetInvitationAsync_WithUsedInvitation_ReturnsUsedStatus()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var created = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));

        // Nesta etapa (PROMPT 04) não existe endpoint de "resgatar convite"
        // — isso pertence ao módulo Resident, futuro. Simula aqui o que
        // esse fluxo futuro fará: marcar a entidade como utilizada
        // diretamente (MarkAsUsed é a API de domínio para isso).
        var storedInvitation = await fixture.InvitationRepository.GetByIdAsync(created.Id);
        storedInvitation!.MarkAsUsed();

        var result = await sut.GetInvitationAsync(CondominiumRequesterRole.CondominiumAdmin, created.Id);

        Assert.Equal(InvitationStatus.Used, result.Status);
        Assert.NotNull(result.UsedAt);
    }

    [Fact]
    public async Task MarkAsUsed_CalledTwice_ThrowsDomainException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var created = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "convidado@example.com", null));
        var storedInvitation = await fixture.InvitationRepository.GetByIdAsync(created.Id);
        storedInvitation!.MarkAsUsed();

        Assert.Throws<Alilu.Shared.DomainException>(() => storedInvitation.MarkAsUsed());
    }

    [Fact]
    public async Task GetInvitationAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.GetInvitationAsync(CondominiumRequesterRole.Resident, Guid.NewGuid()));
    }
}
