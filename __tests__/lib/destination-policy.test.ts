import { describe, expect, it } from "vitest";
import {
  evaluateFacebookDestination,
  initialFacebookSelection,
  readProfileUpdate,
  selectablePagesFor,
  type DestinationProfilePolicy,
  type PolicyPage,
} from "@/lib/facebook/destination-policy";

const page = (overrides: Partial<PolicyPage> = {}): PolicyPage => ({
  id: "page-ref-alilu",
  userId: "u1",
  pageId: "fb-alilu",
  status: "connected",
  hasToken: true,
  instagramAccountId: "acc-alilu",
  ...overrides,
});
const base = { userId: "u1", instagramAccountId: "acc-alilu", requestedPageRef: "page-ref-alilu", source: "manual" as const, profile: null };
const disabled: DestinationProfilePolicy = { instagramAccountId: "acc-setabom", facebookEnabled: false, allowedFacebookPageRefs: [], defaultFacebookPageRefs: [] };

describe("evaluateFacebookDestination", () => {
  it("permite a escolha explícita de uma Página da própria conta", () => {
    expect(evaluateFacebookDestination({ ...base, page: page() })).toEqual({ allowed: true });
  });

  it("nega Página inexistente, de outro usuário ou com id externo divergente", () => {
    expect(evaluateFacebookDestination({ ...base, page: null })).toMatchObject({ allowed: false, reason: "page_not_found" });
    expect(evaluateFacebookDestination({ ...base, page: page({ userId: "u2" }) })).toMatchObject({ reason: "page_owner_mismatch" });
    expect(evaluateFacebookDestination({ ...base, page: page(), externalAccountId: "fb-outra" })).toMatchObject({ reason: "page_id_mismatch" });
  });

  it("perfil com Facebook desativado nega tudo (Se Tá Bom Pra Você)", () => {
    const result = evaluateFacebookDestination({ ...base, instagramAccountId: "acc-setabom", page: page({ instagramAccountId: "acc-setabom" }), profile: disabled });
    expect(result).toMatchObject({ allowed: false, reason: "facebook_disabled_for_account" });
  });

  it("perfil ativo só aceita as Páginas permitidas", () => {
    const profile: DestinationProfilePolicy = { instagramAccountId: "acc-gta", facebookEnabled: true, allowedFacebookPageRefs: ["page-ref-gta"], defaultFacebookPageRefs: [] };
    expect(evaluateFacebookDestination({ ...base, instagramAccountId: "acc-gta", page: page(), profile })).toMatchObject({ reason: "page_not_allowed_for_account" });
  });

  it("sem perfil: Página vinculada a OUTRA conta é negada; destino do antigo modo Automático é negado", () => {
    expect(evaluateFacebookDestination({ ...base, instagramAccountId: "acc-gta", page: page() })).toMatchObject({ reason: "page_linked_to_other_account" });
    expect(evaluateFacebookDestination({ ...base, page: page(), source: "automation_auto_legacy" })).toMatchObject({ reason: "implicit_selection" });
  });

  it("Página desconectada só é barrada quando exigido (agendamento)", () => {
    expect(evaluateFacebookDestination({ ...base, page: page({ hasToken: false }), requireConnected: true })).toMatchObject({ reason: "page_not_connected" });
    expect(evaluateFacebookDestination({ ...base, page: page({ hasToken: false }) })).toEqual({ allowed: true });
  });
});

describe("seleção na tela", () => {
  const pages = [
    { id: "a", instagramAccountId: "acc-alilu" },
    { id: "b", instagramAccountId: null },
    { id: "c", instagramAccountId: "acc-gta" },
  ];

  it("sem perfil, oculta Páginas de outras contas; com perfil, só as permitidas", () => {
    expect(selectablePagesFor(pages, "acc-alilu", null).map((p) => p.id)).toEqual(["a", "b"]);
    expect(selectablePagesFor(pages, "acc-setabom", { ...disabled })).toEqual([]);
    const profile: DestinationProfilePolicy = { instagramAccountId: "acc-gta", facebookEnabled: true, allowedFacebookPageRefs: ["c"], defaultFacebookPageRefs: ["c"] };
    expect(selectablePagesFor(pages, "acc-gta", profile).map((p) => p.id)).toEqual(["c"]);
  });

  it("sugestão inicial = só padrões do perfil, nunca 'a primeira Página'", () => {
    expect(initialFacebookSelection(null, ["a"])).toEqual([]);
    const profile: DestinationProfilePolicy = { instagramAccountId: "x", facebookEnabled: true, allowedFacebookPageRefs: ["a", "b"], defaultFacebookPageRefs: ["a"] };
    expect(initialFacebookSelection(profile, ["a", "b"])).toEqual(["a"]);
    expect(initialFacebookSelection(profile, ["b"])).toEqual([]);
  });
});

describe("readProfileUpdate", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  it("valida e normaliza", () => {
    expect(readProfileUpdate({ facebookEnabled: false, allowedFacebookPageRefs: [id] })).toEqual({
      value: { label: null, facebookEnabled: false, allowedFacebookPageRefs: [], defaultFacebookPageRefs: [] },
    });
    expect(readProfileUpdate({ facebookEnabled: true, allowedFacebookPageRefs: [] })).toHaveProperty("error");
    expect(readProfileUpdate({ facebookEnabled: true, allowedFacebookPageRefs: [id], defaultFacebookPageRefs: ["22222222-2222-2222-2222-222222222222"] })).toHaveProperty("error");
    expect(readProfileUpdate({ facebookEnabled: "sim" })).toHaveProperty("error");
    expect(readProfileUpdate({ facebookEnabled: true, allowedFacebookPageRefs: ["nao-uuid"] })).toHaveProperty("error");
  });
});
