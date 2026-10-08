import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("server-only", () => ({}));

const { SecretSantaHome } = await import("@/components/secret-santa/SecretSantaHome");
const { NewGroupWizard } = await import("@/components/secret-santa/NewGroupWizard");
const { AnonymousChat } = await import("@/components/secret-santa/AnonymousChat");
const { RestrictionsEditor } = await import("@/components/secret-santa/RestrictionsEditor");
const { SecretSantaHomeCard } = await import("@/components/secret-santa/SecretSantaHomeCard");

const calls: Array<{ url: string; method: string; body?: unknown }> = [];
let responses: Record<string, unknown> = {};

beforeEach(() => {
  calls.length = 0;
  responses = {};
  global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(responses).find((k) => u.includes(k));
    return { ok: true, json: async () => ({ data: key ? responses[key] : { notifications: [] } }) } as Response;
  }) as unknown as typeof fetch;
});

describe("Amigo Secreto (telas, mobile-first)", () => {
  it("dashboard: abas Meus grupos / Concluídos / Convites e botão + Criar amigo secreto", async () => {
    render(
      <SecretSantaHome
        data={{
          active: [{ id: "g1", name: "Amigo Secreto Família", eventDate: "2026-12-24", status: "DRAWN", isOwner: true, participantCount: 8, acceptedCount: 8 }],
          completed: [],
          invites: [{ token: "t".repeat(40), groupName: "Trabalho", eventDate: null, ownerName: "Ana" }],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Criar amigo secreto/ })).toHaveAttribute("href", "/amigo-secreto/novo");
    expect(screen.getByText("Amigo Secreto Família")).toBeInTheDocument();
    expect(screen.getByText("Sorteio realizado")).toBeInTheDocument();
    expect(screen.getByText(/8 participantes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Convites/ }));
    expect(screen.getByText("Trabalho")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trabalho/ })).toHaveAttribute("href", `/amigo-secreto/convite/${"t".repeat(40)}`);
    await waitFor(() => expect(calls.some((c) => c.url.includes("/notifications"))).toBe(true));
  });

  it("card da home descreve o módulo e oferece os atalhos", () => {
    render(<SecretSantaHomeCard />);
    expect(screen.getByText("Crie seu amigo secreto, faça o sorteio, compartilhe desejos e converse anonimamente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Criar amigo secreto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus grupos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Convites" })).toBeInTheDocument();
  });

  it("assistente de criação: valida o nome, avança as etapas e cria o grupo com os participantes", async () => {
    responses = { "/groups/g9": { inviteToken: "k".repeat(40), participants: [{ id: "p1", name: "Eu", status: "ACCEPTED" }], restrictions: [] }, "/api/secret-santa/groups": { id: "g9" } };
    render(<NewGroupWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Dê um nome ao grupo.");
    fireEvent.change(screen.getByLabelText(/Nome do grupo/), { target: { value: "Natal 2026" } });
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Etapa 5 de 7: Participantes/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Bruno" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pessoa" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    await waitFor(() => expect(screen.getByText(/Etapa 6 de 7: Restrições/)).toBeInTheDocument());
    const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/secret-santa/groups"))!;
    expect(create.body).toMatchObject({ name: "Natal 2026", allowOwnerSeeDraw: false, participants: [{ name: "Bruno" }] });
    expect(screen.getByText("Quem não pode tirar quem")).toBeInTheDocument();
  });

  it("chat do sorteado: rótulo fixo 'Seu amigo secreto', sem identidade", async () => {
    responses = {
      "/conversation": { enabled: true, asGiver: null, asReceiver: { canWrite: true, messages: [{ id: "m1", mine: false, body: "Qual a sua cor favorita?", createdAt: "2026-12-01T10:00:00Z" }] } },
    };
    render(<AnonymousChat groupId="g1" as="RECEIVER" />);
    await waitFor(() => expect(screen.getByText("Qual a sua cor favorita?")).toBeInTheDocument());
    expect(screen.getByText("Seu amigo secreto")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Responder ao seu amigo secreto/), { target: { value: "Azul!" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && JSON.stringify(c.body) === JSON.stringify({ as: "RECEIVER", body: "Azul!" }))).toBe(true));
  });

  it("chat sem mensagens do amigo mostra o aviso de contato anônimo", async () => {
    responses = { "/conversation": { enabled: true, asGiver: null, asReceiver: { canWrite: false, messages: [] } } };
    render(<AnonymousChat groupId="g1" as="RECEIVER" />);
    expect(await screen.findByText("Seu amigo secreto pode entrar em contato anonimamente com você.")).toBeInTheDocument();
  });

  it("restrições: casal exige duas pessoas e envia o par em mão dupla", async () => {
    const onChanged = vi.fn();
    render(
      <RestrictionsEditor
        groupId="g1"
        people={[
          { id: "a", name: "Ana", status: "ACCEPTED" },
          { id: "b", name: "Bruno", status: "ACCEPTED" },
          { id: "c", name: "Carla", status: "ACCEPTED" },
        ]}
        restrictions={[{ id: "r1", participantId: "a", cannotDrawParticipantId: "b", reason: null }]}
        onChanged={onChanged}
        locked={false}
      />,
    );
    expect(screen.getByText(/Ana/, { selector: "li span" })).toHaveTextContent("Ana não tira Bruno");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar restrição" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha exatamente duas pessoas.");
    fireEvent.click(screen.getByLabelText("Ana"));
    fireEvent.click(screen.getByLabelText("Carla"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar restrição" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ fromIds: ["a"], toIds: ["c"], bothWays: true });
  });
});
