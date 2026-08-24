# Módulo: Recommendations

> Este módulo ainda **não foi implementado**. Esta pasta reserva o lugar
> dele na arquitetura Modular Monolith do ALILU, conforme definido no
> PROMPT 00 (Fundação).

## Responsabilidade

Recomendações de profissionais para moradores, baseadas em dados reais do sistema (histórico de atendimentos, avaliações).

## Estrutura planejada

Quando este módulo for construído (em uma próxima etapa), ele seguirá a
separação em três camadas, cada uma em seu próprio projeto .csproj:

```
Recommendations/
├── Alilu.Modules.Recommendations.Domain/          # Entidades, Value Objects, regras de negócio
├── Alilu.Modules.Recommendations.Application/     # Casos de uso, DTOs, orquestração
└── Alilu.Modules.Recommendations.Infrastructure/  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
