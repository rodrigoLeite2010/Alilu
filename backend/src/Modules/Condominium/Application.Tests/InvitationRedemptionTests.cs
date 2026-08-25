using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>
/// Cobre <see cref="IInvitationRedemptionService"/> (PROMPT 05, FLUXO 1)
/// — os cenários "convite válido", "convite expirado", "convite já
/// usado" e "convite para outra unidade" pedidos explicitamente pelo
/// prompt.
/// </summary>
public sealed class InvitationRedemptionTests
{
    [Fact]
    public async Task ValidateInvitationAsync_WithValidCode_ReturnsInvitationsOwnCondominiumAndUnit()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "morador@example.com", null));

        var result = await redemptionSut.ValidateInvitationAsync(invitation.Code, email: null);

        Assert.Equal(invitation.Id, result.InvitationId);
        Assert.Equal(condominium.Id, result.CondominiumId);
        Assert.Equal(unit.Id, result.UnitId);
        Assert.Equal("morador@example.com", result.Email);
    }

    [Fact]
    public async Task ValidateInvitationAsync_WithMatchingEmail_Succeeds()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "Morador@Example.com", null));

        // Comparação sem diferenciar maiúsculas/minúsculas (mesmo padrão de Email.cs no módulo Identity).
        var result = await redemptionSut.ValidateInvitationAsync(invitation.Code, "morador@example.com");

        Assert.Equal(invitation.Id, result.InvitationId);
    }

    [Fact]
    public async Task ValidateInvitationAsync_WithMismatchedEmail_ThrowsInvitationEmailMismatchException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "morador@example.com", null));

        await Assert.ThrowsAsync<InvitationEmailMismatchException>(() =>
            redemptionSut.ValidateInvitationAsync(invitation.Code, "outra-pessoa@example.com"));
    }

    [Fact]
    public async Task ValidateInvitationAsync_WithNonexistentCode_ThrowsInvitationNotFoundException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        await Assert.ThrowsAsync<InvitationNotFoundException>(() =>
            redemptionSut.ValidateInvitationAsync("CODIGOINEXISTENTE", email: null));
    }

    [Fact]
    public async Task ValidateInvitationAsync_WithExpiredInvitation_ThrowsInvitationExpiredException()
    {
        // Mesma técnica de RefreshTests.cs no módulo Identity: validade de
        // 100ms + um pequeno delay, para testar expiração sem precisar de
        // um relógio injetável. ExpirationDays<=0 cai no padrão (7 dias)
        // dentro de CondominiumService.CreateInvitationAsync, então, para
        // um prazo tão curto, criamos o convite diretamente via Domain,
        // sem passar por ele.
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);

        var (rawCode, codeHash) = fixture.InvitationCodeGenerator.Generate();
        var invitation = Domain.CondominiumInvitation.Create(
            condominium.Id, unit.Id, "morador@example.com", codeHash, DateTime.UtcNow.AddMilliseconds(100));
        await fixture.InvitationRepository.AddAsync(invitation);

        await Task.Delay(250);

        await Assert.ThrowsAsync<InvitationExpiredException>(() =>
            redemptionSut.ValidateInvitationAsync(rawCode, email: null));
    }

    [Fact]
    public async Task ValidateInvitationAsync_AfterMarkedAsUsed_ThrowsInvitationAlreadyUsedException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "morador@example.com", null));

        // Simula o passo 8 do FLUXO 1 (marcar como usado) já ter acontecido.
        await redemptionSut.MarkInvitationAsUsedAsync(invitation.Id);

        await Assert.ThrowsAsync<InvitationAlreadyUsedException>(() =>
            redemptionSut.ValidateInvitationAsync(invitation.Code, email: null));
    }

    [Fact]
    public async Task ValidateInvitationAsync_NeverAcceptsCondominiumOrUnitFromTheCaller_OnlyFromTheInvitationItself()
    {
        // "Convite para outra unidade" (PROMPT 05): a assinatura de
        // ValidateInvitationAsync não tem NENHUM parâmetro de
        // condomínio/unidade — só o código. Este teste prova que, mesmo
        // existindo duas unidades diferentes, o resultado sempre traz a
        // unidade REAL do convite (a que o admin escolheu ao criá-lo),
        // nunca outra — segurança por construção, não por checagem.
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unitA = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "101");
        var unitB = await fixture.RegisterUnitAsync(sut, condominium.Id, code: "102");

        var invitationForUnitB = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unitB.Id, "morador@example.com", null));

        var result = await redemptionSut.ValidateInvitationAsync(invitationForUnitB.Code, email: null);

        Assert.Equal(unitB.Id, result.UnitId);
        Assert.NotEqual(unitA.Id, result.UnitId);
    }

    [Fact]
    public async Task MarkInvitationAsUsedAsync_IsOnlyEffectAfterCalled_ValidateAloneDoesNotConsumeTheInvitation()
    {
        // Padrão de duas fases: validar (só leitura) não "queima" o
        // convite — só MarkInvitationAsUsedAsync faz isso. Prova que
        // chamar ValidateInvitationAsync várias vezes (ex.: o usuário
        // digita o código, o app valida antes de confirmar) não invalida
        // o convite sozinho.
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        var redemptionSut = fixture.CreateInvitationRedemptionSut();

        var condominium = await fixture.RegisterCondominiumAsync(sut);
        var unit = await fixture.RegisterUnitAsync(sut, condominium.Id);
        var invitation = await sut.CreateInvitationAsync(
            CondominiumRequesterRole.CondominiumAdmin,
            new CreateInvitationRequest(condominium.Id, unit.Id, "morador@example.com", null));

        await redemptionSut.ValidateInvitationAsync(invitation.Code, email: null);
        await redemptionSut.ValidateInvitationAsync(invitation.Code, email: null);

        var stillValid = await redemptionSut.ValidateInvitationAsync(invitation.Code, email: null);
        Assert.Equal(invitation.Id, stillValid.InvitationId);
    }
}
