namespace Alilu.Api.Services;

/// <summary>
/// Armazenamento da foto pessoal do usuário (Etapa 21). Fica em
/// <c>Alilu.Api</c> (composição raiz), não em nenhum módulo — decodificar e
/// gravar bytes de imagem em disco é um detalhe de infraestrutura da Api,
/// não uma regra de negócio de Identity nem de nenhum outro módulo (nenhum
/// módulo faz I/O de arquivo hoje). <see cref="Alilu.Modules.Identity.Application.IAuthService.SetMyPhotoAsync"/>
/// só recebe a URL já pronta — nunca bytes de imagem.
/// </summary>
public interface IUserPhotoStorage
{
    /// <summary>
    /// Decodifica, valida (formato/tamanho) e grava a imagem, sobrescrevendo
    /// qualquer foto anterior deste usuário — mesmo que a extensão tenha
    /// mudado (ex.: era .png, virou .jpg). Lança
    /// <see cref="Alilu.Modules.Identity.Application.InvalidPhotoException"/>
    /// em qualquer caso de entrada inválida. Retorna o caminho público
    /// relativo (ex.: "/uploads/user-photos/{id}.jpg") — quem chama monta a
    /// URL absoluta (ver <c>AuthController</c>).
    /// </summary>
    Task<string> SaveAsync(Guid userId, string base64Image, string contentType, CancellationToken cancellationToken = default);

    /// <summary>Remove a foto salva deste usuário, se houver — nunca lança se não existir nenhuma.</summary>
    void Delete(Guid userId);
}
