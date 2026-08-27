using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Algoritmo de resolução de "janelas livres (e bloqueadas) numa data" a
/// partir da agenda recorrente + exceções — regra "exceções sobrescrevem a
/// agenda recorrente" da Etapa 07. Extraído de dentro de
/// <c>ProfessionalDirectoryService.ListOpenWindowsAsync</c> (Etapa 17) para
/// cá quando um segundo consumidor apareceu
/// (<see cref="ProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/>,
/// Etapa 19 — "Minha Agenda", que precisa da mesma resolução para VÁRIAS
/// datas de uma vez) — assim os dois nunca podem divergir silenciosamente.
/// `internal`: só usado dentro deste projeto (Professional.Application).
/// </summary>
internal static class OpenWindowResolver
{
    /// <summary>
    /// <paramref name="exceptionsOnDate"/> deve conter só as exceções cuja
    /// <c>Date</c> é <paramref name="date"/> — quem chama já filtra isso
    /// (uma consulta por data, ou um <c>Where</c> em memória sobre todas as
    /// exceções do profissional, ver <see cref="ProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/>).
    /// Devolve as janelas livres E as bloqueadas (a segunda lista existe só
    /// para quem exibe "Bloqueado" como um motivo distinto de simplesmente
    /// "Indisponível" — ver <see cref="BlockedTimeWindowResponse"/>).
    /// </summary>
    public static (List<(TimeOnly Start, TimeOnly End)> Open, List<(TimeOnly Start, TimeOnly End, string? Reason)> Blocked) Resolve(
        DateOnly date,
        IReadOnlyList<ProfessionalAvailability> weeklySchedule,
        IReadOnlyList<ProfessionalAvailabilityException> exceptionsOnDate)
    {
        // Um bloqueio do dia inteiro fecha tudo, não importa a agenda
        // recorrente (mesma regra de ValidateAvailableAsync).
        var fullDayBlock = exceptionsOnDate.FirstOrDefault(
            exception => exception.Type == ProfessionalAvailabilityExceptionType.Blocked && exception.IsFullDay);
        if (fullDayBlock is not null)
        {
            return (
                new List<(TimeOnly, TimeOnly)>(),
                new List<(TimeOnly, TimeOnly, string?)> { (TimeOnly.MinValue, TimeOnly.MaxValue, fullDayBlock.Reason) });
        }

        var windows = weeklySchedule
            .Where(slot => slot.Active && slot.DayOfWeek == date.DayOfWeek && slot.IsEffectiveOn(date))
            .Select(slot => (Start: slot.StartTime, End: slot.EndTime))
            .ToList();

        var blocked = new List<(TimeOnly Start, TimeOnly End, string? Reason)>();

        // Bloqueios pontuais recortam (ou removem) janelas da agenda recorrente.
        foreach (var exception in exceptionsOnDate.Where(
            exception => exception.Type == ProfessionalAvailabilityExceptionType.Blocked && !exception.IsFullDay))
        {
            windows = Subtract(windows, exception.StartTime!.Value, exception.EndTime!.Value);
            blocked.Add((exception.StartTime.Value, exception.EndTime.Value, exception.Reason));
        }

        // Liberações pontuais somam janelas extras, mesmo por cima da agenda
        // recorrente; dia inteiro liberado vira uma única janela cobrindo o
        // dia todo.
        foreach (var opened in exceptionsOnDate.Where(exception => exception.Type == ProfessionalAvailabilityExceptionType.Available))
        {
            windows.Add(opened.IsFullDay ? (TimeOnly.MinValue, TimeOnly.MaxValue) : (opened.StartTime!.Value, opened.EndTime!.Value));
        }

        return (MergeAndSort(windows), blocked);
    }

    /// <summary>Remove [<paramref name="blockStart"/>, <paramref name="blockEnd"/>) de cada janela, recortando ou removendo quem colide (uma janela pode virar duas, se o bloqueio cair no meio dela).</summary>
    private static List<(TimeOnly Start, TimeOnly End)> Subtract(List<(TimeOnly Start, TimeOnly End)> windows, TimeOnly blockStart, TimeOnly blockEnd)
    {
        var result = new List<(TimeOnly Start, TimeOnly End)>();

        foreach (var (start, end) in windows)
        {
            if (blockEnd <= start || blockStart >= end)
            {
                result.Add((start, end));
                continue;
            }

            if (blockStart > start)
            {
                result.Add((start, blockStart));
            }

            if (blockEnd < end)
            {
                result.Add((blockEnd, end));
            }
        }

        return result;
    }

    /// <summary>Ordena por início e funde janelas sobrepostas/adjacentes (pode acontecer quando uma liberação pontual soma em cima de um trecho já recorrente) — devolve uma lista "limpa", sem sobreposição, pronta para exibição.</summary>
    private static List<(TimeOnly Start, TimeOnly End)> MergeAndSort(List<(TimeOnly Start, TimeOnly End)> windows)
    {
        if (windows.Count == 0)
        {
            return windows;
        }

        var sorted = windows.OrderBy(window => window.Start).ToList();
        var merged = new List<(TimeOnly Start, TimeOnly End)> { sorted[0] };

        foreach (var current in sorted.Skip(1))
        {
            var last = merged[^1];
            if (current.Start <= last.End)
            {
                merged[^1] = (last.Start, current.End > last.End ? current.End : last.End);
            }
            else
            {
                merged.Add(current);
            }
        }

        return merged;
    }
}
