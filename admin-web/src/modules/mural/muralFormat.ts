import type { MuralPostType } from './types';

/** Rótulos PT-BR (React: MuralPage) — mesmo padrão de `utils/statusLabels.ts#translateStatus`, mas próprio deste módulo porque os valores de `MuralPostType` não são um "status" (são a categoria do post). */
export const MURAL_POST_TYPE_LABEL: Record<MuralPostType, string> = {
  Complaint: 'Reclamação',
  Suggestion: 'Sugestão',
  Warning: 'Aviso',
  UnregisteredProfessional: 'Prestador não cadastrado',
};
