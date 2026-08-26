/** Espelha `Alilu.Modules.Administration.Application/Dtos.cs`/`AdminDashboardController.cs` do backend. */
export interface CondominiumAdministrator {
  id: string;
  userId: string;
  condominiumId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboard {
  condominiumId: string;
  moradores: number;
  unidades: number;
  profissionais: number;
  agendamentos: number;
  solicitacoesPendentes: number;
  recomendacoesPendentes: number;
}
