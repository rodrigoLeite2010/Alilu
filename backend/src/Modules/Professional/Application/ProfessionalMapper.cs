using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Mapeamento Entidade → DTO compartilhado pelos serviços deste módulo.</summary>
internal static class ProfessionalMapper
{
    public static ProfessionalResponse ToResponse(Domain.Professional professional) => new(
        professional.Id,
        professional.UserId,
        professional.DisplayName,
        professional.Description,
        professional.Phone,
        professional.PhotoUrl,
        professional.Status,
        professional.CreatedAt,
        professional.UpdatedAt);

    public static ServiceCategoryResponse ToResponse(ServiceCategory category) => new(
        category.Id,
        category.Name,
        category.Description,
        category.CategoryId,
        category.Active);

    public static ProfessionalCategoryResponse ToResponse(ProfessionalCategory category) => new(
        category.Id,
        category.Name,
        category.Description,
        category.DisplayOrder,
        category.Active);

    public static ProfessionalServiceResponse ToResponse(ProfessionalService service) => new(
        service.Id,
        service.ProfessionalId,
        service.ServiceCategoryId,
        service.Description,
        service.Active);

    public static ProfessionalCondominiumResponse ToResponse(ProfessionalCondominium professionalCondominium) => new(
        professionalCondominium.Id,
        professionalCondominium.ProfessionalId,
        professionalCondominium.CondominiumId,
        professionalCondominium.Status,
        professionalCondominium.Source,
        professionalCondominium.CreatedAt);

    public static ProfessionalDirectoryItemResponse ToDirectoryItem(Domain.Professional professional, IEnumerable<ServiceCategory> categories) => new(
        professional.Id,
        professional.DisplayName,
        professional.Description,
        professional.Phone,
        professional.PhotoUrl,
        categories.Select(ToResponse).ToList());

    public static ProfessionalAvailabilityResponse ToResponse(ProfessionalAvailability availability) => new(
        availability.Id,
        availability.ProfessionalId,
        availability.DayOfWeek,
        availability.StartTime,
        availability.EndTime,
        availability.Active);

    public static ProfessionalAvailabilityExceptionResponse ToResponse(ProfessionalAvailabilityException exception) => new(
        exception.Id,
        exception.ProfessionalId,
        exception.Date,
        exception.StartTime,
        exception.EndTime,
        exception.Type,
        exception.Reason);

    public static ProfessionalInvitationResponse ToResponse(ProfessionalInvitation invitation) => new(
        invitation.Id,
        invitation.CondominiumId,
        invitation.InvitedByUserId,
        invitation.Name,
        invitation.Phone,
        invitation.Email,
        invitation.CreatedAt,
        invitation.WhatsAppDelivered,
        invitation.SmsDelivered,
        invitation.EmailDelivered);

}
