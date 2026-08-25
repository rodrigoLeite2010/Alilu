using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Nunca inclui dados de outro módulo (nome/e-mail do usuário via Identity, dados do condomínio via Condominium) — só o que este módulo guarda. Enriquecer para exibição é responsabilidade da Api.</summary>
public sealed record ProfessionalResponse(
    Guid Id,
    Guid UserId,
    string DisplayName,
    string? Description,
    string? Phone,
    string? PhotoUrl,
    ProfessionalStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ServiceCategoryResponse(
    Guid Id,
    string Name,
    string? Description,
    bool Active);

public sealed record ProfessionalServiceResponse(
    Guid Id,
    Guid ProfessionalId,
    Guid ServiceCategoryId,
    string? Description,
    bool Active);

public sealed record ProfessionalCondominiumResponse(
    Guid Id,
    Guid ProfessionalId,
    Guid CondominiumId,
    ProfessionalCondominiumStatus Status,
    ProfessionalCondominiumSource Source,
    DateTime CreatedAt);

/// <summary>
/// Item de diretório público (React Native: ProfessionalListScreen/
/// ProfessionalProfileScreen — "listar profissionais; filtrar categoria;
/// visualizar perfil"). Combina <see cref="Domain.Professional"/> com as
/// categorias dos seus serviços ativos — dado que os dois pertencem a este
/// mesmo módulo, não é o mesmo tipo de "enriquecimento entre módulos" que
/// <see cref="ProfessionalResponse"/> evita.
/// </summary>
public sealed record ProfessionalDirectoryItemResponse(
    Guid Id,
    string DisplayName,
    string? Description,
    string? Phone,
    string? PhotoUrl,
    IReadOnlyList<ServiceCategoryResponse> Categories);
