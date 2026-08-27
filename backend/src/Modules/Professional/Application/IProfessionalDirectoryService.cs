namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Diretório público de profissionais/categorias (PROMPT 06, React Native
/// para o morador: ProfessionalListScreen/ServiceCategoryScreen/
/// ProfessionalProfileScreen — "listar profissionais; filtrar categoria;
/// visualizar perfil") — self-service, sem checagem de papel
/// administrativo, mesmo espírito de
/// <c>Alilu.Modules.Condominium.Application.ICondominiumDirectoryService</c>.
///
/// Só devolve perfis <see cref="Domain.ProfessionalStatus.Active"/> — um
/// perfil desativado não deve aparecer na busca do morador.
/// </summary>
public interface IProfessionalDirectoryService
{
    Task<IReadOnlyList<ServiceCategoryResponse>> ListCategoriesAsync(CancellationToken cancellationToken = default);

    /// <summary>Lista profissionais ativos; quando <paramref name="serviceCategoryId"/> é informado, filtra só quem oferece aquela categoria (React Native: "filtrar categoria").</summary>
    Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ListProfessionalsAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default);

    /// <summary>React Native: "visualizar perfil". Devolve <c>null</c> quando o perfil não existe ou não está mais ativo.</summary>
    Task<ProfessionalDirectoryItemResponse?> GetProfessionalProfileAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirma que o profissional atende <paramref name="condominiumId"/>
    /// (vínculo <see cref="Domain.ProfessionalCondominiumStatus.Active"/>) —
    /// chamada pela Api (módulo Scheduling, PROMPT 08) antes de deixar um
    /// morador criar um agendamento ("profissional deve atender o
    /// condomínio", REGRA CRÍTICA do prompt). Lança
    /// <see cref="ProfessionalDoesNotAttendCondominiumException"/> quando
    /// não há vínculo Active para esse condomínio.
    /// </summary>
    Task ValidateAttendsCondominiumAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolve a disponibilidade efetiva do profissional na janela
    /// [<paramref name="startTime"/>, <paramref name="endTime"/>) de
    /// <paramref name="date"/> — aplica "exceções sobrescrevem a agenda
    /// recorrente" (regra da Etapa 07, resolução implementada aqui, pela
    /// primeira vez consumida por um módulo de agenda/reservas — ver
    /// ARCHITECTURE.md). Chamada pela Api (módulo Scheduling, PROMPT 08)
    /// antes de deixar um morador criar um agendamento ("o horário deve
    /// estar disponível" / "nunca confiar no calendário do React Native",
    /// REGRAS CRÍTICAS do prompt — esta é a checagem do lado do servidor).
    /// Lança <see cref="Alilu.Modules.Professional.Application.ProfessionalNotFoundException"/>
    /// quando o perfil não existe/não está mais ativo, e
    /// <see cref="TimeSlotUnavailableException"/> quando o horário não está
    /// disponível.
    /// </summary>
    Task ValidateAvailableAsync(Guid professionalId, DateOnly date, TimeOnly startTime, TimeOnly endTime, CancellationToken cancellationToken = default);

    /// <summary>
    /// Todas as janelas em que o profissional está aberto em
    /// <paramref name="date"/> — mesma resolução de
    /// <see cref="ValidateAvailableAsync"/> ("exceções sobrescrevem a
    /// agenda recorrente"), só que devolvendo as janelas em vez de validar
    /// uma janela específica pedida pelo morador.
    ///
    /// Decisão atualizada (pedido explícito de produto, depois de testar o
    /// fluxo ponta a ponta): a Etapa 08 original decidiu, de propósito,
    /// NUNCA expor a agenda do profissional — o morador digitava um
    /// horário candidato e só descobria se era válido tentando (ver
    /// <c>ProfessionalDirectoryController</c>, método removido
    /// <c>CheckAvailability</c>). Na prática isso virou "ficar tentando
    /// hora em hora até acertar" — pior experiência do que o risco de
    /// privacidade que a decisão original evitava (a agenda de um
    /// profissional autônomo não é um dado sensível como a de um morador).
    /// Por isso este método agora existe e o antigo <c>availability-check</c>
    /// foi removido (ver ARCHITECTURE.md).
    ///
    /// NÃO considera agendamentos já feitos (módulo Scheduling, que este
    /// módulo não pode referenciar) — é a Api quem subtrai isso (ver
    /// <c>Alilu.Modules.Scheduling.Application.IBookingService.ListBookedWindowsAsync</c>
    /// e <c>ProfessionalDirectoryController.ListAvailabilityWindows</c>).
    /// Lança <see cref="ProfessionalNotFoundException"/> quando o perfil
    /// não existe/não está mais ativo.
    /// </summary>
    Task<IReadOnlyList<OpenTimeWindowResponse>> ListOpenWindowsAsync(Guid professionalId, DateOnly date, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ponto de extensão para o módulo Notifications (Etapa 11) — resolve o
    /// <c>User.Id</c> (Identity) dono deste perfil profissional, para a Api
    /// poder notificá-lo (ex.: "novo agendamento", "nova avaliação"). Não
    /// exposto em <see cref="ProfessionalDirectoryItemResponse"/> (DTO
    /// público do diretório) de propósito — <c>UserId</c> não é informação
    /// que o morador precisa ver, só a Api, internamente, para compor a
    /// notificação. Lança <see cref="ProfessionalNotFoundException"/>
    /// quando o perfil não existe/não está mais ativo.
    /// </summary>
    Task<Guid> GetProfessionalUserIdAsync(Guid professionalId, CancellationToken cancellationToken = default);
}
