// @vitest-environment node
// Exclusão em massa da biblioteca: mesma regra da individual, item a item;
// o que é usado em publicação/automação é mantido e explicado.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: null as null | { user: { id: string } } }));
vi.mock("@/auth", () => ({ auth: async () => session.value }));

const deleteMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content-automation/backend/media-delete-service", () => {
  class MediaDeletionError extends Error {}
  return { deleteMediaForUser: deleteMock, MediaDeletionError };
});

const route = await import("@/app/api/content-automation/media/bulk-delete/route");
const { MediaDeletionError } = await import("@/lib/content-automation/backend/media-delete-service");

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

function post(body: unknown) {
  return route.POST(new Request("https://x/api/content-automation/media/bulk-delete", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  deleteMock.mockReset();
  session.value = { user: { id: "user-1" } };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/content-automation/media/bulk-delete", () => {
  it("sem login: 401", async () => {
    session.value = null;
    expect((await post({ ids: [A] })).status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("apaga as livres e mantém as usadas em publicação, sempre com o usuário da sessão", async () => {
    deleteMock.mockImplementation(async (id: string) => {
      if (id === B) throw new MediaDeletionError("Essa mídia já foi usada em uma publicação e não pode ser apagada.");
    });
    const response = await post({ ids: [A, B, C, A, "lixo"] });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deleted).toEqual([A, C]);
    expect(body.kept).toEqual([{ id: B, reason: expect.stringContaining("publicação") }]);
    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteMock.mock.calls.every(([, userId]) => userId === "user-1")).toBe(true);
  });

  it("erro inesperado em uma não derruba as outras", async () => {
    deleteMock.mockImplementation(async (id: string) => {
      if (id === A) throw new Error("blob fora");
    });
    const body = await (await post({ ids: [A, B] })).json();
    expect(body.deleted).toEqual([B]);
    expect(body.kept[0].id).toBe(A);
  });

  it("valida a lista", async () => {
    expect((await post({ ids: [] })).status).toBe(400);
    expect((await post({ ids: Array.from({ length: 201 }, (_, i) => `${String(i).padStart(8, "0")}-1111-1111-1111-111111111111`) })).status).toBe(400);
  });
});
