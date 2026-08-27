using Alilu.Modules.Identity.Application;

namespace Alilu.Api.Services;

/// <summary>
/// Implementação em disco de <see cref="IUserPhotoStorage"/> — sem nenhuma
/// dependência de armazenamento em nuvem (S3/Azure Blob), de propósito:
/// mesmo espírito de simplicidade já adotado no resto do projeto ("não usar
/// biblioteca/serviço externo quando dá para resolver com o que já está
/// disponível"). Grava sob <c>wwwroot/uploads/user-photos/</c> do próprio
/// processo da Api, servido como arquivo estático (ver <c>Program.cs</c> —
/// <c>app.UseStaticFiles()</c>). Se este projeto um dia rodar atrás de mais
/// de uma instância da Api (load balancer sem disco compartilhado), esta
/// classe precisará trocar de estratégia (ex.: bucket S3-compatível) — fora
/// do escopo desta etapa.
/// </summary>
public sealed class UserPhotoStorage(IWebHostEnvironment environment) : IUserPhotoStorage
{
    // 4 MB já é generoso para uma foto de perfil recortada/comprimida no
    // próprio celular antes do upload (ver mobile: ImagePicker `quality`) —
    // suficiente margem sem deixar alguém enviar um arquivo enorme por engano.
    private const long MaxImageBytes = 4 * 1024 * 1024;

    private static readonly Dictionary<string, string> ExtensionByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
    };

    public async Task<string> SaveAsync(Guid userId, string base64Image, string contentType, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(base64Image))
        {
            throw new InvalidPhotoException("Nenhuma imagem foi enviada.");
        }

        if (!ExtensionByContentType.TryGetValue(contentType, out var extension))
        {
            throw new InvalidPhotoException("Formato de imagem não suportado — envie um JPEG ou PNG.");
        }

        byte[] imageBytes;
        try
        {
            imageBytes = Convert.FromBase64String(base64Image);
        }
        catch (FormatException)
        {
            throw new InvalidPhotoException("A imagem enviada está corrompida ou em um formato inválido.");
        }

        if (imageBytes.Length == 0)
        {
            throw new InvalidPhotoException("A imagem enviada está vazia.");
        }

        if (imageBytes.Length > MaxImageBytes)
        {
            throw new InvalidPhotoException("A imagem não pode ter mais de 4 MB.");
        }

        var folder = PhotosFolder();
        Directory.CreateDirectory(folder);

        // Remove qualquer foto anterior deste usuário antes de gravar a
        // nova — cobre o caso de trocar de extensão (era .png, virou .jpg),
        // que senão deixaria os dois arquivos órfãos lado a lado.
        Delete(userId);

        var filePath = Path.Combine(folder, $"{userId}{extension}");
        await File.WriteAllBytesAsync(filePath, imageBytes, cancellationToken);

        return $"/uploads/user-photos/{userId}{extension}";
    }

    public void Delete(Guid userId)
    {
        var folder = PhotosFolder();
        if (!Directory.Exists(folder))
        {
            return;
        }

        foreach (var existingFile in Directory.EnumerateFiles(folder, $"{userId}.*"))
        {
            File.Delete(existingFile);
        }
    }

    private string PhotosFolder() =>
        Path.Combine(environment.ContentRootPath, "wwwroot", "uploads", "user-photos");
}
