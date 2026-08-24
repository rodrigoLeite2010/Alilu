# Módulo: Condominium

> Este módulo ainda **não foi implementado**. Esta pasta reserva o lugar
> dele na arquitetura Modular Monolith do ALILU, conforme definido no
> PROMPT 00 (Fundação).

## Responsabilidade

Cadastro de condomínios (multi-condomínio desde o início) e suas unidades. Validação inicial: Condomínio Monte Carlo.

## Estrutura planejada

Quando este módulo for construído (em uma próxima etapa), ele seguirá a
separação em três camadas, cada uma em seu próprio projeto .csproj:

```
Condominium/
├── Alilu.Modules.Condominium.Domain/          # Entidades, Value Objects, regras de negócio
├── Alilu.Modules.Condominium.Application/     # Casos de uso, DTOs, orquestração
└── Alilu.Modules.Condominium.Infrastructure/  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
