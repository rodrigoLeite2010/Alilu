using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="Domain.Professional"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalConfiguration : IEntityTypeConfiguration<Domain.Professional>
{
    public void Configure(EntityTypeBuilder<Domain.Professional> builder)
    {
        builder.ToTable("professionals", "professional");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.UserId).IsRequired();

        // "Professional NÃO é automaticamente morador" e um usuário só tem
        // um perfil profissional — índice único simples (sem filtro: não
        // existe soft-delete de perfil nesta etapa, só Active/Inactive).
        builder.HasIndex(p => p.UserId).IsUnique();

        builder.Property(p => p.DisplayName)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(p => p.Description).HasMaxLength(1000);
        builder.Property(p => p.Phone).HasMaxLength(20);
        builder.Property(p => p.PhotoUrl).HasMaxLength(2048);

        // Enum armazenado como texto — mesma decisão dos demais módulos
        // (Identity/Condominium/Resident); as colunas precisam de aspas
        // duplas nos índices porque este projeto não usa nenhum plugin de
        // convenção de nomes do EF Core.
        builder.Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.UpdatedAt).IsRequired();

        builder.Ignore(p => p.DomainEvents);
    }
}
