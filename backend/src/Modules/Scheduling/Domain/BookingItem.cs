using Alilu.Shared;

namespace Alilu.Modules.Scheduling.Domain;

/// <summary>
/// Um serviço selecionado dentro de um <see cref="Booking"/> (PROMPT 08,
/// fluxo do morador: "selecionar serviços"). Um mesmo agendamento pode ter
/// vários itens (ex.: "limpeza de vidros" + "passar roupa").
///
/// É sua própria raiz de agregado — mesma decisão de <c>ProfessionalService</c>
/// (módulo Professional): só <see cref="BookingId"/>/<see cref="ServiceCategoryId"/>
/// como valores simples, sem navegação/FK para <c>Booking</c> (mesmo
/// módulo) nem para <c>ServiceCategory</c> (módulo Professional — nenhum
/// módulo referencia outro). A existência/atividade da categoria não é
/// revalidada aqui — o prompt não listou isso entre as REGRAS CRÍTICAS, e o
/// morador só pode escolher entre as categorias que a Api já devolveu no
/// diretório público (mesmo raciocínio de "não pedido pelo prompt, não
/// implementado" das etapas anteriores — ver ARCHITECTURE.md).
/// </summary>
public sealed class BookingItem : AggregateRoot
{
    public Guid BookingId { get; private set; }
    public Guid ServiceCategoryId { get; private set; }
    public string? Description { get; private set; }
    public int Quantity { get; private set; }

#pragma warning disable CS8618
    private BookingItem()
    {
    }
#pragma warning restore CS8618

    private BookingItem(Guid id, Guid bookingId, Guid serviceCategoryId, string? description, int quantity)
        : base(id)
    {
        BookingId = bookingId;
        ServiceCategoryId = serviceCategoryId;
        Description = description;
        Quantity = quantity;
    }

    public static BookingItem Create(Guid bookingId, Guid serviceCategoryId, string? description, int quantity)
    {
        if (bookingId == Guid.Empty)
        {
            throw new DomainException("O item precisa de um agendamento válido.");
        }

        if (serviceCategoryId == Guid.Empty)
        {
            throw new DomainException("O item precisa de uma categoria de serviço válida.");
        }

        if (quantity <= 0)
        {
            throw new DomainException("A quantidade precisa ser maior que zero.");
        }

        var trimmedDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        if (trimmedDescription is { Length: > 500 })
        {
            throw new DomainException("A descrição do item não pode ter mais de 500 caracteres.");
        }

        return new BookingItem(Guid.NewGuid(), bookingId, serviceCategoryId, trimmedDescription, quantity);
    }
}
