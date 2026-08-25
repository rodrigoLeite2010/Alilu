namespace Alilu.Modules.Condominium.Infrastructure.Seed;

/// <summary>
/// Popula dados iniciais de desenvolvimento (PROMPT 04). Só deve ser
/// chamado a partir de <c>Alilu.Api.Program</c> quando
/// <c>app.Environment.IsDevelopment()</c> — nunca em produção.
/// </summary>
public interface ICondominiumSeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}
