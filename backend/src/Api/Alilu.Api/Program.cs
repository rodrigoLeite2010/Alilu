using System.Text;
using System.Text.Json.Serialization;
using Alilu.Api.BackgroundServices;
using Alilu.Api.HealthChecks;
using Alilu.Api.Middleware;
using Alilu.Api.Services;
using Alilu.Infrastructure;
using Alilu.Modules.Administration.Infrastructure;
using Alilu.Modules.Condominium.Infrastructure;
using Alilu.Modules.Condominium.Infrastructure.Seed;
using Alilu.Modules.Identity.Infrastructure;
using Alilu.Modules.Identity.Infrastructure.Seed;
using Alilu.Modules.Notifications.Infrastructure;
using Alilu.Modules.Professional.Infrastructure;
using Alilu.Modules.Professional.Infrastructure.Seed;
using Alilu.Modules.Recommendations.Infrastructure;
using Alilu.Modules.Resident.Infrastructure;
using Alilu.Modules.Reviews.Infrastructure;
using Alilu.Modules.Scheduling.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Etapa 21 (foto pessoal) — cria a pasta ANTES de `builder.Build()` de
// propósito: `IWebHostEnvironment.WebRootFileProvider` (usado por
// `app.UseStaticFiles()` abaixo) é resolvido no momento do `Build()` a
// partir do que existe em disco naquele instante — se "wwwroot" não
// existisse ainda, o servidor de arquivos estáticos subiria apontando para
// um provider vazio e nunca serviria nada, mesmo que a pasta fosse criada
// depois (ver `Services/UserPhotoStorage`, que grava os arquivos ali).
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads", "user-photos"));

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

// Módulo Recommendations (PROMPT 10): indicações (Recommendation) de
// profissionais feitas por moradores — diferente de Review, pode se
// referir a um profissional nunca contratado pelo ALILU (indicação
// externa). Sem seed de desenvolvimento nesta etapa (nasce do fluxo real:
// o morador recomenda). As REGRAS CRÍTICAS que cruzam módulos (morador
// Active, "profissional já existe no ALILU") são aplicadas na Api — ver
// RecommendationsController.
builder.Services.AddRecommendationsModule(builder.Configuration);

// Módulo Notifications (PROMPT 11): notificações internas e Push
// Notifications (Expo). Nenhum módulo cria uma notificação sozinho — é a
// Api (composição raiz) quem chama INotificationDispatcher.NotifyAsync
// depois da ação principal de cada módulo (ver BookingsController/
// ProfessionalBookingsController/ReviewsController/
// AdminRecommendationsController/AdminMembershipsController) — mesmo
// papel de composição das etapas anteriores. O EVENTO "lembrete do
// serviço" é a exceção: não nasce de uma ação de usuário, por isso um
// processo de fundo próprio (ver abaixo, AddHostedService).
builder.Services.AddNotificationsModule(builder.Configuration);

// Módulo Administration (Etapa 12 — PROMPT 12): escopo de autorização do
// CondominiumAdmin (qual condomínio ele administra) + vínculo
// administrador↔condomínio (CondominiumAdministrator). Nenhum outro módulo
// referencia este (independência de módulos, PROMPT 01) — é a Api quem
// resolve o escopo (IAdminScopeService) e o repassa aos demais módulos via
// o parâmetro opcional `scopeCondominiumId` que cada um ganhou nesta etapa.
// Sem seed de desenvolvimento: o primeiro vínculo de um CondominiumAdmin a
// um condomínio precisa ser criado por um SuperAdmin (endpoint
// AdminCondominiumAdministratorsController, ver README do módulo).
builder.Services.AddAdministrationModule(builder.Configuration);

// Módulo Mural (Etapa 23, pedido 3 de Rodrigo): mural aberto do
// condomínio — reclamações, sugestões, avisos e comentários sobre
// prestador não cadastrado, publicados livremente por moradores
// (sem aprovação prévia) e moderados só DEPOIS pelo síndico/admin
// (bloquear). Sem seed de desenvolvimento: nasce do fluxo real (o
// morador publica). A REGRA CRÍTICA que cruza módulos (morador Active
// pode publicar) é aplicada na Api — ver MuralController.
builder.Services.AddMuralModule(builder.Configuration);

