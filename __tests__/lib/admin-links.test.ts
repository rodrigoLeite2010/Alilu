// Garante que toda tela em app/admin aparece no índice /admin (nada fica sem link).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS } from "@/lib/admin/admin-links";
import { isAdminEmail } from "@/lib/admin/admin-email";

function adminRoutes(dir: string, base = "/admin"): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("[")) continue; // páginas de detalhe dinâmicas
      routes.push(...adminRoutes(full, `${base}/${name}`));
    } else if (name === "page.tsx" && base !== "/admin") {
      routes.push(base);
    }
  }
  return routes;
}

describe("índice do admin", () => {
  it("lista todas as páginas de app/admin, sem links quebrados nem repetidos", () => {
    const linked = ADMIN_SECTIONS.flatMap((section) => section.links.map((link) => link.href));
    const existing = adminRoutes(join(process.cwd(), "app", "admin"));
    expect([...linked].sort()).toEqual([...existing].sort());
    expect(new Set(linked).size).toBe(linked.length);
  });

  it("isAdminEmail só aceita e-mails da lista ADMIN_EMAILS", () => {
    process.env.ADMIN_EMAILS = "Boss@x.com, outro@x.com";
    expect(isAdminEmail("boss@x.com")).toBe(true);
    expect(isAdminEmail("intruso@x.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("boss@x.com")).toBe(false);
  });
});
