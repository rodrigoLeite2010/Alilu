/**
 * Aviso de privacidade padrão para toda ferramenta da categoria
 * Validadores: a validação é 100% local (no navegador), nada digitado é
 * armazenado, enviado a um servidor, registrado em log/console/analytics
 * ou salvo em localStorage/sessionStorage (PROMPT MESTRE Validadores,
 * seção "Segurança e privacidade").
 */
export function ValidatorPrivacyNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
      Esta validação acontece inteiramente no seu navegador: o valor
      digitado não é armazenado, enviado a nenhum servidor nem registrado em
      log. {children}
    </div>
  );
}
