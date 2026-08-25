using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Condominium.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Condominium.Infrastructure.Seed;

/// <summary>
/// Cria o condomínio de validação "Monte Carlo" (PROMPT 04) e algumas
/// unidades fictícias, só para ambiente de desenvolvimento. Escreve
/// diretamente no <see cref="AliluDbContext"/> (não passa pelos
/// repositórios/Application) porque é infraestrutura de bootstrap, não um
/// caso de uso de negócio.
///
/// Idempotente: verifica se o CNPJ de seed já existe antes de inserir, para
/// não duplicar dados a cada `dotnet run` local.
///
/// Não cria nenhum morador/usuário — "Não inserir dados reais de
/// moradores" (PROMPT 04). O vínculo morador↔unidade pertence ao módulo
/// Resident, ainda não implementado.
/// </summary>
public sealed class CondominiumSeeder(AliluDbContext dbContext) : ICondominiumSeeder
{
    // CNPJ fictício, mas com dígitos verificadores válidos (algoritmo real)
    // — o mesmo valor de referência amplamente usado em exemplos/testes,
    // não pertence a nenhuma empresa real.
    private const string SeedCnpj = "11222333000181";

    private static readonly (string Code, UnitType Type)[] SeedUnits =
    {
        ("101", UnitType.Apartment),
        ("102", UnitType.Apartment),
        ("201", UnitType.Apartment),
        ("202", UnitType.Apartment),
        ("Casa 01", UnitType.House),
        ("Salão de Festas", UnitType.Commercial),
    };

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var alreadySeeded = await dbContext.Set<Domain.Condominium>()
            .AnyAsync(c => c.Cnpj.Value == SeedCnpj, cancellationToken);

        if (alreadySeeded)
        {
            return;
        }

        var monteCarlo = Domain.Condominium.Register(
            name: "Monte Carlo",
            cnpj: Cnpj.Create(SeedCnpj),
            address: "Rua das Palmeiras",
            number: "500",
            neighborhood: "Jardim das Flores",
            city: "São Paulo",
            state: "SP",
            zipCode: "01234000");

        await dbContext.Set<Domain.Condominium>().AddAsync(monteCarlo, cancellationToken);

        foreach (var (code, type) in SeedUnits)
        {
            var unit = CondominiumUnit.Register(monteCarlo.Id, code, type);
            await dbContext.Set<CondominiumUnit>().AddAsync(unit, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
