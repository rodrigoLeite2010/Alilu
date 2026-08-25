namespace Alilu.Modules.Scheduling.Domain;

/// <summary>
/// Estado de um <see cref="Booking"/> (PROMPT 08) — os oito valores pedidos
/// pelo prompt, nesta ordem.
///
/// Requested: o morador criou a solicitação; aguardando o profissional
/// aceitar ou recusar (fluxo do profissional: "receber solicitação →
/// aceitar ou recusar"). Confirmed: o profissional aceitou. Rejected: o
/// profissional recusou (a partir de Requested). CancelledByResident/
/// CancelledByProfessional: cancelamento por qualquer um dos dois lados,
/// só antes de concluído (ver <see cref="Booking.CancelByResident"/>/
/// <see cref="Booking.CancelByProfessional"/> para as regras de "quando é
/// permitido cancelar"). InProgress: o atendimento começou. Completed: o
/// atendimento foi concluído. NoShow: o profissional confirmou, mas o
/// morador não estava presente/o atendimento não aconteceu.
///
/// Usado por <see cref="Booking.OccupiesSlot"/> para decidir quais status
/// ainda "seguram" um horário na agenda ao checar conflito com uma nova
/// solicitação — ver ARCHITECTURE.md, "Etapa 08 — concorrência".
/// </summary>
public enum BookingStatus
{
    Requested = 1,
    Confirmed = 2,
    Rejected = 3,
    CancelledByResident = 4,
    CancelledByProfessional = 5,
    InProgress = 6,
    Completed = 7,
    NoShow = 8,
}
