namespace Alilu.Modules.Scheduling.Application;

/// <summary>
/// Base para erros de aplicação do módulo Scheduling que a Api traduz para
/// respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class SchedulingApplicationException : Exception
{
    protected SchedulingApplicationException(string message) : base(message)
    {
    }
}

public sealed class BookingNotFoundException()
    : SchedulingApplicationException("Agendamento não encontrado.");

/// <summary>React Native: BookingServicesScreen — "selecionar serviços" é um passo obrigatório do fluxo do prompt; nenhum agendamento nasce sem ao menos um item.</summary>
public sealed class InvalidBookingItemsException()
    : SchedulingApplicationException("Selecione ao menos um serviço para o agendamento.");

/// <summary>
/// "Não deve permitir conflitos de agendamento" / "verificação de conflito
/// deve acontecer no servidor" / "deve usar transação e mecanismo de
/// concorrência adequado" (REGRAS CRÍTICAS do PROMPT 08) — lançada tanto
/// pela checagem em memória (<c>BookingService.CreateBookingAsync</c>)
/// quanto pela rede de segurança do banco (falha de serialização Postgres,
/// ver <c>IUnitOfWork.ExecuteInSerializableTransactionAsync</c>) quando dois
/// moradores tentam o mesmo horário do mesmo profissional.
/// </summary>
public sealed class BookingConflictException()
    : SchedulingApplicationException("Este horário acabou de ser reservado. Escolha outro horário.");

/// <summary>Segunda camada de defesa (a primeira é a própria consulta restrita ao dono do agendamento) — mesma filosofia dos demais módulos, tipo próprio deste (nenhum módulo referencia outro).</summary>
public sealed class InsufficientPermissionsException()
    : SchedulingApplicationException("Você não tem permissão para executar esta ação.");

/// <summary>
/// "Somente Booking Completed pode ser avaliado" (REGRA CRÍTICA do PROMPT
/// 09) — lançada por <see cref="IBookingService.ValidateCompletedBookingForReviewAsync"/>,
/// o método que o módulo Reviews (via a Api, sua composição raiz) chama
/// para confirmar que um agendamento pode ser avaliado, sem o módulo
/// Reviews precisar referenciar este módulo — mesmo padrão de
/// <see cref="BookingNotFoundException"/>/<see cref="InsufficientPermissionsException"/>
/// para "só o dono pode ver/agir", agora aplicado à avaliação.
/// </summary>
public sealed class BookingNotCompletedException()
    : SchedulingApplicationException("Apenas um agendamento concluído pode ser avaliado.");
