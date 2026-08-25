namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Tipo de uma <see cref="ProfessionalAvailabilityException"/> (PROMPT 07,
/// valores exatos pedidos no prompt): <see cref="Blocked"/> para "bloquear
/// datas" (o profissional fica indisponível num intervalo que a agenda
/// recorrente diria disponível — ex.: um feriado, uma folga) e
/// <see cref="Available"/> para "liberar horários específicos" (o
/// profissional abre um intervalo num dia que a agenda recorrente diria
/// indisponível — ex.: um plantão extra numa quarta-feira sem nenhum
/// intervalo cadastrado).
/// </summary>
public enum ProfessionalAvailabilityExceptionType
{
    Blocked = 1,
    Available = 2,
}
