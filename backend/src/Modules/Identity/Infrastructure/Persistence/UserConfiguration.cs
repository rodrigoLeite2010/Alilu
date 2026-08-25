using Alilu.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Identity.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="User"/>. Descoberto dinamicamente por
/// <c>AliluDbContext.OnModelCreating</c> via
/// <c>ModelBuilder.ApplyConfigurationsFromAssembly</c> — não é referenciado
/// diretamente pelo DbContext raiz.
/// </summary>
public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", "identity");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Name)
            .HasMaxLength(200)
            .IsRequired();

        // Email é um Value Object (Domain/Email.cs) com um único construtor
        // privado que recebe "value" — o EF Core consegue materializá-lo via
        // esse construtor (binding por nome/posição do parâmetro), então o
        // mapeamos como tipo possuído (owned type) em vez de um conversor de
        // valor simples. Isso também permite consultar por "u.Email.Value"
        // (ver UserRepository) porque a coluna fica de fato mapeada, e não
        // escondida atrás de um ValueConverter.
        builder.OwnsOne(u => u.Email, email =>
        {
            email.Property(e => e.Value)
                .HasColumnName("email")
                .HasMaxLength(254)
                .IsRequired();

            email.HasIndex(e => e.Value)
                .IsUnique();
        });

        builder.Navigation(u => u.Email).IsRequired();

        builder.Property(u => u.Phone)
            .HasMaxLength(30);

        // Base64 de PBKDF2 (1 + 4 + 16 + 32 bytes) ≈ 72 caracteres — 200 dá margem
        // caso o formato mude (ex.: mais iterações/salt maior) sem quebrar o schema.
        builder.Property(u => u.PasswordHash)
            .HasMaxLength(200)
            .IsRequired();

        // Enums armazenados como texto (não como inteiro) para o banco ficar
        // legível e resistente a reordenação futura dos valores do enum.
        builder.Property(u => u.Role)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(u => u.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(u => u.CreatedAt).IsRequired();
        builder.Property(u => u.UpdatedAt).IsRequired();

        // AggregateRoot.DomainEvents é só um detalhe de runtime (nenhum
        // evento de domínio é levantado nesta etapa) — nunca deve virar coluna/tabela.
        builder.Ignore(u => u.DomainEvents);
    }
}
