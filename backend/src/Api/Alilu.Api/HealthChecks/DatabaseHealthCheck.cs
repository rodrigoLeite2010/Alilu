using Alilu.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Alilu.Api.HealthChecks;

/// <summary>
/// Verificação de saúde do PostgreSQL (Etapa 15 — PROMPT 15) para
/// <c>GET /health</c>: tenta abrir uma conexão de verdade
/// (<see cref="Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade.CanConnectAsync"/>)
/// contra o mesmo <see cref="AliluDbContext"/> compartilhado usado pelos 9
/// módulos, sem executar nenhuma query de negócio. Não usa nenhum pacote
/// NuGet além do que a Api já referencia — <c>Microsoft.Extensions.Diagnostics.HealthChecks</c>
/// já vem no shared framework do ASP.NET Core (nenhuma dependência nova).
///
/// Antes desta correção, <c>GET /health</c> só devolvia
/// <c>{ "status": "healthy" }</c> sempre, mesmo com o banco fora do ar —
/// inútil para orquestração real (Docker healthcheck, load balancer,
/// rolling deploy) decidir se a instância está pronta para receber
/// tráfego.
/// </summary>
public sealed class DatabaseHealthCheck(AliluDbContext dbContext) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("Conexão com o PostgreSQL estabelecida com sucesso.")
                : HealthCheckResult.Unhealthy("Não foi possível conectar ao PostgreSQL.");
        }
        catch (Exception exception)
        {
            // Nunca deixa uma exceção de conexão (host indisponível,
            // credenciais erradas, etc.) derrubar o próprio endpoint de
            // health check — isso é exatamente o cenário que ele existe
            // para reportar como Unhealthy, não como erro 500.
            return HealthCheckResult.Unhealthy("Falha ao verificar a conexão com o PostgreSQL.", exception);
        }
    }
}
