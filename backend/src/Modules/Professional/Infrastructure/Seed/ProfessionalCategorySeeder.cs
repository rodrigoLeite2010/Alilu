using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Seed;

/// <summary>
/// Cria as treze categorias iniciais de profissional (Etapa 22, pedido de
/// Rodrigo: "cadastrar mais categorias em profissionais" — lista completa
/// dele, "CATEGORIAS E ESPECIALIDADES" 1 a 13), só para ambiente de
/// desenvolvimento. Escreve diretamente no <see cref="AliluDbContext"/>
/// (não passa pelos repositórios/Application) porque é infraestrutura de
/// bootstrap, não um caso de uso de negócio — mesmo raciocínio de
/// <c>ServiceCategorySeeder</c>/<c>CondominiumSeeder</c>.
///
/// <see cref="DisplayOrder"/> de cada categoria segue a ordem de
/// "CATEGORIAS PRINCIPAIS PARA O APP" do pedido original — Rodrigo listou
/// doze ali (sem "Serviços Especializados", a 13ª da lista completa);
/// mantemos essa 13ª por último (ordem 13), nunca escondida, só depois das
/// demais.
///
/// Idempotente: cada categoria só é inserida se ainda não existir uma com
/// o mesmo nome (checagem individual, mesmo padrão de <c>ServiceCategorySeeder</c>) —
/// e, para as que já existirem, corrige a <see cref="ProfessionalCategory.DisplayOrder"/>
/// se estiver diferente (permite ajustar a ordem de exibição rodando o
/// seeder de novo, sem precisar apagar/recriar nada).
/// </summary>
public sealed class ProfessionalCategorySeeder(AliluDbContext dbContext) : IProfessionalCategorySeeder
{
    /// <summary>Nome exposto ao próprio módulo (<see cref="ServiceCategorySeeder"/> resolve o Id de cada categoria por este nome) — mudar aqui exige atualizar lá também.</summary>
    public static readonly (string Name, string Description, int DisplayOrder)[] InitialCategories =
    {
        ("Limpeza e Serviços Domésticos", "Diaristas, faxina, organização e cozinha para o dia a dia ou eventos.", 1),
        ("Reparos e Manutenção", "Eletricista, encanador, pintor, pedreiro e outros reparos residenciais.", 2),
        ("Equipamentos e Instalações", "Instalação e manutenção de ar-condicionado, eletrodomésticos e afins.", 3),
        ("Energia Solar e Aquecimento", "Instalação e manutenção de placas solares, boiler e aquecedores.", 4),
        ("Jardim e Área Externa", "Jardinagem, paisagismo e manutenção de áreas externas.", 5),
        ("Piscina", "Limpeza, manutenção e tratamento de água de piscina.", 6),
        ("Lavagem e Estética Automotiva", "Lavagem e estética de veículos dentro do condomínio.", 7),
        ("Pets", "Passeio, hospedagem, banho e tosa e demais cuidados com animais de estimação.", 8),
        ("Crianças e Família", "Babá, reforço escolar e acompanhamento infantil.", 9),
        ("Cuidados e Acompanhamento", "Cuidador de idosos, acompanhante e serviços de estética pessoal.", 10),
        ("Mudanças e Serviços", "Carreto, pequenas mudanças e serviços de entrega.", 11),
        ("Tecnologia e Casa Inteligente", "Suporte de informática, redes, câmeras e automação residencial.", 12),
        ("Serviços Especializados", "Arquitetura, design de interiores, fotografia e consultoria.", 13),
    };

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var existing = await dbContext.Set<ProfessionalCategory>()
            .ToDictionaryAsync(c => c.Name, cancellationToken);

        var hasChanges = false;

        foreach (var (name, description, displayOrder) in InitialCategories)
        {
            if (existing.TryGetValue(name, out var category))
            {
                if (category.DisplayOrder != displayOrder)
                {
                    category.SetDisplayOrder(displayOrder);
                    hasChanges = true;
                }

                continue;
            }

            var created = ProfessionalCategory.Create(name, description, displayOrder);
            await dbContext.Set<ProfessionalCategory>().AddAsync(created, cancellationToken);
            hasChanges = true;
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
