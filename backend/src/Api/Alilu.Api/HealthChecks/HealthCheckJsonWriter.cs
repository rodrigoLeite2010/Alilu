using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Alilu.Api.HealthChecks;

/// <summary>
/// Corpo JSON de <c>GET /health</c> (Etapa 15) — o formato padrão do
/// middleware de Health Checks do ASP.NET Core é texto puro
/// ("Healthy"/"Unhealthy"), então este <c>ResponseWriter</c> substitui só
/// a serialização, mantendo o mesmo formato de resposta
/// (<c>application/json</c>) que o resto desta Api já usa em todo lugar.
/// </summary>
public static class HealthCheckJsonWriter
{
    private static readonly JsonSerializerOptions SerializerOptions = new() { WriteIndented = false };

    public static Task WriteResponse(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var payload = new
        {
            status = report.Status.ToString(),
            durationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description,
                durationMs = entry.Value.Duration.TotalMilliseconds,
            }),
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, SerializerOptions));
    }
}
