#!/usr/bin/env python3
"""
Verifica as regras de dependência do PROMPT 01:
 - Domain de um módulo só pode referenciar Alilu.Shared.
 - Application só pode referenciar o Domain do mesmo módulo.
 - Infrastructure só pode referenciar Domain/Application do mesmo módulo.
 - Nenhum módulo referencia outro módulo.
 - Nenhum projeto de módulo referencia Alilu.Api.
 - Não existe dependência circular no grafo de projetos da solução.

Uso: python3 scripts/check-references.py   (a partir de backend/)
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def project_name(csproj_path: str) -> str:
    return os.path.splitext(os.path.basename(csproj_path))[0]


def module_and_layer(name: str):
    # Alilu.Modules.<Module>.<Layer>
    m = re.match(r"^Alilu\.Modules\.([^.]+)\.([^.]+)$", name)
    if m:
        return m.group(1), m.group(2)
    return None, None


def references_of(csproj_path: str):
    with open(csproj_path, encoding="utf-8-sig") as fh:
        content = fh.read()
    rels = re.findall(r'<ProjectReference Include="([^"]+)"', content)
    result = []
    base_dir = os.path.dirname(csproj_path)
    for rel in rels:
        rel_norm = rel.replace("\\", "/")
        abs_path = os.path.normpath(os.path.join(base_dir, rel_norm))
        result.append(abs_path)
    return result


def main():
    csproj_files = sorted(glob.glob(os.path.join(ROOT, "src", "**", "*.csproj"), recursive=True))
    graph = {p: references_of(p) for p in csproj_files}

    errors = []
    report_lines = []

    for path, refs in graph.items():
        name = project_name(path)
        module, layer = module_and_layer(name)
        ref_names = [project_name(r) for r in refs]
        report_lines.append(f"{name} -> {', '.join(ref_names) if ref_names else '(nenhuma)'}")

        if module is None:
            continue  # Alilu.Api, Alilu.Infrastructure, Alilu.Shared: sem regra de módulo

        for r in refs:
            r_name = project_name(r)
            r_module, r_layer = module_and_layer(r_name)

            if r_name == "Alilu.Api" or "Alilu.Api" in r_name:
                errors.append(f"[REGRA] {name} referencia Alilu.Api (Application/Domain não podem depender de Api).")

            if r_module is not None and r_module != module:
                errors.append(f"[MODULO] {name} referencia o modulo '{r_module}' (deveria ser independente).")

            if layer == "Domain" and r_module is not None and r_layer != "Domain":
                errors.append(f"[CAMADA] {name} (Domain) referencia {r_name} ({r_layer}) — Domain não deve depender de Application/Infrastructure.")

            if layer == "Application" and r_module is not None and r_layer not in ("Domain",):
                errors.append(f"[CAMADA] {name} (Application) referencia {r_name} ({r_layer}) — Application só deve depender do próprio Domain.")

    # Detecção de ciclo (DFS)
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {p: WHITE for p in graph}
    cycle_found = []

    def dfs(node, stack):
        color[node] = GRAY
        stack.append(node)
        for nxt in graph.get(node, []):
            if nxt not in color:
                continue
            if color[nxt] == GRAY:
                cycle_found.append(" -> ".join(project_name(x) for x in stack + [nxt]))
            elif color[nxt] == WHITE:
                dfs(nxt, stack)
        stack.pop()
        color[node] = BLACK

    for p in graph:
        if color[p] == WHITE:
            dfs(p, [])

    print("=== Grafo de referências (ProjectReference) ===")
    for line in sorted(report_lines):
        print(" ", line)

    print()
    print(f"Total de projetos: {len(graph)}")

    if cycle_found:
        print("\n❌ Dependência(s) circular(es) encontrada(s):")
        for c in cycle_found:
            print("  ", c)
        errors.append("Dependência circular encontrada.")
    else:
        print("\n✅ Nenhuma dependência circular encontrada.")

    if errors:
        print(f"\n❌ {len(errors)} violação(ões) de regra de arquitetura:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    else:
        print("✅ Nenhuma violação das regras de dependência entre camadas/módulos.")


if __name__ == "__main__":
    main()
