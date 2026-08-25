using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Seed;

/// <summary>
/// Cria as sete categorias iniciais de serviço (PROMPT 06, "CATEGORIAS
/// INICIAIS": Diarista, Jardineiro, Piscineiro, Eletricista, Encanador,
/// Pedreiro, Pintor), só para ambiente de desenvolvimento. Escreve
/// diretamente no <see cref="AliluDbContext"/> (não passa pelos
/// repositórios/Application) porque é infraestrutura de bootstrap, não um
/// caso de uso de negócio — mesmo raciocínio de <c>CondominiumSeeder</c>.
///
/// Idempotente: cada categoria só é inserida se ainda não existir uma com
/// o mesmo nome (checagem individual, não "se existir qualquer uma, pula
/// tudo") — assim, mesmo que uma execução anterior tenha sido
/// interrompida no meio, rodar de novo completa o que faltar sem duplicar
/// o que já foi inserido.
/// </summary>
public sealed class ServiceCategorySeeder(AliluDbContext dbContext) : IServiceCategorySeeder
{
    private static readonly (string Name, string Description)[] InitialCategories =
    {
        ("Diarista", "Limpeza residencial avulsa ou periódica."),
        ("Jardineiro", "Manutenção de jardins e áreas verdes."),
        ("Piscineiro", "Limpeza e manutenção de piscinas."),
        ("Eletricista", "Instalações e reparos elétricos."),
        ("Encanador", "Instalações e reparos hidráulicos."),
        ("Pedreiro", "Serviços de alvenaria e reformas."),
        ("Pintor", "Pintura residencial e predial."),
    };

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var existingNames = await dbContext.Set<ServiceCategory>()
            .Select(c => c.Name)
            .ToListAsync(cancellationToken);

        var missing = InitialCategories.Where(c => !existingNames.Contains(c.Name)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        foreach (var (name, description) in missing)
        {
            var category = ServiceCategory.Create(name, description);
            await dbContext.Set<ServiceCategory>().AddAsync(category, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
