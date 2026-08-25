using Xunit;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// Cobre <see cref="MembershipService.ValidateActiveMembershipAsync"/>
/// (PROMPT 08) — "só morador com Membership Active pode criar Booking" +
/// "morador só pode agendar para a própria Unit" (REGRAS CRÍTICAS),
/// consumida pela Api na composição de <c>BookingsController.Create</c>.
/// </summary>
public sealed class ActiveMembershipValidationTests
{
    [Fact]
    public async Task ValidateActiveMembershipAsync_WithMatchingActiveMembership_DoesNotThrow()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, unitId);

        await sut.ValidateActiveMembershipAsync(userId, condominiumId, unitId);
    }

    [Fact]
    public async Task ValidateActiveMembershipAsync_WithNoMembershipAtAll_Throws()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<NoActiveMembershipException>(
            () => sut.ValidateActiveMembershipAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task ValidateActiveMembershipAsync_WithOnlyAPendingMembership_Throws()
    {
        // "Não encontrei minha unidade" (FLUXO 2) ainda não aprovado — Pending não autoriza agendar.
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        await sut.RequestResidentAccessAsync(userId, condominiumId, unitId);

        await Assert.ThrowsAsync<NoActiveMembershipException>(
            () => sut.ValidateActiveMembershipAsync(userId, condominiumId, unitId));
    }

    [Fact]
    public async Task ValidateActiveMembershipAsync_ActiveInADifferentCondominium_Throws()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var userId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        await sut.CreateMembershipFromInvitationAsync(userId, Guid.NewGuid(), unitId);

        // "Wrong condominium" — mesmo usuário/unidade, condomínio diferente do vínculo Active.
        await Assert.ThrowsAsync<NoActiveMembershipException>(
            () => sut.ValidateActiveMembershipAsync(userId, Guid.NewGuid(), unitId));
    }

    [Fact]
    public async Task ValidateActiveMembershipAsync_ActiveInADifferentUnit_Throws()
    {
        var fixture = new MembershipServiceTestFixture();
        var sut = fixture.CreateSut();
        var userId = Guid.NewGuid();
        var condominiumId = Guid.NewGuid();
        await sut.CreateMembershipFromInvitationAsync(userId, condominiumId, Guid.NewGuid());

        // "Wrong unit" — mesmo usuário/condomínio, unidade diferente do vínculo Active ("morador só pode agendar para a própria Unit").
        await Assert.ThrowsAsync<NoActiveMembershipException>(
            () => sut.ValidateActiveMembershipAsync(userId, condominiumId, Guid.NewGuid()));
    }
}
