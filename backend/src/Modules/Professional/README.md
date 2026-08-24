# Módulo: Professional

> Este módulo ainda **não foi implementado**. Esta pasta reserva o lugar
> dele na arquitetura Modular Monolith do ALILU, conforme definido no
> PROMPT 00 (Fundação).

## Responsabilidade

Cadastro de profissionais (inicialmente diaristas; depois jardineiros, piscineiros, eletricistas, encanadores, pedreiros, pintores etc.) e sua associação com os condomínios que atendem.

## Estrutura planejada

Quando este módulo for construído (em uma próxima etapa), ele seguirá a
separação em três camadas, cada uma em seu próprio projeto .csproj:

```
Professional/
├── Alilu.Modules.Professional.Domain/          # Entidades, Value Objects, regras de negócio
├── Alilu.Modules.Professional.Application/     # Casos de uso, DTOs, orquestração
└── Alilu.Modules.Professional.Infrastructure/  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.
