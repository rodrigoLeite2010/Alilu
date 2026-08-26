using System.Text;
using System.Text.Json.Serialization;
using Alilu.Api.Middleware;
using Alilu.Infrastructure;
using Alilu.Modules.Condominium.Infrastructure;
using Alilu.Modules.Condominium.Infrastructure.Seed;
using Alilu.Modules.Identity.Infrastructure;
using Alilu.Modules.Professional.Infrastructure;
using Alilu.Modules.Professional.Infrastructure.Seed;
using Alilu.Modules.Resident.Infrastructure;
using Alilu.Modules.Reviews.Infrastructure;
using Alilu.Modules.Scheduling.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Infraestrutura (persistência, etc.).
builder.Services.AddInfrastructure(builder.Configuration);

// Módulo Identity (PROMPT 03): repositórios, hashing, JWT, e-mail (no-op) e
// o próprio IAuthService.
builder.Services.AddIdentityModule(builder.Configuration);

// Módulo Condominium (PROMPT 04): repositórios, gerador de código de
// convite, seeder de desenvolvimento e o próprio ICondominiumService.
// Também expõe, desde o PROMPT 05, IInvitationRedemptionService e
// ICondominiumDirectoryService (usados pela Api para orquestrar o módulo
// Resident abaixo).
builder.Services.AddCondominiumModule(builder.Configuration);

// Módulo Resident (PROMPT 05): validação do morador — vínculo
// morador↔condomínio↔unidade (CondominiumMembership). Sem seed de
// desenvolvimento nesta etapa (o vínculo nasce do fluxo real: resgatar um
// convite ou solicitar acesso).
builder.Services.AddResidentModule(builder.Configuration);

// Módulo Professional (PROMPT 06): profissionais/diaristas — perfil,
// categorias de serviço e vínculo profissional↔condomínio
// (ProfessionalCondominium). Com seed de desenvolvimento das sete
// categorias iniciais (ver ServiceCategorySeeder) — nenhum profissional/
// usuário fictício é criado, mesma honestidade de escopo do CondominiumSeeder.
builder.Services.AddProfessionalModule(builder.Configuration);

// Módulo Scheduling (PROMPT 08 — "o módulo mais crítico"): agendamentos
// (Booking/BookingItem) entre morador e profissional. Sem seed de
// desenvolvimento nesta etapa (nasce do fluxo real: o morador cria a
// solicitação). As REGRAS CRÍTICAS que cruzam módulos (Membership Active,
// profissional atende o condomínio, horário disponível) são aplicadas na
// Api — ver BookingsController.
builder.Services.AddSchedulingModule(builder.Configuration);

// Módulo Reviews (PROMPT 09): avaliações (Review) do morador sobre o
// profissional, referentes a um agendamento concluído. Sem seed de
// desenvolvimento nesta etapa (nasce do fluxo real: o morador avalia um
// Booking Completed). As REGRAS CRÍTICAS que cruzam módulos (Booking
// Completed, autoria) são aplicadas na Api — ver ReviewsController.
builder.Services.AddReviewsModule(builder.Configuration);

builder.Services
    .AddControllers()
    // Enums (ex.: UserRole, UserStatus) trafegam como texto ("Resident"),
    // não como número — mais legível no JSON e evita o cliente (mobile)
    // depender da ordem numérica dos valores do enum no C#.
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var jwtSecret = builder.Configuration["Jwt:Secret"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret ?? string.Empty)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Traduz exceções de Application (ex.: InvalidCredentialsException) em
// respostas HTTP — precisa vir antes de autenticação/roteamento para
// capturar qualquer exceção do pipeline abaixo dele.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Seed de desenvolvimento (PROMPT 04): condomínio "Monte Carlo" + unidades
// fictícias. Só roda em Development — nunca em produção — e é idempotente
// (ver CondominiumSeeder), então rodar `dotnet run` várias vezes não
// duplica dados.
if (app.Environment.IsDevelopment())
{
    using var seedScope = app.Services.CreateScope();
    var condominiumSeeder = seedScope.ServiceProvider.GetRequiredService<ICondominiumSeeder>();
    await condominiumSeeder.SeedAsync();

    // Seed de desenvolvimento (PROMPT 06): sete categorias iniciais de
    // serviço. Também idempotente (ver ServiceCategorySeeder).
    var serviceCategorySeeder = seedScope.ServiceProvider.GetRequiredService<IServiceCategorySeeder>();
    await serviceCategorySeeder.SeedAsync();
}

// Endpoint de verificação de saúde da aplicação, útil para orquestração
// (docker, load balancer, etc.). Não requer nenhum pacote NuGet adicional.
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/", () => Results.Ok(new
{
    application = "ALILU API",
    status = "Identity (autenticação), Condominium (condomínios/unidades/convites), Resident (validação do morador), Professional (profissionais/diaristas, incluindo disponibilidade), Scheduling (agendamentos) e Reviews (avaliações) implementados",
}));

app.Run();
