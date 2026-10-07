import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DAYS_OF_WEEK } from "@/lib/content-automation/backend/automation-types";
import { formatDaysSummary, suggestNextTime } from "@/lib/content-automation/shared-schedule";
import {
  SharedPromptEditor,
  emptySharedContent,
  sharedContentPayload,
  sharedScheduleError,
  type SharedScheduleState,
} from "@/components/instagram/content-automation/SharedPromptEditor";

vi.mock("@/components/instagram/content-automation/MediaPicker", () => ({ MediaPicker: () => null }));

function Harness({ initial }: { initial?: Partial<SharedScheduleState> }) {
  const [content, setContent] = useState({ ...emptySharedContent(), prompt: "Crie uma reflexão motivacional." });
  const [schedule, setSchedule] = useState<SharedScheduleState>({
    days: [...DAYS_OF_WEEK],
    times: ["08:00", "12:00", "19:00"],
    ...initial,
  });
  return (
    <SharedPromptEditor
      userId="user-1"
      content={content}
      onContentChange={(patch) => setContent((current) => ({ ...current, ...patch }))}
      schedule={schedule}
      onScheduleChange={setSchedule}
      imageMode="FIXED_IMAGE"
    />
  );
}

describe("regras puras do formulário compartilhado", () => {
  it("resume os dias de forma legível", () => {
    expect(formatDaysSummary([...DAYS_OF_WEEK])).toBe("Todos os dias");
    expect(formatDaysSummary(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])).toBe("Segunda a sexta");
    expect(formatDaysSummary(["MONDAY", "WEDNESDAY", "FRIDAY"])).toBe("Seg, Qua e Sex");
    expect(formatDaysSummary(["SUNDAY"])).toBe("Domingo");
  });

  it("valida a agenda como o servidor e sugere um horário livre", () => {
    expect(sharedScheduleError({ days: [], times: ["08:00"] })).toMatch(/pelo menos um dia/);
    expect(sharedScheduleError({ days: ["MONDAY"], times: [] })).toMatch(/pelo menos um horário/);
    expect(sharedScheduleError({ days: ["MONDAY"], times: ["08:00", "08:00"] })).toMatch(/repetido/);
    expect(sharedScheduleError({ days: ["MONDAY"], times: ["08:00", "12:00"] })).toBeNull();
    expect(suggestNextTime(["08:00", "12:00"])).toBe("19:00");
  });

  it("monta o conteúdo para a API sem dia nem horário", () => {
    const payload = sharedContentPayload({ ...emptySharedContent(), prompt: "x" });
    expect(payload).toMatchObject({ contentType: "POST", contentMode: "AI", prompt: "x" });
    expect(payload).not.toHaveProperty("publishTime");
    expect(payload).not.toHaveProperty("dayOfWeek");
  });
});

describe("SharedPromptEditor", () => {
  it("mostra o resumo com o total de execuções (7 dias × 3 horários = 21)", () => {
    render(<Harness />);
    const summary = screen.getByRole("region", { name: "Resumo da automação" });
    expect(within(summary).getByText("Todos os dias")).toBeInTheDocument();
    expect(within(summary).getByText("21 execuções por semana")).toBeInTheDocument();
    expect(within(summary).getByText(/Crie uma reflexão motivacional\./)).toBeInTheDocument();
  });

  it("não pede dia nem horário dentro do card do conteúdo", () => {
    render(<Harness />);
    expect(screen.queryByText("Publicar neste dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Horário de publicação")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
  });

  it("alterna dias e usa Limpar / Selecionar todos", () => {
    render(<Harness />);
    const monday = screen.getByRole("button", { name: "Segunda-feira" });
    expect(monday).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(monday);
    expect(monday).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("18 execuções por semana")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos" }));
    expect(screen.getByText("21 execuções por semana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText(/Escolha pelo menos um dia/)).toBeInTheDocument();
  });

  it("adiciona e remove horários, e nunca deixa remover o último", () => {
    render(<Harness initial={{ times: ["08:00"] }} />);
    expect(screen.getByRole("button", { name: /Remover horário 08:00/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar horário" }));
    expect(screen.getByLabelText("Horário 2")).toHaveValue("12:00");
    expect(screen.getByText("14 execuções por semana")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remover horário 12:00/ }));
    expect(screen.queryByLabelText("Horário 2")).not.toBeInTheDocument();
    expect(screen.getByText("7 execuções por semana")).toBeInTheDocument();
  });

  it("avisa de horário repetido", () => {
    render(<Harness initial={{ times: ["08:00", "12:00"] }} />);
    fireEvent.change(screen.getByLabelText("Horário 2"), { target: { value: "08:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Não repita horários: 08:00");
  });

  it("mostra a ação principal numa barra com o total semanal (usada no celular)", () => {
    render(
      <SharedPromptEditor
        userId="user-1"
        content={{ ...emptySharedContent(), prompt: "x" }}
        onContentChange={() => undefined}
        schedule={{ days: ["MONDAY", "FRIDAY"], times: ["08:00"] }}
        onScheduleChange={() => undefined}
        imageMode="FIXED_IMAGE"
        footer={<button type="button">Salvar prompt e agenda</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Salvar prompt e agenda" })).toBeInTheDocument();
    expect(screen.getByText("2 execuções/semana")).toBeInTheDocument();
  });
});
