using Alilu.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Infraestrutura (persistência, etc.). Cada módulo de negócio irá registrar
// seus próprios serviços aqui nas próximas etapas (ex.: AddIdentityModule()).
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// Endpoint de verificação de saúde da aplicação, útil para orquestração
// (docker, load balancer, etc.). Não requer nenhum pacote NuGet adicional.
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/", () => Results.Ok(new
{
    application = "ALILU API",
    status = "fundação em construção",
}));

app.Run();
