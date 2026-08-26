/** Espelha `Alilu.Modules.Condominium.Application/Dtos.cs` e `Domain/UnitType.cs`/`UnitStatus.cs`. */
export type UnitType = 'Apartment' | 'House' | 'Commercial';
export type UnitStatus = 'Active' | 'Inactive';
export type CondominiumStatus = 'Active' | 'Inactive';

export interface Condominium {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  status: CondominiumStatus;
  createdAt: string;
}

export interface CondominiumUnit {
  id: string;
  condominiumId: string;
  code: string;
  type: UnitType;
  status: UnitStatus;
  createdAt: string;
}

export interface CreateUnitPayload {
  code: string;
  type: UnitType;
}

export interface EditUnitPayload {
  code: string;
  type: UnitType;
}
