namespace Alilu.Modules.Professional.Infrastructure.Seed;

/// <summary>
/// Popula as categorias iniciais de serviço (PROMPT 06). Só deve ser
/// chamado a partir de <c>Alilu.Api.Program</c> quando
/// <c>app.Environment.IsDevelopment()</c> — nunca em produção (mesmo
/// padrão de <c>Alilu.Modules.Condominium.Infrastructure.Seed.ICondominiumSeeder</c>).
/// </summary>
public interface IServiceCategorySeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}
