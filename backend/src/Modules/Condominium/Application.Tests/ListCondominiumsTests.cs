using Xunit;

namespace Alilu.Modules.Condominium.Application.Tests;

public sealed class ListCondominiumsTests
{
    [Fact]
    public async Task ListCondominiumsAsync_ReturnsAllRegisteredCondominiums()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();
        await fixture.RegisterCondominiumAsync(sut, name: "Monte Carlo", cnpj: "11222333000181");
        await fixture.RegisterCondominiumAsync(sut, name: "Jardins do Lago", cnpj: "12345678000195");

        var result = await sut.ListCondominiumsAsync(CondominiumRequesterRole.CondominiumAdmin);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task ListCondominiumsAsync_WithNonAdminRole_ThrowsInsufficientPermissionsException()
    {
        var fixture = new CondominiumServiceTestFixture();
        var sut = fixture.CreateSut();

        await Assert.ThrowsAsync<InsufficientPermissionsException>(() =>
            sut.ListCondominiumsAsync(CondominiumRequesterRole.Resident));
    }
}
