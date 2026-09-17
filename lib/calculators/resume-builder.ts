/**
 * Montagem de um currículo (CV) simples a partir dos dados REAIS que a
 * pessoa preencher — categoria Geradores, mas diferente dos demais
 * arquivos deste diretório: aqui não há nenhum dado sintético nem
 * aleatório. Segue o mesmo princípio de privacidade do Gerador de Recibo
 * e do Gerador de Orçamento (lib/receipt e lib/quote): todo o
 * processamento acontece no navegador da pessoa, e nada do que ela digita
 * é enviado, salvo ou registrado em log pela Alilu.
 *
 * Mantido isolado da interface (PROMPT MESTRE, seção 14): este arquivo só
 * monta o texto final do currículo a partir do formulário — a
 * apresentação (impressão/PDF) fica no componente.
 */

export const RESUME_MAX_EXPERIENCES = 10;
export const RESUME_MAX_EDUCATION = 6;
export const RESUME_MAX_SKILLS = 30;

export interface ResumeExperience {
  role: string;
  company: string;
  period: string;
  description: string;
}

export interface ResumeEducation {
  course: string;
  institution: string;
  period: string;
}

export interface ResumeInput {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  experiences: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
}

export interface ResumeFieldErrors {
  fullName?: string;
}

export function validateResumeInput(input: ResumeInput): ResumeFieldErrors {
  const errors: ResumeFieldErrors = {};

  if (!input.fullName || input.fullName.trim().length === 0) {
    errors.fullName = "Informe seu nome completo.";
  }

  return errors;
}

export function isResumeInputValid(input: ResumeInput): boolean {
  return Object.keys(validateResumeInput(input)).length === 0;
}

/** Monta o texto simples do currículo (usado para a opção "Copiar como texto"). */
export function buildResumeText(input: ResumeInput): string {
  const lines: string[] = [];

  lines.push(input.fullName.trim());
  if (input.headline.trim()) lines.push(input.headline.trim());

  const contactLine = [input.email, input.phone, input.city].filter((value) => value.trim()).join(" · ");
  if (contactLine) lines.push(contactLine);

  if (input.summary.trim()) {
    lines.push("");
    lines.push("RESUMO");
    lines.push(input.summary.trim());
  }

  const experiences = input.experiences.filter((exp) => exp.role.trim() || exp.company.trim());
  if (experiences.length > 0) {
    lines.push("");
    lines.push("EXPERIÊNCIA PROFISSIONAL");
    for (const exp of experiences) {
      const header = [exp.role, exp.company].filter(Boolean).join(" — ");
      lines.push(exp.period ? `${header} (${exp.period})` : header);
      if (exp.description.trim()) lines.push(exp.description.trim());
    }
  }

  const education = input.education.filter((edu) => edu.course.trim() || edu.institution.trim());
  if (education.length > 0) {
    lines.push("");
    lines.push("FORMAÇÃO ACADÊMICA");
    for (const edu of education) {
      const header = [edu.course, edu.institution].filter(Boolean).join(" — ");
      lines.push(edu.period ? `${header} (${edu.period})` : header);
    }
  }

  const skills = input.skills.filter((skill) => skill.trim());
  if (skills.length > 0) {
    lines.push("");
    lines.push("HABILIDADES");
    lines.push(skills.join(", "));
  }

  return lines.join("\n");
}

export function emptyResumeInput(): ResumeInput {
  return {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    city: "",
    summary: "",
    experiences: [],
    education: [],
    skills: [],
  };
}
