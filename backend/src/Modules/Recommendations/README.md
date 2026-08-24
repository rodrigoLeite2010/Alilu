# Módulo: Recommendations

> Os três projetos deste módulo (Domain/Application/Infrastructure) já
> existem e compilam, mas **nenhuma entidade ou regra de negócio foi
> implementada ainda** — isso está reservado para uma etapa futura
> (ver PROMPT 01, Etapa 01: Backend modular).

## Responsabilidade

Recomendações de profissionais para moradores, baseadas em dados reais do sistema (histórico de atendimentos, avaliações).

## Estrutura

```
Recommendations/
├── Domain/Alilu.Modules.Recommendations.Domain.csproj                  # Entidades, Value Objects, regras de negócio
├── Application/Alilu.Modules.Recommendations.Application.csproj        # Casos de uso, DTOs, orquestração
└── Infrastructure/Alilu.Modules.Recommendations.Infrastructure.csproj  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo**.
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, e implementará a persistência (EF Core/Npgsql) e integrações quando o módulo for construído.
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
