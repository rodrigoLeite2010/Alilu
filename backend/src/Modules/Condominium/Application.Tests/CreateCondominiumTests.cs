using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class CreateCondominiumTests
{
    [Fact]
    public async Task CreateCondominiumAsync_WithValidData_CreatesCondominium()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        var result = await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");

        Assert.Equal("Monte Carlo", result.Name);
        Assert.Equal("11222333000181", result.Cnpj);
        Assert.Equal(Domain.CondominiumStatus.Active, result.Status);
        Assert.Single(fixture.CondominiumRepository.Condominiums);
    }

    [Fact]
    public async Task CreateCondominiumAsync_NormalizesCnpjPunctuation()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        var result = await fixture.RegisterCondominiumAsync(sut, cnpj: "11.222.333/0001-81");

        Assert.Equal("11222333000181", result.Cnpj);
    }

    [Fact]
    public async Task CreateCondominiumAsync_WithDuplicateCnpj_ThrowsCnpjAlreadyInUseException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");

        await Assert.ThrowsAsync<CnpjAlreadyInUseException>(() =>
            fixture.RegisterCondominiumAsync(sut, name: "Outro Condomínio", cnpj: "11222333000181"));
    }

    [Fact]
    public async Task CreateCondominiumAsync_WithInvalidCnpj_ThrowsDomainException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<Alilu.Shared.DomainException>(() =>
            fixture.RegisterCondominiumAsync(sut, cnpj: "12345678901234"));
    }

    [Theory]
    [InlineData(CondominiumRequesterRole.Resident)]
    [InlineData(CondominiumRequesterRole.Professional)]
    public async Task CreateCondominiumAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException(
        CondominiumRequesterRole nonAdminRole)
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            fixture.RegisterCondominiumAsync(sut, requesterRole: nonAdminRole));
    }
}
