"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import {
  buildResumeText,
  validateResumeInput,
  emptyResumeInput,
  RESUME_MAX_EXPERIENCES,
  RESUME_MAX_EDUCATION,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeFieldErrors,
  type ResumeInput,
} from "@/lib/calculators/resume-builder";

type FormState = Omit<ResumeInput, "skills"> & { skillsText: string };

function emptyFormState(): FormState {
  return { ...emptyResumeInput(), skillsText: "" };
}

/**
 * Componente principal do Gerador de Currículo (categoria Geradores).
 * Diferente dos demais geradores deste diretório, aqui NÃO há nenhum dado
 * sintético: a pessoa preenche seus próprios dados reais e a ferramenta só
 * monta e formata o currículo. Todo o processamento acontece no navegador
 * — nada do que é digitado é enviado, salvo em cookies ou em
 * localStorage/sessionStorage, ou registrado em log pela Alilu (mesmo
 * princípio do Gerador de Recibo e do Gerador de Orçamento).
 */
export function ResumeBuilderTool() {
  const [form, setForm] = useState<FormState>(emptyFormState());
  const [errors, setErrors] = useState<ResumeFieldErrors>({});
  const [resume, setResume] = useState<ResumeInput | null>(null);
  const [copied, setCopied] = useState(false);

  function updateExperience(index: number, patch: Partial<ResumeExperience>) {
    setForm((current) => ({
      ...current,
      experiences: current.experiences.map((exp, i) => (i === index ? { ...exp, ...patch } : exp)),
    }));
  }

  function updateEducation(index: number, patch: Partial<ResumeEducation>) {
    setForm((current) => ({
      ...current,
      education: current.education.map((edu, i) => (i === index ? { ...edu, ...patch } : edu)),
    }));
  }

  function addExperience() {
    setForm((current) =>
      current.experiences.length >= RESUME_MAX_EXPERIENCES
        ? current
        : {
            ...current,
            experiences: [...current.experiences, { role: "", company: "", period: "", description: "" }],
          }
    );
  }

  function addEducation() {
    setForm((current) =>
      current.education.length >= RESUME_MAX_EDUCATION
        ? current
        : { ...current, education: [...current.education, { course: "", institution: "", period: "" }] }
    );
  }

  function removeExperience(index: number) {
    setForm((current) => ({ ...current, experiences: current.experiences.filter((_, i) => i !== index) }));
  }

  function removeEducation(index: number) {
    setForm((current) => ({ ...current, education: current.education.filter((_, i) => i !== index) }));
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: ResumeInput = {
      fullName: form.fullName,
      headline: form.headline,
      email: form.email,
      phone: form.phone,
      city: form.city,
      summary: form.summary,
      experiences: form.experiences,
      education: form.education,
      skills: form.skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    };

    const nextErrors = validateResumeInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResume(null);
      return;
    }

    setResume(input);
  }

  if (resume) {
    return (
      <div>
        <div
          id="resume-preview"
          className="mx-auto max-w-2xl rounded-xl border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <h2 className="text-2xl font-bold text-zinc-900">{resume.fullName}</h2>
          {resume.headline ? <p className="mt-1 text-base text-zinc-600">{resume.headline}</p> : null}
          {[resume.email, resume.phone, resume.city].filter(Boolean).length > 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              {[resume.email, resume.phone, resume.city].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {resume.summary ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-800">Resumo</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">{resume.summary}</p>
            </div>
          ) : null}

          {resume.experiences.some((exp) => exp.role || exp.company) ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                Experiência profissional
              </h3>
              <div className="mt-2 space-y-4">
                {resume.experiences
                  .filter((exp) => exp.role || exp.company)
                  .map((exp, index) => (
                    <div key={index}>
                      <p className="text-sm font-medium text-zinc-900">
                        {[exp.role, exp.company].filter(Boolean).join(" — ")}
                        {exp.period ? <span className="font-normal text-zinc-500"> ({exp.period})</span> : null}
                      </p>
                      {exp.description ? (
                        <p className="mt-1 text-sm text-zinc-700">{exp.description}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {resume.education.some((edu) => edu.course || edu.institution) ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                Formação acadêmica
              </h3>
              <div className="mt-2 space-y-2">
                {resume.education
                  .filter((edu) => edu.course || edu.institution)
                  .map((edu, index) => (
                    <p key={index} className="text-sm text-zinc-800">
                      {[edu.course, edu.institution].filter(Boolean).join(" — ")}
                      {edu.period ? <span className="text-zinc-500"> ({edu.period})</span> : null}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}

          {resume.skills.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-800">Habilidades</h3>
              <p className="mt-2 text-sm text-zinc-800">{resume.skills.join(", ")}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
          <Button type="button" onClick={() => window.print()}>
            Imprimir / Salvar PDF
          </Button>
          <Button type="button" variant="secondary" onClick={() => copyText(buildResumeText(resume))}>
            Copiar como texto
          </Button>
          <Button type="button" variant="ghost" onClick={() => setResume(null)}>
            Editar currículo
          </Button>
          {copied ? (
            <span role="status" className="text-sm text-emerald-600">
              Currículo copiado como texto!
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        Preencha seus próprios dados abaixo. Todo o processamento acontece
        no seu navegador — nada do que você digita é enviado ou armazenado
        pela Alilu.
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="resume-full-name"
          label="Nome completo"
          value={form.fullName}
          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
          error={errors.fullName}
        />
        <TextField
          id="resume-headline"
          label="Título profissional"
          placeholder="Ex.: Desenvolvedora Front-end"
          value={form.headline}
          onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <TextField
          id="resume-email"
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        <TextField
          id="resume-phone"
          label="Telefone"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <TextField
          id="resume-city"
          label="Cidade / Estado"
          value={form.city}
          onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
        />
      </div>

      <TextareaField
        id="resume-summary"
        label="Resumo profissional"
        hint="Opcional."
        value={form.summary}
        onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">Experiência profissional</h3>
        <div className="space-y-4">
          {form.experiences.map((exp, index) => (
            <div key={index} className="rounded-lg border border-zinc-200 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  id={`resume-exp-role-${index}`}
                  label="Cargo"
                  value={exp.role}
                  onChange={(event) => updateExperience(index, { role: event.target.value })}
                />
                <TextField
                  id={`resume-exp-company-${index}`}
                  label="Empresa"
                  value={exp.company}
                  onChange={(event) => updateExperience(index, { company: event.target.value })}
                />
                <TextField
                  id={`resume-exp-period-${index}`}
                  label="Período"
                  placeholder="Ex.: 2020 - 2022"
                  value={exp.period}
                  onChange={(event) => updateExperience(index, { period: event.target.value })}
                />
              </div>
              <TextareaField
                id={`resume-exp-description-${index}`}
                label="Descrição"
                className="mt-4"
                hint="Opcional."
                value={exp.description}
                onChange={(event) => updateExperience(index, { description: event.target.value })}
              />
              <button
                type="button"
                onClick={() => removeExperience(index)}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-800"
              >
                Remover experiência
              </button>
            </div>
          ))}
        </div>
        {form.experiences.length < RESUME_MAX_EXPERIENCES ? (
          <Button type="button" variant="secondary" className="mt-3" onClick={addExperience}>
            Adicionar experiência
          </Button>
        ) : null}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">Formação acadêmica</h3>
        <div className="space-y-4">
          {form.education.map((edu, index) => (
            <div key={index} className="rounded-lg border border-zinc-200 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  id={`resume-edu-course-${index}`}
                  label="Curso"
                  value={edu.course}
                  onChange={(event) => updateEducation(index, { course: event.target.value })}
                />
                <TextField
                  id={`resume-edu-institution-${index}`}
                  label="Instituição"
                  value={edu.institution}
                  onChange={(event) => updateEducation(index, { institution: event.target.value })}
                />
                <TextField
                  id={`resume-edu-period-${index}`}
                  label="Período"
                  placeholder="Ex.: 2018 - 2020"
                  value={edu.period}
                  onChange={(event) => updateEducation(index, { period: event.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeEducation(index)}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-800"
              >
                Remover formação
              </button>
            </div>
          ))}
        </div>
        {form.education.length < RESUME_MAX_EDUCATION ? (
          <Button type="button" variant="secondary" className="mt-3" onClick={addEducation}>
            Adicionar formação
          </Button>
        ) : null}
      </div>

      <TextField
        id="resume-skills"
        label="Habilidades"
        hint="Separe por vírgula. Ex.: JavaScript, React, Comunicação"
        value={form.skillsText}
        onChange={(event) => setForm((current) => ({ ...current, skillsText: event.target.value }))}
      />

      <Button type="submit" className="w-full sm:w-auto">
        Gerar currículo
      </Button>
    </form>
  );
}
