# Módulo: Resident

> Este módulo ainda **não foi implementado**. Esta pasta reserva o lugar
> dele na arquitetura Modular Monolith do ALILU, conforme definido no
> PROMPT 00 (Fundação).

## Responsabilidade

Vínculo do morador com um condomínio e sua unidade específica. Este vínculo é uma associação, não uma propriedade do usuário.

## Estrutura planejada

Quando este módulo for construído (em uma próxima etapa), ele seguirá a
separação em três camadas, cada uma em seu próprio projeto .csproj:

```
Resident/
├── Alilu.Modules.Resident.Domain/          # Entidades, Value Objects, regras de negócio
├── Alilu.Modules.Resident.Application/     # Casos de uso, DTOs, orquestração
└── Alilu.Modules.Resident.Infrastructure/  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