// CORS (Etapa 12 — PROMPT 12): "criar um painel web administrativo
// separado" introduz, pela primeira vez neste projeto, um cliente que roda
// em outra origem (o app mobile React Native não usa CORS — não é um
// browser). As origens permitidas vêm de configuração (nunca
// hard-coded em produção) — ver appsettings.Development.json para o valor
// de desenvolvimento (Vite, http://localhost:5173).
const string adminWebCorsPolicy = "AdminWebCorsPolicy";
var adminWebOrigins = builder.Configuration.GetSection("Cors:AdminWebOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy(adminWebCorsPolicy, policy =>
    {
        if (adminWebOrigins.Length > 0)
        {
            policy.WithOrigins(adminWebOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

builder.Services
    .AddControllers()
    // Enums (ex.: UserRole, UserStatus) trafegam como texto ("Resident"),
    // não como número — mais legível no JSON e evita o cliente (mobile)
    // depender da ordem numérica dos valores do enum no C#.
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var jwtSecret = builder.Configuration["Jwt:Secret"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

// Falha rápido na inicialização (Etapa 15) — antes desta checagem, uma
// 'Jwt:Secret' vazia só era detectada no primeiro login (ver
// JwtTokenGenerator.GenerateAccessToken), e a aplicação subia
// normalmente com uma chave de assinatura vazia (Encoding.UTF8.GetBytes(
// string.Empty)) até então. Preferível derrubar o processo aqui — em
// qualquer ambiente, nunca deixar 'Jwt:Secret' vazio é responsabilidade
// de quem sobe a aplicação (variável de ambiente, user-secrets ou
// gerenciador de segredos — nunca no código).
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException(
        "A configuração 'Jwt:Secret' não foi definida. Configure-a via variável de ambiente " +
        "(ex.: Jwt__Secret), user-secrets ou gerenciador de segredos antes de subir a aplicação — " +
        "nunca deixe este valor vazio ou hard-coded no código.");
}

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

// Health check (Etapa 15) — GET /health verifica de verdade a conexão com
// o PostgreSQL (DatabaseHealthCheck), em vez de só devolver "healthy"
// sempre. Não usa nenhum pacote NuGet adicional — o middleware de Health
// Checks já vem no shared framework do ASP.NET Core.
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

// EVENTO "lembrete do serviço" (PROMPT 11) — ver comentário de design em
// BookingReminderBackgroundService.
builder.Services.AddHostedService<BookingReminderBackgroundService>();

// Foto pessoal (Etapa 21) — ver Services/IUserPhotoStorage. Singleton:
// classe sem estado próprio (só resolve caminhos em disco a cada chamada),
// então não há necessidade de recriar por requisição.
builder.Services.AddSingleton<IUserPhotoStorage, UserPhotoStorage>();

var app = builder.Build();

// Traduz exceções de Application (ex.: InvalidCredentialsException) em
// respostas HTTP — precisa vir antes de autenticação/roteamento para
// capturar qualquer exceção do pipeline abaixo dele.
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Precisa vir antes de autenticação/autorização (mesma ordem recomendada
// pela documentação do ASP.NET Core) e só afeta o preflight/response
// headers dos endpoints acessados pelo admin-web — o app mobile não é
// afetado (requisições nativas não passam pelo CORS do browser).
app.UseCors(adminWebCorsPolicy);

// Foto pessoal (Etapa 21) — serve o conteúdo de "wwwroot" (só
// "uploads/user-photos" existe por enquanto) como arquivo estático, sem
// exigir autenticação: a mesma URL sai em `UserResponse.PhotoUrl`/
// `ProfessionalResponse.PhotoUrl` e precisa carregar direto num `<Image>`
// do app, tanto para o próprio usuário quanto para quem vê o diretório
// público de profissionais.
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Bootstrap do primeiro SuperAdmin (Etapa 16) — diferente dos seeds de
// Development abaixo, este roda em QUALQUER ambiente: é o único jeito de
// sair do zero em produção sem um UPDATE manual no banco. Só age de fato
// se 'Bootstrap:SuperAdminEmail'/'Bootstrap:SuperAdminPassword' estiverem
// configurados (vazios por padrão — ver appsettings); sem eles, é um
// no-op silencioso em todo ambiente. Idempotente (ver SuperAdminBootstrapper).
using (var bootstrapScope = app.Services.CreateScope())
{
    var superAdminBootstrapper = bootstrapScope.ServiceProvider.GetRequiredService<ISuperAdminBootstrapper>();
    await superAdminBootstrapper.BootstrapAsync();
}

// Seed de desenvolvimento (PROMPT 04): condomínio "Monte Carlo" + unidades
// fictícias. Só roda em Development — nunca em produção — e é idempotente
// (ver CondominiumSeeder), então rodar `dotnet run` várias vezes não
// duplica dados.
if (app.Environment.IsDevelopment())
{
    using var seedScope = app.Services.CreateScope();
    var condominiumSeeder = seedScope.ServiceProvider.GetRequiredService<ICondominiumSeeder>();
    await condominiumSeeder.SeedAsync();

    // Seed de desenvolvimento (Etapa 22): treze categorias de profissional
    // — SEMPRE antes do seed de especialidades logo abaixo, que resolve o
    // CategoryId de cada uma por nome (ver ProfessionalCategorySeeder).
    var professionalCategorySeeder = seedScope.ServiceProvider.GetRequiredService<IProfessionalCategorySeeder>();
    await professionalCategorySeeder.SeedAsync();

    // Seed de desenvolvimento (PROMPT 06: sete categorias iniciais de
    // serviço; Etapa 22: lista completa de especialidades de Rodrigo).
    // Também idempotente, sem perda de dado (ver ServiceCategorySeeder).
    var serviceCategorySeeder = seedScope.ServiceProvider.GetRequiredService<IServiceCategorySeeder>();
    await serviceCategorySeeder.SeedAsync();
}

// Endpoint de verificação de saúde da aplicação (Etapa 15), útil para
// orquestração (docker healthcheck, load balancer, rolling deploy).
// Verifica de verdade a conexão com o PostgreSQL (DatabaseHealthCheck) —
// antes desta etapa devolvia sempre "healthy", mesmo com o banco fora do
// ar. Não requer nenhum pacote NuGet adicional (ver HealthCheckJsonWriter
// para o formato de resposta).
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthCheckJsonWriter.WriteResponse,
});

app.MapGet("/", () => Results.Ok(new
{
    application = "ALILU API",
    status = "Identity (autenticação), Condominium (condomínios/unidades/convites), Resident (validação do morador), Professional (profissionais/diaristas, incluindo disponibilidade), Scheduling (agendamentos), Reviews (avaliações), Recommendations (indicações), Notifications (notificações internas e push) e Administration (painel administrativo por condomínio) implementados",
}));

app.Run();
