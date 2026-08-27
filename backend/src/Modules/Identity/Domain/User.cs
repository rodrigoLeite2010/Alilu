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
    /// <summary>
    /// Foto pessoal (Etapa 21) — mostrada ao lado do nome em qualquer papel
    /// (morador/profissional/administrador). URL absoluta apontando para
    /// <c>Alilu.Api</c> (ver <c>Services/IUserPhotoStorage</c>), nunca um
    /// caminho relativo — o app mobile usa isto direto num
    /// <c>&lt;Image&gt;</c>, sem conhecer a base da Api.
    /// </summary>
    public string? PhotoUrl { get; private set; }
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

    /// <summary>
    /// Cria um usuário com papel administrativo (<see cref="UserRole.CondominiumAdmin"/>
    /// ou <see cref="UserRole.SuperAdmin"/>) — o espelho de <see cref="Register"/>:
    /// aquele método só aceita Resident/Professional, este só aceita os dois
    /// papéis administrativos. Nunca é chamado a partir do autocadastro
    /// público (não existe endpoint que exponha isto a um usuário anônimo);
    /// hoje só é usado pelo bootstrap do primeiro SuperAdmin (Etapa 16 —
    /// ver <c>Identity.Infrastructure.Seed.SuperAdminBootstrapper</c>), que
    /// roda a partir de configuração de servidor, nunca de entrada HTTP.
    /// </summary>
    public static User CreateAdministrative(string name, Email email, string? phone, string passwordHash, UserRole role)
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

        if (role is not (UserRole.CondominiumAdmin or UserRole.SuperAdmin))
        {
            throw new DomainException(
                "Este método só cria usuários com papel administrativo (CondominiumAdmin ou SuperAdmin).");
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

    /// <summary>
    /// Define ou remove (<paramref name="photoUrl"/> nulo) a foto pessoal
    /// do usuário. Sem validação de formato aqui — decodificar/validar o
    /// upload em si (tamanho, tipo de arquivo) é responsabilidade de quem
    /// gera a URL antes de chamar este método (ver
    /// <c>Alilu.Api.Services.IUserPhotoStorage</c>); esta entidade só guarda
    /// o resultado.
    /// </summary>
    public void SetPhoto(string? photoUrl)
    {
        PhotoUrl = photoUrl;
        Touch();
    }

    private void Touch()
    {
        UpdatedAt = DateTime.UtcNow;
    }
}
