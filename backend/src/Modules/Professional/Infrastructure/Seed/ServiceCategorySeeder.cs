using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Seed;

/// <summary>
/// Cria/atualiza as especialidades de serviço (PROMPT 06, sete iniciais:
/// Diarista, Jardineiro, Piscineiro, Eletricista, Encanador, Pedreiro,
/// Pintor; ampliado na Etapa 22 para a lista completa de Rodrigo — treze
/// categorias, ~100 especialidades), só para ambiente de desenvolvimento.
/// Escreve diretamente no <see cref="AliluDbContext"/> (não passa pelos
/// repositórios/Application) porque é infraestrutura de bootstrap, não um
/// caso de uso de negócio — mesmo raciocínio de <c>CondominiumSeeder</c>.
///
/// Depende de <see cref="ProfessionalCategorySeeder"/> já ter rodado antes
/// (ver ordem de chamada em <c>Alilu.Api.Program</c>) — cada especialidade
/// resolve sua <see cref="ServiceCategory.CategoryId"/> pelo NOME da
/// categoria-pai, procurando entre as já inseridas.
///
/// Idempotente e SEM PERDA DE DADOS (importante na Etapa 22: as sete
/// especialidades originais já podiam estar vinculadas a profissionais via
/// <c>ProfessionalService</c>, que guarda só o Id como valor — sem FK de
/// verdade, ver comentário de <see cref="ServiceCategory"/>): para cada
/// especialidade já existente (checagem por nome), NUNCA apaga/recria —
/// só corrige a <see cref="ServiceCategory.CategoryId"/> se estiver
/// diferente do esperado (via <see cref="ServiceCategory.AssignCategory"/>),
/// preservando o mesmo Id de sempre. Só cria uma linha nova quando o nome
/// realmente não existe ainda.
/// </summary>
public sealed class ServiceCategorySeeder(AliluDbContext dbContext) : IServiceCategorySeeder
{
    /// <summary>(Nome da especialidade, descrição, nome da categoria-pai — deve bater com um nome de <see cref="ProfessionalCategorySeeder.InitialCategories"/>).</summary>
    private static readonly (string Name, string Description, string CategoryName)[] InitialSpecialties =
    {
        // 1. Limpeza e Serviços Domésticos
        ("Diarista", "Limpeza residencial avulsa ou periódica.", "Limpeza e Serviços Domésticos"),
        ("Faxineira", "Limpeza residencial completa e recorrente.", "Limpeza e Serviços Domésticos"),
        ("Passadeira", "Passar roupas em domicílio.", "Limpeza e Serviços Domésticos"),
        ("Cozinheira", "Preparo de refeições no dia a dia.", "Limpeza e Serviços Domésticos"),
        ("Cozinheira para eventos", "Preparo de refeições para festas e eventos.", "Limpeza e Serviços Domésticos"),
        ("Lavagem e organização", "Lavagem de roupas e organização do lar.", "Limpeza e Serviços Domésticos"),
        ("Organização residencial", "Organização de ambientes e armários.", "Limpeza e Serviços Domésticos"),
        ("Limpeza pós-obra", "Limpeza pesada após reforma ou construção.", "Limpeza e Serviços Domésticos"),
        ("Limpeza pesada", "Limpeza profunda de ambientes muito sujos ou parados.", "Limpeza e Serviços Domésticos"),
        ("Limpeza de vidros", "Limpeza de janelas, vidros e fachadas internas.", "Limpeza e Serviços Domésticos"),
        ("Lavagem de tapetes e estofados", "Lavagem de tapetes, sofás e estofados.", "Limpeza e Serviços Domésticos"),

        // 2. Reparos e Manutenção
        ("Marido de aluguel", "Pequenos consertos e tarefas gerais da casa.", "Reparos e Manutenção"),
        ("Eletricista", "Instalações e reparos elétricos.", "Reparos e Manutenção"),
        ("Encanador", "Instalações e reparos hidráulicos.", "Reparos e Manutenção"),
        ("Pintor", "Pintura residencial e predial.", "Reparos e Manutenção"),
        ("Pedreiro", "Serviços de alvenaria e reformas.", "Reparos e Manutenção"),
        ("Gesseiro", "Instalação e reparo de forro e sanca de gesso.", "Reparos e Manutenção"),
        ("Montador de móveis", "Montagem e desmontagem de móveis.", "Reparos e Manutenção"),
        ("Instalador de cortinas e persianas", "Instalação de cortinas e persianas.", "Reparos e Manutenção"),
        ("Instalador de TV", "Instalação de TV e suportes de parede.", "Reparos e Manutenção"),
        ("Pequenos reparos residenciais", "Consertos gerais do dia a dia da casa.", "Reparos e Manutenção"),

        // 3. Equipamentos e Instalações
        ("Técnico de ar-condicionado", "Diagnóstico e reparo de ar-condicionado.", "Equipamentos e Instalações"),
        ("Instalação de ar-condicionado", "Instalação de aparelhos de ar-condicionado.", "Equipamentos e Instalações"),
        ("Manutenção de ar-condicionado", "Limpeza e manutenção periódica de ar-condicionado.", "Equipamentos e Instalações"),
        ("Técnico de geladeira", "Diagnóstico e reparo de geladeiras.", "Equipamentos e Instalações"),
        ("Técnico de máquina de lavar", "Diagnóstico e reparo de máquinas de lavar.", "Equipamentos e Instalações"),
        ("Técnico de lava-louças", "Diagnóstico e reparo de lava-louças.", "Equipamentos e Instalações"),
        ("Instalação de ventilador de teto", "Instalação de ventilador de teto.", "Equipamentos e Instalações"),
        ("Instalação de chuveiro", "Instalação e troca de chuveiro.", "Equipamentos e Instalações"),
        ("Instalação de fechadura eletrônica", "Instalação de fechadura eletrônica.", "Equipamentos e Instalações"),

        // 4. Energia Solar e Aquecimento (inclui Boiler/Aquecedores — nomenclatura clara, ver ARCHITECTURE.md)
        ("Instalação de energia solar", "Instalação de sistemas de energia solar.", "Energia Solar e Aquecimento"),
        ("Manutenção de energia solar", "Manutenção de sistemas de energia solar.", "Energia Solar e Aquecimento"),
        ("Limpeza de placas solares", "Limpeza de placas de energia solar.", "Energia Solar e Aquecimento"),
        ("Instalação de placas solares", "Instalação de placas de energia solar.", "Energia Solar e Aquecimento"),
        ("Manutenção de placas solares", "Manutenção de placas de energia solar.", "Energia Solar e Aquecimento"),
        ("Instalação de boiler", "Instalação de boiler (reservatório de água quente).", "Energia Solar e Aquecimento"),
        ("Manutenção de boiler", "Manutenção de boiler (reservatório de água quente).", "Energia Solar e Aquecimento"),
        ("Instalação de aquecedor solar", "Instalação de aquecedor solar.", "Energia Solar e Aquecimento"),
        ("Manutenção de aquecedor solar", "Manutenção de aquecedor solar.", "Energia Solar e Aquecimento"),
        ("Instalação de aquecedor a gás", "Instalação de aquecedor a gás.", "Energia Solar e Aquecimento"),
        ("Manutenção de aquecedor a gás", "Manutenção de aquecedor a gás.", "Energia Solar e Aquecimento"),

        // 5. Jardim e Área Externa
        ("Jardineiro", "Manutenção de jardins e áreas verdes.", "Jardim e Área Externa"),
        ("Paisagista", "Projeto e composição de jardins.", "Jardim e Área Externa"),
        ("Poda de árvores", "Poda e manutenção de árvores.", "Jardim e Área Externa"),
        ("Corte de grama", "Corte e manutenção de gramados.", "Jardim e Área Externa"),
        ("Manutenção de jardim", "Manutenção geral de jardins.", "Jardim e Área Externa"),
        ("Limpeza de quintal", "Limpeza de quintais e áreas externas.", "Jardim e Área Externa"),
        ("Limpeza de terreno", "Limpeza e roçada de terrenos.", "Jardim e Área Externa"),

        // 6. Piscina
        ("Piscineiro", "Limpeza e manutenção de piscinas.", "Piscina"),
        ("Manutenção de piscina", "Manutenção periódica de piscina.", "Piscina"),
        ("Limpeza de piscina", "Limpeza de piscina.", "Piscina"),
        ("Tratamento de água", "Tratamento químico da água da piscina.", "Piscina"),
        ("Manutenção de equipamentos de piscina", "Manutenção de bombas e filtros de piscina.", "Piscina"),
        ("Instalação de equipamentos de piscina", "Instalação de bombas e filtros de piscina.", "Piscina"),

        // 7. Lavagem e Estética Automotiva (regras específicas por condomínio ficam para uma etapa futura — ver ARCHITECTURE.md)
        ("Lavador de carros", "Lavagem de veículos no condomínio.", "Lavagem e Estética Automotiva"),
        ("Lavagem simples", "Lavagem externa simples de veículos.", "Lavagem e Estética Automotiva"),
        ("Lavagem completa", "Lavagem externa e interna completa de veículos.", "Lavagem e Estética Automotiva"),
        ("Lavagem a seco", "Lavagem de veículos sem uso de água corrente.", "Lavagem e Estética Automotiva"),
        ("Higienização interna", "Higienização do interior do veículo.", "Lavagem e Estética Automotiva"),
        ("Higienização de bancos", "Higienização de bancos e estofados do veículo.", "Lavagem e Estética Automotiva"),
        ("Limpeza interna", "Limpeza geral do interior do veículo.", "Lavagem e Estética Automotiva"),
        ("Polimento", "Polimento da pintura do veículo.", "Lavagem e Estética Automotiva"),
        ("Cristalização", "Cristalização da pintura do veículo.", "Lavagem e Estética Automotiva"),
        ("Estética automotiva", "Serviços gerais de estética automotiva.", "Lavagem e Estética Automotiva"),

        // 8. Pets
        ("Passeador de cães", "Passeio de cães.", "Pets"),
        ("Pet sitter", "Cuidado de pets na ausência do tutor.", "Pets"),
        ("Hospedagem de pets", "Hospedagem de pets.", "Pets"),
        ("Banho e tosa em domicílio", "Banho e tosa de pets em domicílio.", "Pets"),
        ("Adestrador", "Adestramento de cães.", "Pets"),
        ("Cuidador de pets", "Cuidados gerais com pets.", "Pets"),
        ("Transporte de pets", "Transporte de pets.", "Pets"),

        // 9. Crianças e Família
        ("Babá", "Cuidado de crianças no dia a dia.", "Crianças e Família"),
        ("Cuidadora infantil", "Cuidado infantil periódico ou eventual.", "Crianças e Família"),
        ("Acompanhante infantil", "Acompanhamento de crianças em atividades.", "Crianças e Família"),
        ("Recreador", "Recreação infantil em eventos.", "Crianças e Família"),
        ("Professora particular", "Aulas particulares.", "Crianças e Família"),
        ("Reforço escolar", "Reforço escolar para crianças e adolescentes.", "Crianças e Família"),
        ("Cuidadora para eventos", "Cuidado infantil em festas e eventos.", "Crianças e Família"),

        // 10. Cuidados e Acompanhamento
        ("Cuidador de idosos", "Cuidado e acompanhamento de idosos.", "Cuidados e Acompanhamento"),
        ("Acompanhante", "Acompanhamento de pessoas que precisam de suporte.", "Cuidados e Acompanhamento"),
        ("Massagista", "Massagem terapêutica ou relaxante.", "Cuidados e Acompanhamento"),
        ("Manicure e pedicure", "Cuidados com unhas em domicílio.", "Cuidados e Acompanhamento"),
        ("Cabeleireiro", "Corte e tratamento capilar em domicílio.", "Cuidados e Acompanhamento"),
        ("Barbeiro", "Corte de cabelo e barba em domicílio.", "Cuidados e Acompanhamento"),
        ("Maquiador", "Maquiagem para eventos.", "Cuidados e Acompanhamento"),

        // 11. Mudanças e Serviços
        ("Carreto", "Transporte de móveis e objetos.", "Mudanças e Serviços"),
        ("Pequenas mudanças", "Mudanças de pequeno porte.", "Mudanças e Serviços"),
        ("Motorista particular", "Transporte particular de passageiros.", "Mudanças e Serviços"),
        ("Montagem para mudança", "Desmontagem e montagem de móveis na mudança.", "Mudanças e Serviços"),
        ("Embalagem e organização", "Embalagem de itens para mudança.", "Mudanças e Serviços"),
        ("Descarte de móveis e objetos", "Descarte e remoção de móveis e objetos.", "Mudanças e Serviços"),
        ("Serviços de entrega", "Entrega de encomendas e itens.", "Mudanças e Serviços"),

        // 12. Tecnologia e Casa Inteligente
        ("Técnico de informática", "Suporte técnico em informática.", "Tecnologia e Casa Inteligente"),
        ("Configuração de computador", "Configuração e manutenção de computadores.", "Tecnologia e Casa Inteligente"),
        ("Configuração de impressora", "Configuração de impressoras.", "Tecnologia e Casa Inteligente"),
        ("Instalação de Wi-Fi", "Instalação e configuração de rede Wi-Fi.", "Tecnologia e Casa Inteligente"),
        ("Configuração de roteador", "Configuração de roteador de internet.", "Tecnologia e Casa Inteligente"),
        ("Instalação de câmeras", "Instalação de câmeras de segurança.", "Tecnologia e Casa Inteligente"),
        ("Instalação de automação residencial", "Instalação de automação residencial.", "Tecnologia e Casa Inteligente"),
        ("Configuração de Smart TV", "Configuração de Smart TV e streaming.", "Tecnologia e Casa Inteligente"),

        // 13. Serviços Especializados
        ("Arquitetura", "Projetos de arquitetura.", "Serviços Especializados"),
        ("Design de interiores", "Projetos de design de interiores.", "Serviços Especializados"),
        ("Fotografia", "Serviços de fotografia.", "Serviços Especializados"),
        ("Filmagem", "Serviços de filmagem.", "Serviços Especializados"),
        ("Personal organizer", "Organização profissional de espaços.", "Serviços Especializados"),
        ("Consultoria residencial", "Consultoria geral para a residência.", "Serviços Especializados"),
    };

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var categoriesByName = await dbContext.Set<ProfessionalCategory>()
            .ToDictionaryAsync(c => c.Name, cancellationToken);

