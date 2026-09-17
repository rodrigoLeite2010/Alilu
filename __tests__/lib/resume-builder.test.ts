import { describe, expect, it } from "vitest";
import {
  buildResumeText,
  validateResumeInput,
  isResumeInputValid,
  emptyResumeInput,
} from "@/lib/calculators/resume-builder";

describe("resume-builder", () => {
  it("monta um currículo simples com nome, headline e contato", () => {
    const input = {
      ...emptyResumeInput(),
      fullName: "Maria Silva",
      headline: "Desenvolvedora Front-end",
      email: "maria@example.com",
      phone: "(11) 91234-5678",
      city: "São Paulo, SP",
    };

    const text = buildResumeText(input);
    expect(text).toContain("Maria Silva");
    expect(text).toContain("Desenvolvedora Front-end");
    expect(text).toContain("maria@example.com");
  });

  it("inclui seções de experiência, formação e habilidades quando preenchidas", () => {
    const input = {
      ...emptyResumeInput(),
      fullName: "João Souza",
      experiences: [
        { role: "Analista", company: "Empresa X", period: "2020-2022", description: "Fez coisas." },
      ],
      education: [{ course: "ADS", institution: "Faculdade Y", period: "2018-2020" }],
      skills: ["JavaScript", "React"],
    };

    const text = buildResumeText(input);
    expect(text).toContain("EXPERIÊNCIA PROFISSIONAL");
    expect(text).toContain("Analista — Empresa X (2020-2022)");
    expect(text).toContain("FORMAÇÃO ACADÊMICA");
    expect(text).toContain("HABILIDADES");
    expect(text).toContain("JavaScript, React");
  });

  it("omite seções vazias", () => {
    const input = { ...emptyResumeInput(), fullName: "Ana" };
    const text = buildResumeText(input);
    expect(text).not.toContain("EXPERIÊNCIA PROFISSIONAL");
    expect(text).not.toContain("FORMAÇÃO ACADÊMICA");
    expect(text).not.toContain("HABILIDADES");
  });

  it("exige o nome completo", () => {
    expect(validateResumeInput(emptyResumeInput()).fullName).toBeDefined();
    expect(isResumeInputValid({ ...emptyResumeInput(), fullName: "Ana" })).toBe(true);
  });
});
