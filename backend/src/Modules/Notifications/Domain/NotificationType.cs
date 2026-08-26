namespace Alilu.Modules.Notifications.Domain;

/// <summary>
/// Os dez EVENTOS do PROMPT 11, na mesma ordem em que o prompt os listou.
/// Cada valor corresponde a exatamente um ponto de composição na Api (a
/// única camada que pode enxergar todos os módulos ao mesmo tempo) — ver
/// ARCHITECTURE.md, "Etapa 11", para onde cada um é disparado.
/// </summary>
public enum NotificationType
{
    /// <summary>Novo agendamento — para o profissional (BookingsController.Create).</summary>
    BookingCreated = 1,

    /// <summary>Agendamento aceito — para o morador (ProfessionalBookingsController.Accept).</summary>
    BookingAccepted = 2,

    /// <summary>Agendamento rejeitado — para o morador (ProfessionalBookingsController.Reject).</summary>
    BookingRejected = 3,

    /// <summary>Agendamento cancelado — para quem não cancelou (BookingsController.Cancel / ProfessionalBookingsController.Cancel).</summary>
    BookingCancelled = 4,

    /// <summary>Lembrete do serviço — para morador e profissional, gerado pelo BookingReminderBackgroundService (Api).</summary>
    ServiceReminder = 5,

    /// <summary>Serviço concluído — para o morador (ProfessionalBookingsController.Complete).</summary>
    ServiceCompleted = 6,

    /// <summary>Nova avaliação — para o profissional (ReviewsController.Create).</summary>
    NewReview = 7,

    /// <summary>Recomendação aprovada — para quem recomendou (AdminRecommendationsController.Approve).</summary>
    RecommendationApproved = 8,

    /// <summary>Solicitação de acesso aprovada — para o morador (AdminMembershipsController.Approve).</summary>
    AccessRequestApproved = 9,

    /// <summary>Solicitação de acesso rejeitada — para o morador (AdminMembershipsController.Reject).</summary>
    AccessRequestRejected = 10,
}
