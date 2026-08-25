namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Base para erros de aplicação do módulo Professional que a Api traduz
/// para respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class ProfessionalApplicationException : Exception
{
    protected ProfessionalApplicationException(string message) : base(message)
    {
    }
}

public sealed class ProfessionalNotFoundException()
    : ProfessionalApplicationException("Perfil profissional não encontrado.");

/// <summary>Um mesmo usuário só pode ter um perfil profissional.</summary>
public sealed class ProfessionalAlreadyExistsException()
    : ProfessionalApplicationException("Você já possui um perfil profissional.");

public sealed class ServiceCategoryNotFoundException()
    : ProfessionalApplicationException("Categoria de serviço não encontrada.");

public sealed class ServiceCategoryInactiveException()
    : ProfessionalApplicationException("Esta categoria de serviço não está mais disponível.");

/// <summary>O profissional já tem um serviço ativo para esta categoria.</summary>
public sealed class DuplicateProfessionalServiceException()
    : ProfessionalApplicationException("Você já oferece um serviço nesta categoria.");

public sealed class ProfessionalServiceNotFoundException()
    : ProfessionalApplicationException("Serviço não encontrado.");

/// <summary>"Não permitir vínculo duplicado" — mesma regra de <c>DuplicateMembershipException</c> no módulo Resident, aplicada ao vínculo profissional↔condomínio.</summary>
public sealed class DuplicateProfessionalCondominiumException()
    : ProfessionalApplicationException("Você já tem um vínculo com este condomínio.");

public sealed class ProfessionalCondominiumNotFoundException()
    : ProfessionalApplicationException("Vínculo com o condomínio não encontrado.");

public sealed class ProfessionalCondominiumNotPendingException()
    : ProfessionalApplicationException("Esta solicitação não está mais pendente de aprovação.");

/// <summary>Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c> no controller) — mesma filosofia dos demais módulos, tipo próprio deste (nenhum módulo referencia outro).</summary>
public sealed class InsufficientPermissionsException()
    : ProfessionalApplicationException("Você não tem permissão para executar esta ação.");

// PROMPT 07 — disponibilidade.

public sealed class ProfessionalAvailabilityNotFoundException()
    : ProfessionalApplicationException("Intervalo de disponibilidade não encontrado.");

/// <summary>"Não permitir horários sobrepostos" (PROMPT 07) — aplicado tanto entre intervalos recorrentes do mesmo dia (<c>ProfessionalAvailability</c>) quanto entre exceções da mesma data (<c>ProfessionalAvailabilityException</c>).</summary>
public sealed class OverlappingAvailabilityException()
    : ProfessionalApplicationException("Este horário sobrepõe outro já cadastrado.");

public sealed class ProfessionalAvailabilityExceptionNotFoundException()
    : ProfessionalApplicationException("Exceção de disponibilidade não encontrada.");
