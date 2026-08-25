using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// O perfil profissional de um usuário (PROMPT 06) — diarista, jardineiro,
/// piscineiro, eletricista, encanador, pedreiro, pintor, etc.
///
/// "Professional NÃO é automaticamente morador" (PROMPT 06): esta entidade
/// não tem nenhuma relação com <c>CondominiumMembership</c> (módulo
/// Resident) — um mesmo usuário poderia, em tese, ter os dois papéis, mas
/// um não implica o outro.
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>User</c> (módulo Identity), só <see cref="UserId"/> como valor
/// simples (mesma decisão de <c>CondominiumMembership</c> no módulo
/// Resident: nenhum módulo referencia outro, então esta entidade nem teria
/// como declarar uma navegação para um tipo de outro módulo). A checagem
/// de que o usuário existe e a unicidade de perfil por usuário (um
/// profissional só pode ter um perfil) são responsabilidade da Application
/// antes de persistir, reforçadas por um índice único em Infrastructure.
/// </summary>
public sealed class Professional : AggregateRoot
{
    public Guid UserId { get; private set; }
    public string DisplayName { get; private set; }
    public string? Description { get; private set; }
    public string? Phone { get; private set; }
    public string? PhotoUrl { get; private set; }
    public ProfessionalStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

#pragma warning disable CS8618
    private Professional()
    {
    }
#pragma warning restore CS8618

    private Professional(Guid id, Guid userId, string displayName, string? description, string? phone, string? photoUrl)
        : base(id)
    {
        UserId = userId;
        DisplayName = displayName;
        Description = description;
        Phone = phone;
        PhotoUrl = photoUrl;
        Status = ProfessionalStatus.Active;
        var now = DateTime.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// Cria o perfil profissional de um usuário. A unicidade (um perfil por
    /// usuário) é responsabilidade da Application (ver
    /// <c>IProfessionalRepository.GetByUserIdAsync</c>) — esta entidade,
    /// isolada, não tem como saber sobre os demais perfis.
    /// </summary>
    public static Professional Register(Guid userId, string displayName, string? description, string? phone, string? photoUrl)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("O perfil profissional precisa de um usuário válido.");
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new DomainException("O nome de exibição não pode ser vazio.");
        }

        var trimmedName = displayName.Trim();
        if (trimmedName.Length > 120)
        {
            throw new DomainException("O nome de exibição não pode ter mais de 120 caracteres.");
        }

        return new Professional(
            Guid.NewGuid(), userId, trimmedName, Normalize(description, 1000), Normalize(phone, 20), Normalize(photoUrl, 2048));
    }

    public bool IsActive => Status == ProfessionalStatus.Active;

    /// <summary>Edição de perfil (React Native: ProfessionalEditScreen — "editar perfil").</summary>
    public void UpdateProfile(string displayName, string? description, string? phone, string? photoUrl)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new DomainException("O nome de exibição não pode ser vazio.");
        }

        var trimmedName = displayName.Trim();
        if (trimmedName.Length > 120)
        {
            throw new DomainException("O nome de exibição não pode ter mais de 120 caracteres.");
        }

        DisplayName = trimmedName;
        Description = Normalize(description, 1000);
        Phone = Normalize(phone, 20);
        PhotoUrl = Normalize(photoUrl, 2048);
        Touch();
    }

    public void Deactivate()
    {
        Status = ProfessionalStatus.Inactive;
        Touch();
    }

    public void Activate()
    {
        Status = ProfessionalStatus.Active;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string? Normalize(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            throw new DomainException($"O campo não pode ter mais de {maxLength} caracteres.");
        }

        return trimmed;
    }
}
