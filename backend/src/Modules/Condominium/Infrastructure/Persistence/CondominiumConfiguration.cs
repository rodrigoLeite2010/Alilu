using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="Domain.Condominium"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c> — mesmo padrão
/// de <c>UserConfiguration</c> no módulo Identity.
/// </summary>
public sealed class CondominiumConfiguration : IEntityTypeConfiguration<Domain.Condominium>
{
    public void Configure(EntityTypeBuilder<Domain.Condominium> builder)
    {
        builder.ToTable("condominiums", "condominium");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(200)
            .IsRequired();

        // Cnpj é um Value Object (Domain/Cnpj.cs) — mapeado como tipo
        // possuído (owned type), mesma técnica de Email no módulo Identity,
        // para permitir consultar por "c.Cnpj.Value" (ver
        // CondominiumRepository) com a coluna de fato mapeada.
        builder.OwnsOne(c => c.Cnpj, cnpj =>
        {
            cnpj.Property(v => v.Value)
                .HasColumnName("cnpj")
                .HasMaxLength(14)
                .IsRequired();

            cnpj.HasIndex(v => v.Value)
                .IsUnique();
        });

        builder.Navigation(c => c.Cnpj).IsRequired();

        builder.Property(c => c.Address).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Number).HasMaxLength(20).IsRequired();
        builder.Property(c => c.Neighborhood).HasMaxLength(150).IsRequired();
        builder.Property(c => c.City).HasMaxLength(150).IsRequired();
        builder.Property(c => c.State).HasMaxLength(2).IsRequired();
        builder.Property(c => c.ZipCode).HasMaxLength(8).IsRequired();

        // Enum armazenado como texto — mesma decisão de Role/Status no
        // módulo Identity (legível no banco, resistente a reordenação).
        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(c => c.CreatedAt).IsRequired();

        // Nenhum evento de domínio é levantado nesta etapa.
        builder.Ignore(c => c.DomainEvents);
    }
}
