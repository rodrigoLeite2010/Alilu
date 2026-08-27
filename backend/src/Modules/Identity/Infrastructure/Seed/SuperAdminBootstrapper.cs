using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Alilu.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

// Alias explícito: este arquivo vive em Alilu.Modules.Identity.Infrastructure.Seed,
// irmão do namespace Alilu.Modules.Identity.Infrastructure.Email (a pasta do
// NoOpEmailSender). Em C#, a busca por um nome não qualificado prioriza
// namespaces/tipos declarados em namespaces ENGLOBANTES sobre tipos trazidos
// por `using` — então "Email" sem qualificação resolveria para aquele
// namespace irmão, não para a classe Domain.Email, e nem compila ("'Email' is
// a namespace but is used like a type"). O alias remove a ambiguidade.
using DomainEmail = Alilu.Modules.Identity.Domain.Email;

namespace Alilu.Modules.Identity.Infrastructure.Seed;

/// <summary>
/// Implementação de <see cref="ISuperAdminBootstrapper"/>.
///
/// Antes da Etapa 16, o único jeito de existir um usuário com papel
/// CondominiumAdmin/SuperAdmin era um UPDATE manual direto no banco —
/// <c>User.Register</c> (autocadastro público) rejeita explicitamente os
/// dois papéis administrativos, e não existe (nem deve existir) um
/// endpoint público de "criar admin". Este bootstrapper cobre só o
/// primeiro degrau: uma vez que exista ao menos um SuperAdmin, ele já
/// consegue promover outros administradores pela própria aplicação (ver
/// <c>AdminCondominiumAdministratorsController</c> para o vínculo
/// administrador↔condomínio — a promoção de papel em si de um usuário já
/// cadastrado continua sendo uma operação de banco, por não ter sido
/// pedida em nenhum PROMPT até agora).
///
/// Só age quando 'Bootstrap:SuperAdminEmail' e 'Bootstrap:SuperAdminPassword'
/// estiverem configurados — vazios por padrão em todo appsettings (mesma
/// filosofia de segredo-via-variável-de-ambiente de 'Jwt:Secret', nunca
/// hard-coded). Sem essas duas variáveis, este método não faz nada, em
/// nenhum ambiente — não é preciso "desligar" isto em produção.
///
/// Idempotente: só cria o usuário se ainda não existir um com este e-mail.
/// Se já existir um usuário com o e-mail configurado mas com outro papel,
/// NÃO promove silenciosamente (evitar escalar privilégio de uma conta por
/// engano) — só registra um aviso.
/// </summary>
public sealed class SuperAdminBootstrapper(
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IConfiguration configuration,
    ILogger<SuperAdminBootstrapper> logger) : ISuperAdminBootstrapper
{
    public async Task BootstrapAsync(CancellationToken cancellationToken = default)
    {
        var rawEmail = configuration["Bootstrap:SuperAdminEmail"];
        var password = configuration["Bootstrap:SuperAdminPassword"];

        if (string.IsNullOrWhiteSpace(rawEmail) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        DomainEmail email;
        try
        {
            email = DomainEmail.Create(rawEmail);
        }
        catch (DomainException ex)
        {
            logger.LogWarning(
                "Bootstrap do SuperAdmin ignorado: 'Bootstrap:SuperAdminEmail' inválido ({Message}).", ex.Message);
            return;
        }

        if (password.Length < 8)
        {
            logger.LogWarning(
                "Bootstrap do SuperAdmin ignorado: 'Bootstrap:SuperAdminPassword' precisa de pelo menos 8 caracteres.");
            return;
        }

        var existing = await userRepository.GetByEmailAsync(email.Value, cancellationToken);
        if (existing is not null)
        {
            if (existing.Role != UserRole.SuperAdmin)
            {
                logger.LogWarning(
                    "Bootstrap do SuperAdmin ignorado: já existe um usuário com o e-mail {Email}, mas com papel {Role} — " +
                    "promova manualmente (banco de dados) se isto for intencional.",
                    email.Value,
                    existing.Role);
            }

            return;
        }

        var name = configuration["Bootstrap:SuperAdminName"];
        var displayName = string.IsNullOrWhiteSpace(name) ? "SuperAdmin" : name;
        var passwordHash = passwordHasher.Hash(password);
        var user = User.CreateAdministrative(displayName, email, null, passwordHash, UserRole.SuperAdmin);

        await userRepository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        logger.LogInformation("SuperAdmin inicial criado ({Email}) a partir de 'Bootstrap:SuperAdminEmail'.", email.Value);
    }
}