        var existingSpecialties = await dbContext.Set<ServiceCategory>()
            .ToDictionaryAsync(s => s.Name, cancellationToken);

        var hasChanges = false;

        foreach (var (name, description, categoryName) in InitialSpecialties)
        {
            if (!categoriesByName.TryGetValue(categoryName, out var category))
            {
                // Só acontece se ProfessionalCategorySeeder não rodou antes
                // deste (erro de configuração, não de dado do usuário) — ver
                // ordem de chamada em Alilu.Api.Program.
                throw new InvalidOperationException(
                    $"Categoria '{categoryName}' não encontrada — ProfessionalCategorySeeder precisa rodar antes de ServiceCategorySeeder.");
            }

            if (existingSpecialties.TryGetValue(name, out var specialty))
            {
                if (specialty.CategoryId != category.Id)
                {
                    // Backfill (Etapa 22): preserva o mesmo Id da especialidade
                    // — nunca apaga/recria — para não invalidar nenhum
                    // ProfessionalService que já aponte para ela.
                    specialty.AssignCategory(category.Id);
                    hasChanges = true;
                }

                continue;
            }

            var created = ServiceCategory.Create(name, description, category.Id);
            await dbContext.Set<ServiceCategory>().AddAsync(created, cancellationToken);
            hasChanges = true;
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
