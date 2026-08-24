# Módulo: Scheduling

> Este módulo ainda **não foi implementado**. Esta pasta reserva o lugar
> dele na arquitetura Modular Monolith do ALILU, conforme definido no
> PROMPT 00 (Fundação).

## Responsabilidade

Disponibilidade dos profissionais e agendamento de serviços. Fluxo central do MVP: morador encontra diarista, verifica disponibilidade, agenda.

## Estrutura planejada

Quando este módulo for construído (em uma próxima etapa), ele seguirá a
separação em três camadas, cada uma em seu próprio projeto .csproj:

```
Scheduling/
├── Alilu.Modules.Scheduling.Domain/          # Entidades, Value Objects, regras de negócio
├── Alilu.Modules.Scheduling.Application/     # Casos de uso, DTOs, orquestração
└── Alilu.Modules.Scheduling.Infrastructure/  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
