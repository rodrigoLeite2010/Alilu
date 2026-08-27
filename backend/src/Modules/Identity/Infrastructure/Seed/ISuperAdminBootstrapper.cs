namespace Alilu.Modules.Identity.Infrastructure.Seed;

/// <summary>
/// Provisiona o primeiro SuperAdmin da aplicação (Etapa 16), a partir de
/// configuração de servidor — nunca de uma requisição HTTP. Deve ser
/// chamado a partir de <c>Alilu.Api.Program</c> em QUALQUER ambiente
/// (diferente de <c>Condominium.Infrastructure.Seed.ICondominiumSeeder</c>/
/// <c>Professional.Infrastructure.Seed.IServiceCategorySeeder</c>, que só
/// rodam em Development) — é o único jeito de sair do zero em produção sem
/// manipular o banco diretamente.
/// </summary>
public interface ISuperAdminBootstrapper
{
    Task BootstrapAsync(CancellationToken cancellationToken = default);
}
