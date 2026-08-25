using Alilu.Shared;

namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Usuário autenticável do ALILU.
///
/// IMPORTANTE (regra da Etapa 03): este usuário autenticado ainda NÃO
/// possui necessariamente vínculo com um condomínio — essa associação
/// (morador ↔ condomínio ↔ unidade) pertence ao módulo Resident, que não
/// foi implementado nesta etapa. <see cref="Role"/> aqui é apenas o papel
/// de autorização (claim) do usuário, não uma ligação a um condomínio.
/// </summary>
public sealed class User : AggregateRoot
{
    public string Name { get; private set; }
    public Email Email { get; private set; }
    public string? Phone { get; private set; }
    public string PasswordHash { get; private set; }
    public UserRole Role { get; private set; }
    public UserStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // Construtor privado sem parâmetros — usado pelo EF Core para materializar
    // a entidade a partir do banco (via reflexão), nunca deve ser chamado
    // diretamente pelo código da aplicação.
#pragma warning disable CS8618
    private User()
    {
    }
#pragma warning restore CS8618

    private User(Guid id, string name, Email email, string? phone, string passwordHash, UserRole role)
        : base(id)
    {
        Name = name;
        Email = email;
        Phone = phone;
        PasswordHash = passwordHash;
        Role = role;
        Status = UserStatus.Active; // sem verificação de e-mail implementada ainda nesta etapa
        var now = DateTime.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// Registra um novo usuário. <paramref name="passwordHash"/> já deve
    /// chegar hasheado (ver <see cref="IPasswordHasher"/>) — esta entidade
    /// nunca recebe nem manipula senha em texto puro.
    ///
    /// Apenas <see cref="UserRole.Resident"/> e
    /// <see cref="UserRole.Professional"/> podem se auto-cadastrar; papéis
    /// administrativos são rejeitados aqui como uma segunda camada de
    /// defesa (a Application também valida isso antes de chegar aqui).
    /// </summary>
    public static User Register(string name, Email email, string? phone, string passwordHash, UserRole role)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("O nome não pode ser vazio.");
        }

        if (name.Length > 200)
        {
            throw new DomainException("O nome não pode ter mais de 200 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new DomainException("O usuário precisa de uma senha.");
        }

        if (role is not (UserRole.Resident or UserRole.Professional))
        {
            throw new DomainException(
                "Apenas os papéis Resident e Professional podem ser escolhidos no cadastro.");
        }

        return new User(Guid.NewGuid(), name.Trim(), email, phone?.Trim(), passwordHash, role);
    }

    public bool IsActive => Status == UserStatus.Active;

    public void ChangePasswordHash(string newPasswordHash)
    {
        if (string.IsNullOrWhiteSpace(newPasswordHash))
        {
            throw new DomainException("A nova senha não pode ser vazia.");
        }

        PasswordHash = newPasswordHash;
        Touch();
    }

    public void Block()
    {
        Status = UserStatus.Blocked;
        Touch();
    }

    public void Activate()
    {
        Status = UserStatus.Active;
        Touch();
    }

    private void Touch()
    {
        UpdatedAt = DateTime.UtcNow;
    }
}
